-- Gastos por revisar: los que llegan de Apple Pay sin categoría conocida quedan marcados
-- hasta que el usuario les asigna una categoría (o los deja como están).

alter table public.movimientos add column por_revisar boolean not null default false;

create index movimientos_por_revisar_idx on public.movimientos (user_id) where por_revisar;

-- Misma función que en 20260923000000_atajos_apple_pay.sql, ahora marca por_revisar
-- cuando no pudo deducir la categoría del comercio.
create or replace function public.registrar_gasto_atajo(token text, monto text, comercio text default null, tarjeta text default null)
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
  v_aprendida boolean;
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
    and not m.por_revisar  -- un gasto sin revisar no enseña su categoría
  order by m.fecha desc, m.created_at desc
  limit 1;

  v_aprendida := v_categoria is not null;

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

  insert into public.movimientos (user_id, fecha, tipo, categoria_id, descripcion, importe, cuenta, notas, por_revisar)
  values (
    v_user,
    (now() at time zone 'America/Mexico_City')::date,
    'Gasto',
    v_categoria,
    v_desc,
    v_importe,
    nullif(left(trim(tarjeta), 60), ''),
    'Registrado con Apple Pay',
    not v_aprendida
  )
  returning id into v_id;

  update public.tokens_atajo t set ultimo_uso = now() where t.user_id = v_user;

  select c.nombre into v_nombre from public.categorias c where c.id = v_categoria;
  return json_build_object('id', v_id, 'importe', v_importe, 'descripcion', v_desc, 'categoria', v_nombre, 'por_revisar', not v_aprendida);
end;
$$;

