-- Reglas del esquema inicial: seguridad por fila, categorías, ventas y borrado de datos.

insert into auth.users values
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002');

select pruebas.afirmar(
  (select count(*) from categorias where user_id = 'a0000000-0000-0000-0000-000000000001') = 12,
  'al crear la cuenta se crean las 12 categorías iniciales');

-- Usuario 1 registra un gasto
select pruebas.como('a0000000-0000-0000-0000-000000000001');
insert into movimientos (fecha, tipo, categoria_id, descripcion, importe)
select '2026-09-01', 'Gasto', id, 'Súper', 500 from categorias where nombre = 'Comida';

select pruebas.espera_error(
  $$insert into movimientos (fecha, tipo, categoria_id, importe)
    select '2026-09-01', 'Ingreso', id, 10 from categorias where nombre = 'Comida'$$,
  'es de tipo Gasto');
select pruebas.espera_error(
  $$insert into movimientos (fecha, tipo, categoria_id, importe)
    select '2026-09-01', 'Gasto', id, 0 from categorias where nombre = 'Comida'$$,
  'importe_check');

-- Ventas que exceden el saldo
insert into operaciones (fecha, ticker, tipo, cantidad, precio, moneda) values ('2026-01-10', 'AAPL', 'Compra', 2, 100, 'MXN');
select pruebas.espera_error(
  $$insert into operaciones (fecha, ticker, tipo, cantidad, precio, moneda) values ('2026-02-10', 'AAPL', 'Venta', 3, 100, 'MXN')$$,
  'Solo tenías 2');

-- Usuario 2 no ve nada del usuario 1
select pruebas.como('a0000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from movimientos) = 0, 'RLS: no se ven movimientos ajenos');
select pruebas.afirmar((select count(*) from operaciones) = 0, 'RLS: no se ven operaciones ajenas');
select pruebas.afirmar((select count(*) from categorias) = 12, 'RLS: solo se ven las categorías propias');

-- anon no ve nada
select pruebas.como(null);
select pruebas.afirmar((select count(*) from movimientos) = 0, 'anon no ve movimientos');

-- Borrar datos conserva categorías
select pruebas.como('a0000000-0000-0000-0000-000000000001');
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from movimientos) = 0, 'borrar_todos_mis_datos elimina movimientos');
select pruebas.afirmar((select count(*) from operaciones) = 0, 'borrar_todos_mis_datos elimina operaciones');
select pruebas.afirmar((select count(*) from categorias) = 12, 'borrar_todos_mis_datos conserva categorías');
reset role;
