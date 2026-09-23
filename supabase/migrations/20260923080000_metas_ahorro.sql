-- Metas de ahorro: cuánto quieres juntar y, si quieres, para cuándo.
-- Las aportaciones no son movimientos: apartar dinero no es gastarlo y no toca el presupuesto.
-- Un retiro es una aportación negativa.

create table public.metas_ahorro (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  objetivo     numeric(14, 2) not null check (objetivo > 0),
  fecha_limite date,
  icono        text check (icono is null or char_length(icono) between 1 and 8),
  created_at   timestamptz not null default now()
);

create table public.aportaciones_meta (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meta_id    uuid not null references public.metas_ahorro (id) on delete cascade,
  fecha      date not null,
  importe    numeric(14, 2) not null check (importe <> 0),
  created_at timestamptz not null default now()
);

create index aportaciones_meta_idx on public.aportaciones_meta (meta_id, fecha);

alter table public.metas_ahorro enable row level security;
alter table public.aportaciones_meta enable row level security;

create policy "propios" on public.metas_ahorro for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propios" on public.aportaciones_meta for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- La meta debe ser tuya y un retiro no puede dejar la meta en negativo.
create function public.validar_aportacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ahorrado numeric;
begin
  if not exists (select 1 from public.metas_ahorro m where m.id = new.meta_id and m.user_id = new.user_id) then
    raise exception 'La meta no existe.' using errcode = 'P0001';
  end if;

  select coalesce(sum(a.importe), 0) into v_ahorrado
  from public.aportaciones_meta a
  where a.meta_id = new.meta_id and a.id <> new.id;

  if v_ahorrado + new.importe < 0 then
    raise exception 'Solo tienes % ahorrados en esta meta.', to_char(v_ahorrado, 'FM999,999,999,990.00') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger aportaciones_validar
before insert or update on public.aportaciones_meta
for each row execute function public.validar_aportacion();

-- "Borrar todos mis datos" también borra las metas (sus aportaciones se van en cascada).
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
  delete from public.metas_ahorro where user_id = (select auth.uid());
  delete from public.dividendos where user_id = (select auth.uid());
  delete from public.operaciones where user_id = (select auth.uid());
  delete from public.compras_msi where user_id = (select auth.uid());
  delete from public.recurrentes where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;
