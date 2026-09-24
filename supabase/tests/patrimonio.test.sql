-- Patrimonio: efectivo desde el saldo inicial y deuda a meses sin intereses

insert into auth.users values ('b1000000-0000-0000-0000-000000000001'), ('b1000000-0000-0000-0000-000000000002');
select pruebas.como('b1000000-0000-0000-0000-000000000001');

select pruebas.afirmar(
  (efectivo_y_deudas('2026-09-20') ->> 'con_saldo')::boolean = false,
  'sin saldo inicial lo indica');

insert into saldo_efectivo (monto, fecha, registrado_en) values (10000, '2026-09-10', '2026-09-10 12:00-06');

insert into movimientos (fecha, tipo, categoria_id, importe, created_at)
select v.fecha::date, v.tipo, c.id, v.importe, v.creado::timestamptz
from (values
  ('2026-09-05', 'Gasto',   'Comida', 777,  '2026-09-05 10:00-06'),  -- antes del saldo: ya incluido
  ('2026-09-10', 'Gasto',   'Comida', 999,  '2026-09-10 09:00-06'),  -- mismo día, capturado antes: incluido
  ('2026-09-10', 'Gasto',   'Comida', 300,  '2026-09-10 18:00-06'),  -- mismo día, capturado después: cuenta
  ('2026-09-12', 'Ingreso', 'Sueldo', 5000, '2026-09-12 10:00-06'),  -- después: cuenta
  ('2026-09-30', 'Gasto',   'Comida', 50,   '2026-09-12 10:00-06')   -- con fecha futura: aún no
) as v (fecha, tipo, categoria, importe, creado)
join categorias c on c.nombre = v.categoria;

insert into operaciones (fecha, ticker, tipo, cantidad, precio, comision, moneda, tipo_cambio) values
  ('2026-09-15', 'WALMEX-MX', 'Compra', 10, 60, 5, 'MXN', null),   -- −605
  ('2026-09-11', 'VOO-US',    'Compra', 1, 90, 0, 'USD', 18),      -- −1,620
  ('2026-09-16', 'VOO-US',    'Venta',  1, 100, 1, 'USD', 18);     -- +1,782
insert into dividendos (fecha, ticker, importe, retencion, moneda, tipo_cambio) values
  ('2026-09-20', 'VOO-US', 10, 1, 'USD', 18.5);                    -- +166.50

-- 1,200 a 12 meses: la mensualidad de septiembre resta efectivo; las 11 siguientes son deuda
select crear_compra_msi('2026-09-15', 'Laptop', 1200, 12, (select id from categorias where nombre = 'Compras'));

select pruebas.afirmar(
  (efectivo_y_deudas('2026-09-20') ->> 'efectivo')::numeric = 14323.50,
  format('efectivo = 10,000 + 5,000 − 300 − 605 − 1,620 + 1,782 + 166.50 − 100 (fue %s)', efectivo_y_deudas('2026-09-20') ->> 'efectivo'));
select pruebas.afirmar((efectivo_y_deudas('2026-09-20') ->> 'deudas')::numeric = 1100, 'deuda = 11 mensualidades pendientes');
select pruebas.afirmar(
  (efectivo_y_deudas('2026-10-20') ->> 'deudas')::numeric = 1000,
  'al pagar octubre la deuda baja');
select pruebas.afirmar(
  (efectivo_y_deudas('2026-10-20') ->> 'efectivo')::numeric = 14323.50 - 50 - 100,
  'y el efectivo refleja el gasto del 30 de septiembre y la mensualidad de octubre');

-- Foto diaria: una por día, se sobrescribe
insert into patrimonio_diario (fecha, efectivo, inversiones, deudas) values ('2026-09-20', 14323.5, 458.9, 1100);
insert into patrimonio_diario (fecha, efectivo, inversiones, deudas) values ('2026-09-20', 14000, 460, 1100)
  on conflict (user_id, fecha) do update set efectivo = excluded.efectivo, inversiones = excluded.inversiones, deudas = excluded.deudas;
select pruebas.afirmar((select count(*) = 1 and max(efectivo) = 14000 from patrimonio_diario), 'una foto por día');

-- Otra persona no ve nada y su efectivo no incluye datos ajenos
select pruebas.como('b1000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from saldo_efectivo) + (select count(*) from patrimonio_diario) = 0, 'no se ven datos ajenos');
select pruebas.afirmar((efectivo_y_deudas('2026-09-20') ->> 'efectivo')::numeric = 0, 'el efectivo solo suma lo propio');
select pruebas.como(null);
select pruebas.espera_error($$select efectivo_y_deudas()$$, 'permission denied');

select pruebas.como('b1000000-0000-0000-0000-000000000001');
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from saldo_efectivo) + (select count(*) from patrimonio_diario) = 0, 'borrar todo incluye patrimonio');
reset role;

delete from auth.users where id in ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
