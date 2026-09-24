-- Patrimonio neto = efectivo + inversiones − deudas.
-- El efectivo parte de lo que la persona dice tener hoy en sus cuentas y se mueve con cada
-- ingreso, gasto, operación de acciones y dividendo. Las inversiones se valúan en la app
-- (los precios de mercado se consultan desde el teléfono), por eso la foto diaria la guarda la app.

create table public.saldo_efectivo (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monto         numeric(14, 2) not null,
  -- Día al que corresponde el monto; lo registrado ese día antes de `registrado_en` ya está incluido.
  fecha         date not null,
  registrado_en timestamptz not null default now()
);

create table public.patrimonio_diario (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha       date not null,
  efectivo    numeric(14, 2) not null,
  inversiones numeric(14, 2) not null check (inversiones >= 0),
  deudas      numeric(14, 2) not null check (deudas >= 0),
  primary key (user_id, fecha)
);

alter table public.saldo_efectivo enable row level security;
alter table public.patrimonio_diario enable row level security;

create policy "propios" on public.saldo_efectivo for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propios" on public.patrimonio_diario for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Efectivo a la fecha y deuda pendiente a meses sin intereses, de la sesión actual.
-- Cuenta lo que pasó después del saldo inicial: fecha posterior, o el mismo día pero capturado después.
-- Las mensualidades futuras no restan efectivo todavía: son deuda.
create function public.efectivo_y_deudas(p_hoy date default null)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_hoy    date := coalesce(p_hoy, (now() at time zone 'America/Mexico_City')::date);
  b        public.saldo_efectivo;
  v_flujos numeric;
  v_deudas numeric;
begin
  select * into b from public.saldo_efectivo where user_id = (select auth.uid());

  select coalesce(sum(f.monto), 0) into v_flujos
  from (
    select case m.tipo when 'Ingreso' then m.importe else -m.importe end as monto, m.fecha, m.created_at
    from public.movimientos m
    union all
    select case o.tipo
             when 'Compra' then -(o.cantidad * o.precio + o.comision)
             else o.cantidad * o.precio - o.comision
           end * coalesce(o.tipo_cambio, 1),
           o.fecha, o.created_at
    from public.operaciones o
    union all
    select (d.importe - d.retencion) * coalesce(d.tipo_cambio, 1), d.fecha, d.created_at
    from public.dividendos d
  ) f
  where f.fecha <= v_hoy
    and (b.user_id is null or f.fecha > b.fecha or (f.fecha = b.fecha and f.created_at > b.registrado_en));

  select coalesce(sum(m.importe), 0) into v_deudas
  from public.movimientos m
  where m.compra_msi_id is not null and m.fecha > v_hoy;

  return json_build_object(
    'con_saldo', b.user_id is not null,
    'efectivo', round(coalesce(b.monto, 0) + v_flujos, 2),
    'deudas', round(v_deudas, 2)
  );
end;
$$;

revoke all on function public.efectivo_y_deudas(date) from public, anon;
grant execute on function public.efectivo_y_deudas(date) to authenticated;

-- "Borrar todos mis datos" también borra el saldo inicial y el historial de patrimonio.
create or replace function public.borrar_todos_mis_datos()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para borrar tus datos.' using errcode = 'P0001';
  end if;

  delete from public.presupuestos where user_id = (select auth.uid());
  delete from public.patrimonio_diario where user_id = (select auth.uid());
  delete from public.saldo_efectivo where user_id = (select auth.uid());
  delete from public.metas_ahorro where user_id = (select auth.uid());
  delete from public.dividendos where user_id = (select auth.uid());
  delete from public.operaciones where user_id = (select auth.uid());
  delete from public.compras_msi where user_id = (select auth.uid());
  delete from public.recurrentes where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;
