-- Registro automático de pagos con Apple Pay desde la app Atajos del iPhone.
-- El atajo no tiene sesión de Supabase: se identifica con un código secreto que genera la app.
-- Solo se guarda el hash del código, nunca el código en claro.

create table public.tokens_atajo (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz
);

alter table public.tokens_atajo enable row level security;

create policy "propios" on public.tokens_atajo for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Genera (o reemplaza) el código del usuario actual y lo devuelve una sola vez.
-- ─────────────────────────────────────────────────────────────
create function public.generar_token_atajo()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'P0001';
  end if;

  insert into public.tokens_atajo (user_id, token_hash)
  values (auth.uid(), sha256(convert_to(v_token, 'UTF8')))
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, created_at = now(), ultimo_uso = null;

  return v_token;
end;
$$;

revoke all on function public.generar_token_atajo() from public, anon;
grant execute on function public.generar_token_atajo() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Convierte el importe que manda Atajos ("$1,234.50", "MX$45.00", "45,5") a numeric.
-- ─────────────────────────────────────────────────────────────
create function public.leer_monto_atajo(texto text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  limpio text := regexp_replace(coalesce(texto, ''), '[^0-9.,]', '', 'g');
begin
  -- Coma decimal ("1.234,56") o coma de miles ("1,234.56").
  if limpio ~ ',\d{1,2}$' then
    limpio := replace(replace(limpio, '.', ''), ',', '.');
  else
    limpio := replace(limpio, ',', '');
  end if;
  if limpio !~ '^\d+(\.\d+)?$' then
    return null;
  end if;
  return round(limpio::numeric, 2);
end;
$$;

revoke all on function public.leer_monto_atajo(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- La llama el atajo en cada pago: POST /rest/v1/rpc/registrar_gasto_atajo
-- La categoría se toma del último gasto con el mismo comercio; si no hay, "Otros".
-- ─────────────────────────────────────────────────────────────
create function public.registrar_gasto_atajo(token text, monto text, comercio text default null, tarjeta text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid;
  v_importe   numeric;
  v_desc      text := coalesce(nullif(left(trim(comercio), 160), ''), 'Pago con Apple Pay');
  v_categoria uuid;
  v_nombre    text;
  v_id        uuid;
begin
  select t.user_id into v_user
  from public.tokens_atajo t
  where t.token_hash = sha256(convert_to(coalesce(token, ''), 'UTF8'));

  if v_user is null then
    raise exception 'Código de Atajos inválido. Genera uno nuevo en la app.' using errcode = '28000';
  end if;

  v_importe := public.leer_monto_atajo(monto);
  if v_importe is null or v_importe <= 0 or v_importe > 10000000 then
    raise exception 'No entendí el monto "%".', monto using errcode = 'P0001';
  end if;

  select m.categoria_id into v_categoria
  from public.movimientos m
  join public.categorias c on c.id = m.categoria_id and c.activa
  where m.user_id = v_user and m.tipo = 'Gasto' and lower(m.descripcion) = lower(v_desc)
  order by m.fecha desc, m.created_at desc
  limit 1;

  if v_categoria is null then
    select c.id into v_categoria
    from public.categorias c
    where c.user_id = v_user and c.tipo = 'Gasto' and c.activa
    order by (c.nombre = 'Otros') desc, c.orden
    limit 1;
  end if;

  if v_categoria is null then
    raise exception 'No tienes categorías de gasto activas.' using errcode = 'P0001';
  end if;

  insert into public.movimientos (user_id, fecha, tipo, categoria_id, descripcion, importe, cuenta, notas)
  values (
    v_user,
    (now() at time zone 'America/Mexico_City')::date,
    'Gasto',
    v_categoria,
    v_desc,
    v_importe,
    nullif(left(trim(tarjeta), 60), ''),
    'Registrado con Apple Pay'
  )
  returning id into v_id;

  update public.tokens_atajo t set ultimo_uso = now() where t.user_id = v_user;

  select c.nombre into v_nombre from public.categorias c where c.id = v_categoria;
  return json_build_object('id', v_id, 'importe', v_importe, 'descripcion', v_desc, 'categoria', v_nombre);
end;
$$;

revoke all on function public.registrar_gasto_atajo(text, text, text, text) from public;
grant execute on function public.registrar_gasto_atajo(text, text, text, text) to anon, authenticated;
