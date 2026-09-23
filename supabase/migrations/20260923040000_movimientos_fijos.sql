-- Gastos e ingresos fijos (renta, suscripciones, sueldo): se registran solos cada mes en su día.

create table public.recurrentes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo           text not null check (tipo in ('Ingreso', 'Gasto')),
  descripcion    text not null check (length(trim(descripcion)) > 0),
  importe        numeric(14, 2) not null check (importe > 0),
  categoria_id   uuid not null references public.categorias (id) on delete restrict,
  dia            int not null check (dia between 1 and 31),
  medio_pago     text check (medio_pago in ('Efectivo', 'Debito', 'Credito', 'Transferencia')),
  cuenta         text,
  activo         boolean not null default true,
  -- No se generan movimientos con fecha anterior a `desde`.
  desde          date not null default ((now() at time zone 'America/Mexico_City')::date),
  -- Primer día del último mes ya registrado; evita duplicar y no revive movimientos borrados a mano.
  aplicado_hasta date,
  created_at     timestamptz not null default now()
);

alter table public.recurrentes enable row level security;

create policy "propios" on public.recurrentes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- El tipo del fijo debe coincidir con el de su categoría (misma regla que movimientos).
create function public.validar_categoria_recurrente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text;
begin
  select c.tipo into v_tipo from public.categorias c where c.id = new.categoria_id and c.user_id = new.user_id;
  if v_tipo is null then
    raise exception 'La categoría no existe.' using errcode = 'P0001';
  end if;
  if v_tipo <> new.tipo then
    raise exception 'La categoría es de tipo %, pero el fijo es %.', v_tipo, new.tipo using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger recurrentes_validar_categoria
before insert or update on public.recurrentes
for each row execute function public.validar_categoria_recurrente();

alter table public.movimientos add column recurrente_id uuid references public.recurrentes (id) on delete set null;

-- Un solo movimiento por fijo y por mes, aunque dos dispositivos apliquen a la vez.
create unique index movimientos_recurrente_mes_idx
  on public.movimientos (recurrente_id, date_trunc('month', fecha::timestamp))
  where recurrente_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Registra los fijos vencidos del usuario actual (hasta 12 meses atrás si no abrió la app).
-- La app lo llama al abrir Resumen y Movimientos. Debe coincidir con pendientesDeRegistrar()
-- en src/domain/recurrentes.ts.
-- ─────────────────────────────────────────────────────────────
create function public.aplicar_recurrentes(p_hoy date default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hoy      date := coalesce(p_hoy, (now() at time zone 'America/Mexico_City')::date);
  v_mes_hoy  date := date_trunc('month', v_hoy::timestamp)::date;
  r          record;
  v_mes      date;
  v_fecha    date;
  v_total    int := 0;
  v_filas    int;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'P0001';
  end if;

  for r in
    select * from public.recurrentes
    where user_id = auth.uid() and activo
    for update
  loop
    v_mes := greatest(
      coalesce((r.aplicado_hasta + interval '1 month')::date, date_trunc('month', r.desde::timestamp)::date),
      (v_mes_hoy - interval '11 months')::date
    );

    while v_mes <= v_mes_hoy loop
      v_fecha := v_mes + least(r.dia, extract(day from v_mes + interval '1 month - 1 day')::int) - 1;
      exit when v_fecha > v_hoy;

      if v_fecha >= r.desde then
        insert into public.movimientos (fecha, tipo, categoria_id, descripcion, importe, medio_pago, cuenta, recurrente_id)
        values (v_fecha, r.tipo, r.categoria_id, r.descripcion, r.importe, r.medio_pago, r.cuenta, r.id)
        on conflict (recurrente_id, date_trunc('month', fecha::timestamp)) where recurrente_id is not null do nothing;
        get diagnostics v_filas = row_count;
        v_total := v_total + v_filas;
      end if;

      update public.recurrentes set aplicado_hasta = v_mes where id = r.id;
      v_mes := (v_mes + interval '1 month')::date;
    end loop;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.aplicar_recurrentes(date) from public, anon;
grant execute on function public.aplicar_recurrentes(date) to authenticated;

-- "Borrar todos mis datos" también borra los fijos (si no, volverían a generar movimientos).
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
  delete from public.recurrentes where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;
