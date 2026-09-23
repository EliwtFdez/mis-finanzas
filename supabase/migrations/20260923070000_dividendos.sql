-- Dividendos cobrados. Van aparte de `operaciones` porque no cambian los títulos ni el costo promedio.
-- `importe` es el bruto en la moneda del pago; `retencion` es el impuesto retenido en esa misma moneda.

create table public.dividendos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha       date not null,
  ticker      text not null check (ticker = upper(trim(ticker)) and length(ticker) > 0),
  importe     numeric(14, 2) not null check (importe > 0),
  retencion   numeric(14, 2) not null default 0 check (retencion >= 0),
  moneda      text not null check (moneda in ('MXN', 'USD')),
  tipo_cambio numeric(12, 4),
  notas       text,
  created_at  timestamptz not null default now(),
  constraint retencion_menor_al_importe check (retencion < importe),
  -- Misma regla que en operaciones: MXN sin tipo de cambio, USD con él.
  constraint tipo_cambio_segun_moneda check (
    (moneda = 'MXN' and tipo_cambio is null) or
    (moneda = 'USD' and tipo_cambio is not null and tipo_cambio > 0)
  )
);

create index dividendos_user_fecha_idx on public.dividendos (user_id, fecha);

alter table public.dividendos enable row level security;

create policy "propios" on public.dividendos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- "Borrar todos mis datos" también borra los dividendos.
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
  delete from public.dividendos where user_id = (select auth.uid());
  delete from public.operaciones where user_id = (select auth.uid());
  delete from public.compras_msi where user_id = (select auth.uid());
  delete from public.recurrentes where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;
