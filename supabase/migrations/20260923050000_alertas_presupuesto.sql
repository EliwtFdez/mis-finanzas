-- Alertas de presupuesto en el teléfono: cuando un gasto hace cruzar el 80% o el 100%
-- del presupuesto del mes (el total o el de su categoría), se regresa un texto para notificar.
-- Solo avisa en el cruce, así que cada umbral suena una vez por mes aunque sigas gastando.

-- 0 = bien, 1 = desde el 80%, 2 = desde el 100%. Mismo criterio que nivelPresupuesto() en src/domain/finanzas.ts.
-- (presupuestos.monto siempre es > 0 por su check.)
create function public.nivel_presupuesto(gastado numeric, presupuesto numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when presupuesto is null then 0
    when gastado >= presupuesto then 2
    when gastado >= presupuesto * 0.8 then 1
    else 0
  end
$$;

-- Texto de la alerta que provocó el gasto `movimiento`, o null si no cruzó ningún umbral.
-- Security invoker: desde la app, RLS limita a los movimientos propios.
create function public.alerta_presupuesto(movimiento uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  m        public.movimientos;
  v_inicio date;
  v_lineas text[] := '{}';
  r        record;
begin
  select * into m from public.movimientos where id = movimiento;
  if m.id is null or m.tipo <> 'Gasto' then
    return null;
  end if;
  v_inicio := date_trunc('month', m.fecha)::date;

  for r in
    select coalesce(c.nombre, 'Presupuesto del mes') as nombre, p.monto,
      (select coalesce(sum(g.importe), 0)
       from public.movimientos g
       where g.user_id = m.user_id and g.tipo = 'Gasto'
         and g.fecha >= v_inicio and g.fecha < v_inicio + interval '1 month'
         and (p.categoria_id is null or g.categoria_id = p.categoria_id)) as despues
    from public.presupuestos p
    left join public.categorias c on c.id = p.categoria_id
    where p.user_id = m.user_id
      and p.anio = extract(year from m.fecha) and p.mes = extract(month from m.fecha)
      and (p.categoria_id is null or p.categoria_id = m.categoria_id)
    order by p.categoria_id nulls last  -- la categoría primero, el total después
  loop
    if public.nivel_presupuesto(r.despues, r.monto) > public.nivel_presupuesto(r.despues - m.importe, r.monto) then
      v_lineas := v_lineas || format(
        '%s: %s %s%% del presupuesto ($%s de $%s)',
        r.nombre,
        case when r.despues >= r.monto then 'llegaste al' else 'ya usaste el' end,
        floor(r.despues * 100 / r.monto),
        to_char(round(r.despues), 'FM999,999,999,990'),
        to_char(round(r.monto), 'FM999,999,999,990'));
    end if;
  end loop;

  return nullif(array_to_string(v_lineas, E'\n'), '');
end;
$$;

revoke all on function public.nivel_presupuesto(numeric, numeric) from public, anon;
revoke all on function public.alerta_presupuesto(uuid) from public, anon;
grant execute on function public.alerta_presupuesto(uuid) to authenticated;

-- Misma función que en 20260923020000_gastos_por_revisar.sql; ahora también regresa `alerta`
-- para que el atajo la muestre con «Mostrar notificación».
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
  return json_build_object(
    'id', v_id, 'importe', v_importe, 'descripcion', v_desc, 'categoria', v_nombre, 'por_revisar', not v_aprendida,
    'alerta', public.alerta_presupuesto(v_id)
  );
end;
$$;

