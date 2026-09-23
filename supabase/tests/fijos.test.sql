-- Gastos e ingresos fijos

insert into auth.users values ('e0000000-0000-0000-0000-000000000001'), ('e0000000-0000-0000-0000-000000000002');
select pruebas.como('e0000000-0000-0000-0000-000000000001');

insert into recurrentes (tipo, descripcion, importe, categoria_id, dia, desde)
select 'Gasto', 'Renta', 8000, id, 1, '2026-06-15' from categorias where nombre = 'Vivienda';
insert into recurrentes (tipo, descripcion, importe, categoria_id, dia, desde, medio_pago)
select 'Gasto', 'Netflix', 219, id, 31, '2026-06-15', 'Credito' from categorias where nombre = 'Entretenimiento';
insert into recurrentes (tipo, descripcion, importe, categoria_id, dia, desde)
select 'Ingreso', 'Sueldo', 20000, id, 15, '2026-06-15' from categorias where nombre = 'Sueldo';

select pruebas.espera_error(
  $$insert into recurrentes (tipo, descripcion, importe, categoria_id, dia) select 'Ingreso', 'X', 1, id, 1 from categorias where nombre = 'Comida'$$,
  'es de tipo Gasto');

-- Al 20 de septiembre: renta jul, ago, sep (junio 1 es antes de `desde`); Netflix jun 30, jul 31, ago 31;
-- sueldo jun 15 (= desde), jul, ago, sep.
select pruebas.afirmar(aplicar_recurrentes('2026-09-20') = 10, 'registra los fijos vencidos desde que se crearon');
select pruebas.afirmar(
  (select array_agg(fecha::text order by fecha) from movimientos where descripcion = 'Netflix')
  = array['2026-06-30', '2026-07-31', '2026-08-31'],
  'día 31 se ajusta al fin de mes y septiembre aún no vence');
select pruebas.afirmar(
  (select bool_and(medio_pago = 'Credito') from movimientos where descripcion = 'Netflix'),
  'copia el medio de pago');

select pruebas.afirmar(aplicar_recurrentes('2026-09-20') = 0, 'aplicar dos veces no duplica');

-- Borrar a mano un movimiento generado no lo revive
delete from movimientos where descripcion = 'Renta' and fecha = '2026-09-01';
select pruebas.afirmar(aplicar_recurrentes('2026-09-25') = 0, 'un movimiento borrado a mano no se vuelve a crear');

-- Pausado no genera
update recurrentes set activo = false where descripcion = 'Sueldo';
-- Al 31 oct: Netflix de sep 30 (aún no vencía el 25) y oct 31, renta de oct 1; el sueldo pausado no.
select pruebas.afirmar(aplicar_recurrentes('2026-10-31') = 3, 'en octubre: Netflix sep/oct y renta; el sueldo pausado no');

-- Sin abrir la app más de un año: solo los últimos 12 meses (abr 2027 a mar 2028).
-- Renta: 12 (día 1). Netflix: 11 (el 31 de marzo aún no llega).
select pruebas.afirmar(aplicar_recurrentes('2028-03-05') = 23, 'se ponen al corriente como máximo 12 meses');
select pruebas.afirmar(
  (select min(fecha) from movimientos where descripcion = 'Renta' and fecha > '2026-10-31') = '2027-04-01',
  'los meses más viejos que 12 se omiten');

-- Borrar el fijo conserva sus movimientos
delete from recurrentes where descripcion = 'Renta';
select pruebas.afirmar((select count(*) from movimientos where descripcion = 'Renta') > 0, 'borrar el fijo conserva sus movimientos');

select pruebas.como('e0000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from recurrentes) = 0, 'RLS en recurrentes');
select pruebas.afirmar(aplicar_recurrentes('2026-09-20') = 0, 'no aplica fijos ajenos');

select pruebas.como('e0000000-0000-0000-0000-000000000001');
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from recurrentes) = 0, 'borrar_todos_mis_datos borra los fijos');

select pruebas.como(null);
select pruebas.espera_error($$select aplicar_recurrentes()$$, 'permission denied');
reset role;
