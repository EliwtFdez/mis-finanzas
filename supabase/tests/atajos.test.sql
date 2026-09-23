-- Registro de pagos de Apple Pay desde Atajos.

insert into auth.users values
  ('b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002');

select pruebas.como('b0000000-0000-0000-0000-000000000001');
select generar_token_atajo() as token \gset
select pruebas.afirmar((select count(*) from tokens_atajo) = 1, 'el usuario ve su código');
select pruebas.afirmar(length(:'token') = 64, 'el código tiene 64 caracteres');
select pruebas.afirmar(
  (select token_hash from tokens_atajo) <> convert_to(:'token', 'UTF8'),
  'solo se guarda el hash del código');

select pruebas.como('b0000000-0000-0000-0000-000000000002');
select pruebas.afirmar((select count(*) from tokens_atajo) = 0, 'no se ven códigos ajenos');

-- El atajo llama sin sesión
select pruebas.como(null);
select pruebas.afirmar(
  (registrar_gasto_atajo(:'token', '$1,234.50', 'OXXO MADERO', 'BBVA Azul') ->> 'categoria') = 'Otros',
  'comercio nuevo cae en Otros');
select pruebas.afirmar(
  (registrar_gasto_atajo(:'token', 'MX$45,5', 'Café') ->> 'importe')::numeric = 45.5,
  'acepta coma decimal');
select pruebas.espera_error($$select registrar_gasto_atajo('malo', '10', 'x')$$, 'Código de Atajos inválido');
select pruebas.espera_error(format('select registrar_gasto_atajo(%L, %L, %L)', :'token', 'abc', 'x'), 'No entendí el monto');
select pruebas.espera_error($$select leer_monto_atajo('10')$$, 'permission denied');
select pruebas.espera_error($$select generar_token_atajo()$$, 'permission denied');
select pruebas.afirmar((select count(*) from tokens_atajo) = 0, 'anon no puede leer códigos');

-- Aprende la categoría del último gasto en el mismo comercio
reset role;
update movimientos set categoria_id = (
  select id from categorias where nombre = 'Comida' and user_id = 'b0000000-0000-0000-0000-000000000001'
) where descripcion = 'OXXO MADERO';
select pruebas.como(null);
select pruebas.afirmar(
  (registrar_gasto_atajo(:'token', '29.00', 'oxxo madero') ->> 'categoria') = 'Comida',
  'reusa la categoría del mismo comercio');

reset role;
select pruebas.afirmar(
  (select count(*) from movimientos where user_id = 'b0000000-0000-0000-0000-000000000001' and notas = 'Registrado con Apple Pay') = 3,
  'se registraron 3 pagos');
select pruebas.afirmar(
  (select cuenta from movimientos where descripcion = 'OXXO MADERO') = 'BBVA Azul',
  'guarda la tarjeta como cuenta');
select pruebas.afirmar((select ultimo_uso is not null from tokens_atajo), 'marca el último uso');

-- Un código nuevo invalida el anterior
select pruebas.como('b0000000-0000-0000-0000-000000000001');
select generar_token_atajo() as token_nuevo \gset
select pruebas.como(null);
select pruebas.espera_error(format('select registrar_gasto_atajo(%L, %L)', :'token', '10'), 'Código de Atajos inválido');
reset role;
