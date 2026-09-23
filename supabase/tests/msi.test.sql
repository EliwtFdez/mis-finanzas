-- Meses sin intereses

insert into auth.users values ('d0000000-0000-0000-0000-000000000001'), ('d0000000-0000-0000-0000-000000000002');
select pruebas.como('d0000000-0000-0000-0000-000000000001');

select crear_compra_msi('2026-01-31', ' Laptop ', 1000, 3, (select id from categorias where nombre = 'Compras'), 'BBVA Azul') as compra \gset

select pruebas.afirmar(
  (select array_agg(fecha::text || ' ' || importe::text || ' ' || numero_pago order by numero_pago)
   from movimientos where compra_msi_id = :'compra')
  = array['2026-01-31 333.33 1', '2026-02-28 333.33 2', '2026-03-31 333.34 3'],
  'reparte en mensualidades con el residuo al final y ajusta el día al fin de mes');
select pruebas.afirmar(
  (select sum(importe) from movimientos where compra_msi_id = :'compra') = 1000,
  'la suma de mensualidades es el total');
select pruebas.afirmar(
  (select bool_and(descripcion like 'Laptop (MSI _/3)' and medio_pago = 'Credito' and cuenta = 'BBVA Azul')
   from movimientos where compra_msi_id = :'compra'),
  'cada mensualidad lleva descripción, medio de pago y cuenta');

select pruebas.espera_error(
  $$select crear_compra_msi('2026-01-01', 'X', 100, 1, (select id from categorias where nombre = 'Compras'))$$,
  'compras_msi_meses_check');
select pruebas.espera_error(
  $$select crear_compra_msi('2026-01-01', 'X', 100, 3, (select id from categorias where nombre = 'Sueldo'))$$,
  'es de tipo Ingreso');
select pruebas.afirmar((select count(*) from compras_msi) = 1, 'una compra inválida no deja nada a medias');

-- Otro usuario no ve la compra
select pruebas.como('d0000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from compras_msi) = 0, 'RLS en compras_msi');

-- Borrar la compra borra sus mensualidades
select pruebas.como('d0000000-0000-0000-0000-000000000001');
delete from compras_msi where id = :'compra';
select pruebas.afirmar((select count(*) from movimientos) = 0, 'borrar la compra borra sus mensualidades');

select crear_compra_msi('2026-05-10', 'Tele', 600, 6, (select id from categorias where nombre = 'Compras'));
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from compras_msi) = 0 and (select count(*) from movimientos) = 0, 'borrar_todos_mis_datos borra compras a meses');

select pruebas.como(null);
select pruebas.espera_error($$select crear_compra_msi('2026-01-01', 'X', 100, 3, gen_random_uuid())$$, 'permission denied');
reset role;
