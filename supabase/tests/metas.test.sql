-- Metas de ahorro

insert into auth.users values ('a1000000-0000-0000-0000-000000000001'), ('a1000000-0000-0000-0000-000000000002');
select pruebas.como('a1000000-0000-0000-0000-000000000001');

insert into metas_ahorro (nombre, objetivo, fecha_limite, icono) values ('Viaje a Japón', 60000, '2027-03-31', '✈️');
select id as meta from metas_ahorro \gset

insert into aportaciones_meta (meta_id, fecha, importe) values (:'meta', '2026-09-01', 5000), (:'meta', '2026-09-15', 2500);
insert into aportaciones_meta (meta_id, fecha, importe) values (:'meta', '2026-09-20', -1500);
select pruebas.afirmar((select sum(importe) from aportaciones_meta) = 6000, 'aportar y retirar');

select pruebas.espera_error(format('insert into aportaciones_meta (meta_id, fecha, importe) values (%L, %L, -6000.01)', :'meta', '2026-09-21'), 'Solo tienes 6,000.00 ahorrados');
select pruebas.espera_error(format('insert into aportaciones_meta (meta_id, fecha, importe) values (%L, %L, 0)', :'meta', '2026-09-21'), 'aportaciones_meta_importe_check');
select pruebas.espera_error($$update aportaciones_meta set importe = -9000 where importe = -1500$$, 'Solo tienes');
select pruebas.espera_error($$insert into metas_ahorro (nombre, objetivo) values ('  ', 100)$$, 'metas_ahorro_nombre_check');
select pruebas.espera_error($$insert into metas_ahorro (nombre, objetivo) values ('Auto', 0)$$, 'metas_ahorro_objetivo_check');

-- Otra persona no ve la meta ni puede aportar a ella
select pruebas.como('a1000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from metas_ahorro) = 0, 'no se ven metas ajenas');
select pruebas.espera_error(format('insert into aportaciones_meta (meta_id, fecha, importe) values (%L, %L, 100)', :'meta', '2026-09-21'), 'La meta no existe');

-- Borrar la meta borra sus aportaciones; borrar todo incluye las metas
select pruebas.como('a1000000-0000-0000-0000-000000000001');
insert into metas_ahorro (nombre, objetivo) values ('Fondo de emergencia', 30000);
delete from metas_ahorro where id = :'meta';
select pruebas.afirmar((select count(*) from aportaciones_meta) = 0, 'las aportaciones se borran con su meta');
select borrar_todos_mis_datos();
select pruebas.afirmar((select count(*) from metas_ahorro) = 0, 'borrar todos mis datos incluye las metas');
reset role;

delete from auth.users where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
