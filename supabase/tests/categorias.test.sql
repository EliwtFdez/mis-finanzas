-- Categorías editables

insert into auth.users values ('c0000000-0000-0000-0000-000000000001');
select pruebas.como('c0000000-0000-0000-0000-000000000001');

insert into categorias (nombre, tipo, orden) values ('Mascotas', 'Gasto', 13);
select pruebas.afirmar((select count(*) from categorias) = 13, 'se puede crear una categoría');
select pruebas.espera_error($$insert into categorias (nombre, tipo) values ('  mascotas ', 'Gasto')$$, 'categorias_nombre_unico');
select pruebas.espera_error($$insert into categorias (nombre, tipo) values ('   ', 'Gasto')$$, 'categorias_nombre_check');

update categorias set nombre = 'Mascotas y veterinario' where nombre = 'Mascotas';
update categorias set tipo = 'Ingreso' where nombre = 'Mascotas y veterinario';
update categorias set tipo = 'Gasto' where nombre = 'Mascotas y veterinario';

insert into movimientos (fecha, tipo, categoria_id, importe)
select '2026-09-01', 'Gasto', id, 300 from categorias where nombre = 'Mascotas y veterinario';

select pruebas.espera_error($$update categorias set tipo = 'Ingreso' where nombre = 'Mascotas y veterinario'$$, 'no puede cambiar de tipo');
select pruebas.espera_error($$delete from categorias where nombre = 'Mascotas y veterinario'$$, 'foreign key');

update categorias set activa = false where nombre = 'Mascotas y veterinario';
select pruebas.afirmar((select not activa from categorias where nombre = 'Mascotas y veterinario'), 'se puede ocultar una categoría con movimientos');

delete from categorias where nombre = 'Educación';
select pruebas.afirmar((select count(*) from categorias) = 12, 'se puede borrar una categoría sin movimientos');

-- Ícono y color
select pruebas.afirmar(
  (select icono = '🍽️' and color = '#2F6B4F' from categorias where nombre = 'Comida'),
  'las categorías iniciales traen ícono y color');
select pruebas.afirmar(
  (select icono is null and color is null from categorias where nombre = 'Mascotas y veterinario'),
  'una categoría nueva puede quedar sin ícono ni color');
update categorias set icono = '🐾', color = '#A8487A' where nombre = 'Mascotas y veterinario';
select pruebas.espera_error($$update categorias set color = 'rojo' where nombre = 'Comida'$$, 'categorias_color_check');
select pruebas.espera_error($$update categorias set color = '#b3362b' where nombre = 'Comida'$$, 'categorias_color_check');
select pruebas.espera_error($$update categorias set icono = '' where nombre = 'Comida'$$, 'categorias_icono_check');
reset role;
