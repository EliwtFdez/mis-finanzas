-- Mis finanzas: esquema inicial
-- Traduce las hojas del Excel "Mis finanzas y acciones" a tablas con reglas.
-- Las validaciones que en Excel marcaban "Revisar datos" aquí impiden guardar datos inválidos.

-- ─────────────────────────────────────────────────────────────
-- Categorías (antes: lista fija en la validación de la hoja Gastos)
-- ─────────────────────────────────────────────────────────────
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) > 0),
  tipo       text not null check (tipo in ('Ingreso', 'Gasto')),
  orden      int  not null default 0,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ─────────────────────────────────────────────────────────────
-- Movimientos (antes: hoja Gastos)
-- ─────────────────────────────────────────────────────────────
create table public.movimientos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha        date not null,
  tipo         text not null check (tipo in ('Ingreso', 'Gasto')),
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  descripcion  text,
  importe      numeric(14, 2) not null check (importe > 0),
  medio_pago   text check (medio_pago in ('Efectivo', 'Debito', 'Credito', 'Transferencia')),
  cuenta       text,
  notas        text,
  created_at   timestamptz not null default now()
);

create index movimientos_user_fecha_idx on public.movimientos (user_id, fecha);

-- El tipo del movimiento debe coincidir con el de su categoría
-- (en Excel se podía poner "Sueldo" como Gasto sin que nada avisara).
create function public.validar_categoria_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text;
begin
  select c.tipo into v_tipo
  from public.categorias c
  where c.id = new.categoria_id and c.user_id = new.user_id;

  if v_tipo is null then
    raise exception 'La categoría no existe.' using errcode = 'P0001';
  end if;
  if v_tipo <> new.tipo then
    raise exception 'La categoría es de tipo %, pero el movimiento es %.', v_tipo, new.tipo
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger movimientos_validar_categoria
before insert or update on public.movimientos
for each row execute function public.validar_categoria_movimiento();

-- ─────────────────────────────────────────────────────────────
-- Operaciones de acciones (antes: hoja Acciones)
-- ─────────────────────────────────────────────────────────────
create table public.operaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha       date not null,
  ticker      text not null check (ticker = upper(trim(ticker)) and length(ticker) > 0),
  tipo        text not null check (tipo in ('Compra', 'Venta')),
  cantidad    numeric(20, 8) not null check (cantidad > 0),
  precio      numeric(20, 6) not null check (precio > 0),
  comision    numeric(14, 2) not null default 0 check (comision >= 0),
  moneda      text not null check (moneda in ('MXN', 'USD')),
  tipo_cambio numeric(12, 4),
  notas       text,
  created_at  timestamptz not null default now(),
  -- MXN no lleva tipo de cambio; USD lo exige (misma regla que la hoja Acciones)
  constraint tipo_cambio_segun_moneda check (
    (moneda = 'MXN' and tipo_cambio is null) or
    (moneda = 'USD' and tipo_cambio is not null and tipo_cambio > 0)
  )
);

create index operaciones_user_orden_idx on public.operaciones (user_id, fecha, created_at);

-- Una venta no puede superar los títulos que tenías en ese momento
-- (antes: estado "Venta excede saldo"). El orden es fecha y luego hora de captura,
-- así que ya no depende del orden de las filas.
create function public.validar_venta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_saldo numeric;
begin
  if new.tipo <> 'Venta' then
    return new;
  end if;

  select coalesce(sum(case when o.tipo = 'Compra' then o.cantidad else -o.cantidad end), 0)
    into v_saldo
  from public.operaciones o
  where o.user_id = new.user_id
    and o.ticker = new.ticker
    and o.id <> new.id
    and (o.fecha, o.created_at) <= (new.fecha, new.created_at);

  if new.cantidad > v_saldo + 0.00000001 then
    raise exception 'Solo tenías % títulos de % en esa fecha.', trim(to_char(v_saldo, 'FM999999990.########')), new.ticker
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger operaciones_validar_venta
before insert or update on public.operaciones
for each row execute function public.validar_venta();

-- ─────────────────────────────────────────────────────────────
-- Presupuestos (antes: celda "Presupuesto del mes"; ahora también por categoría)
-- categoria_id nulo = presupuesto total del mes
-- ─────────────────────────────────────────────────────────────
create table public.presupuestos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anio         int  not null check (anio between 2000 and 2100),
  mes          int  not null check (mes between 1 and 12),
  categoria_id uuid references public.categorias (id) on delete cascade,
  monto        numeric(14, 2) not null check (monto > 0),
  created_at   timestamptz not null default now(),
  unique nulls not distinct (user_id, anio, mes, categoria_id)
);

-- ─────────────────────────────────────────────────────────────
-- Seguridad: cada persona solo ve y modifica sus propios datos
-- ─────────────────────────────────────────────────────────────
alter table public.categorias   enable row level security;
alter table public.movimientos  enable row level security;
alter table public.operaciones  enable row level security;
alter table public.presupuestos enable row level security;

create policy "propios" on public.categorias for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propios" on public.movimientos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propios" on public.operaciones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "propios" on public.presupuestos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Categorías iniciales al crear la cuenta (las mismas del Excel)
-- ─────────────────────────────────────────────────────────────
create function public.crear_categorias_iniciales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (user_id, nombre, tipo, orden) values
    (new.id, 'Vivienda',           'Gasto',    1),
    (new.id, 'Comida',             'Gasto',    2),
    (new.id, 'Transporte',         'Gasto',    3),
    (new.id, 'Servicios',          'Gasto',    4),
    (new.id, 'Salud',              'Gasto',    5),
    (new.id, 'Entretenimiento',    'Gasto',    6),
    (new.id, 'Compras',            'Gasto',    7),
    (new.id, 'Educación',          'Gasto',    8),
    (new.id, 'Deudas e intereses', 'Gasto',    9),
    (new.id, 'Otros',              'Gasto',   10),
    (new.id, 'Sueldo',             'Ingreso', 11),
    (new.id, 'Ingreso extra',      'Ingreso', 12);
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_categorias_iniciales();
