-- Dividendos

insert into auth.users values ('d1000000-0000-0000-0000-000000000001'), ('d1000000-0000-0000-0000-000000000002');
select pruebas.como('d1000000-0000-0000-0000-000000000001');

insert into dividendos (fecha, ticker, importe, moneda) values ('2026-06-10', 'WALMEX-MX', 120.50, 'MXN');
insert into dividendos (fecha, ticker, importe, retencion, moneda, tipo_cambio) values ('2026-07-01', 'VOO-US', 10, 1, 'USD', 18.5);
select pruebas.afirmar((select count(*) from dividendos) = 2, 'se registran dividendos en MXN y USD');

select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, moneda) values ('2026-07-01', 'voo-us', 10, 'MXN')$$, 'dividendos_ticker_check');
select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, moneda) values ('2026-07-01', 'VOO-US', 0, 'MXN')$$, 'dividendos_importe_check');
select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, moneda) values ('2026-07-01', 'VOO-US', 10, 'USD')$$, 'tipo_cambio_segun_moneda');
select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, moneda, tipo_cambio) values ('2026-07-01', 'X', 10, 'MXN', 18)$$, 'tipo_cambio_segun_moneda');
select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, retencion, moneda) values ('2026-07-01', 'X', 10, 10, 'MXN')$$, 'retencion_menor_al_importe');
select pruebas.espera_error($$insert into dividendos (fecha, ticker, importe, retencion, moneda) values ('2026-07-01', 'X', 10, -1, 'MXN')$$, 'dividendos_retencion_check');

select pruebas.como('d1000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from dividendos) = 0, 'no se ven dividendos ajenos');
select pruebas.como(null);
select pruebas.afirmar((select count(*) from dividendos) = 0, 'sin sesión no se ve ningún dividendo');

select pruebas.como('d1000000-0000-0000-0000-000000000001');
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from dividendos) = 0, 'borrar todos mis datos incluye los dividendos');
reset role;

delete from auth.users where id in ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002');
