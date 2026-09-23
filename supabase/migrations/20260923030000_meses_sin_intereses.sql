-- Compras a meses sin intereses: una compra genera una mensualidad (movimiento) por mes.
-- Así el presupuesto de cada mes cuenta solo lo que toca pagar, no la compra completa.

create table public.compras_msi (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha         date not null,
  descripcion   text not null check (length(trim(descripcion)) > 0),
  importe_total numeric(14, 2) not null check (importe_total > 0),
  meses         int not null check (meses between 2 and 48),
  categoria_id  uuid not null references public.categorias (id) on delete restrict,
  cuenta        text,
  created_at    timestamptz not null default now()
);

alter table public.compras_msi enable row level security;

create policy "propios" on public.compras_msi for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Cada mensualidad sabe de qué compra viene; al borrar la compra se borran sus mensualidades.
alter table public.movimientos
  add column compra_msi_id uuid references public.compras_msi (id) on delete cascade,
  add column numero_pago   smallint;

create index movimientos_compra_msi_idx on public.movimientos (compra_msi_id) where compra_msi_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Crea la compra y sus mensualidades en una sola transacción.
-- Reparto: cada pago es el total entre los meses truncado a centavos; el último absorbe el residuo.
-- Fecha: el mismo día de la compra en cada mes (o el último día si el mes es más corto).
-- Debe coincidir con calendarioMsi() en src/domain/msi.ts.
-- ─────────────────────────────────────────────────────────────
create function public.crear_compra_msi(
  p_fecha date,
  p_descripcion text,
  p_importe_total numeric,
  p_meses int,
  p_categoria_id uuid,
  p_cuenta text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid;
  v_base numeric := trunc(p_importe_total / p_meses, 2);
begin
  insert into public.compras_msi (fecha, descripcion, importe_total, meses, categoria_id, cuenta)
  values (p_fecha, trim(p_descripcion), p_importe_total, p_meses, p_categoria_id, nullif(trim(p_cuenta), ''))
  returning id into v_id;

  insert into public.movimientos (fecha, tipo, categoria_id, descripcion, importe, medio_pago, cuenta, compra_msi_id, numero_pago)
  select
    (inicio_mes + least(extract(day from p_fecha)::int, extract(day from inicio_mes + interval '1 month - 1 day')::int) - 1)::date,
    'Gasto',
    p_categoria_id,
    format('%s (MSI %s/%s)', trim(p_descripcion), k, p_meses),
    case when k = p_meses then p_importe_total - v_base * (p_meses - 1) else v_base end,
    'Credito',
    nullif(trim(p_cuenta), ''),
    v_id,
    k
  from generate_series(1, p_meses) as k,
       lateral (select (date_trunc('month', p_fecha) + make_interval(months => k - 1))::date as inicio_mes) as m;

  return v_id;
end;
$$;

revoke all on function public.crear_compra_msi(date, text, numeric, int, uuid, text) from public, anon;
grant execute on function public.crear_compra_msi(date, text, numeric, int, uuid, text) to authenticated;

-- "Borrar todos mis datos" también borra las compras a meses (y con ellas sus mensualidades).
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
  delete from public.operaciones where user_id = (select auth.uid());
  delete from public.compras_msi where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;
