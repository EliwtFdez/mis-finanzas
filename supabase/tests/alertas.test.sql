-- Alertas de presupuesto: solo el gasto que cruza el 80% o el 100% regresa texto.

-- Registra un gasto y regresa su alerta. Son dos sentencias porque alerta_presupuesto es stable
-- y no vería un movimiento insertado en la misma consulta.
create function pruebas.gastar(fecha date, categoria text, importe numeric) returns text
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.movimientos (fecha, tipo, categoria_id, importe)
  select fecha, 'Gasto', c.id, importe from public.categorias c
  where c.nombre = categoria and c.user_id = auth.uid()
  returning id into v_id;
  return public.alerta_presupuesto(v_id);
end;
$$;
grant execute on function pruebas.gastar(date, text, numeric) to authenticated;

insert into auth.users values ('f0000000-0000-0000-0000-000000000001'), ('f0000000-0000-0000-0000-000000000002');
select pruebas.como('f0000000-0000-0000-0000-000000000001');

insert into presupuestos (anio, mes, categoria_id, monto) values (2026, 9, null, 5000);
insert into presupuestos (anio, mes, categoria_id, monto)
select 2026, 9, id, 1000 from categorias where nombre = 'Comida';

select pruebas.afirmar(pruebas.gastar('2026-09-02', 'Comida', 700) is null, 'al 70% no avisa');
select pruebas.afirmar(
  pruebas.gastar('2026-09-05', 'Comida', 150) = 'Comida: ya usaste el 85% del presupuesto ($850 de $1,000)',
  'avisa al cruzar el 80% de la categoría');
select pruebas.afirmar(pruebas.gastar('2026-09-06', 'Comida', 50) is null, 'seguir en la misma franja no vuelve a avisar');
select pruebas.afirmar(
  pruebas.gastar('2026-09-07', 'Comida', 120) = 'Comida: llegaste al 102% del presupuesto ($1,020 de $1,000)',
  'avisa al llegar al 100%');
select pruebas.afirmar(pruebas.gastar('2026-09-08', 'Comida', 10) is null, 'pasado el 100% ya no repite');

-- Otra categoría sin presupuesto propio empuja el total (1,030 + 3,000 = 4,030 de 5,000 = 80.6%)
select pruebas.afirmar(
  pruebas.gastar('2026-09-09', 'Transporte', 3000) = 'Presupuesto del mes: ya usaste el 80% del presupuesto ($4,030 de $5,000)',
  'avisa por el presupuesto total');

-- Un gasto que cruza la categoría y el total a la vez: dos líneas, la categoría primero
insert into presupuestos (anio, mes, categoria_id, monto)
select 2026, 9, id, 2000 from categorias where nombre = 'Salud';
select pruebas.afirmar(
  pruebas.gastar('2026-09-10', 'Salud', 2000)
    = E'Salud: llegaste al 100% del presupuesto ($2,000 de $2,000)\nPresupuesto del mes: llegaste al 120% del presupuesto ($6,030 de $5,000)',
  'junta la alerta de la categoría y la del total');

-- Los gastos de otro mes no cuentan
select pruebas.afirmar(pruebas.gastar('2026-10-01', 'Comida', 900) is null, 'octubre no tiene presupuesto');

-- Los ingresos nunca avisan
insert into movimientos (fecha, tipo, categoria_id, importe)
select '2026-09-15', 'Ingreso', id, 99999 from categorias where nombre = 'Sueldo';
select pruebas.afirmar(
  alerta_presupuesto((select id from movimientos where tipo = 'Ingreso')) is null, 'un ingreso no avisa');

-- Nadie puede leer alertas ajenas
select id as ajeno from movimientos where fecha = '2026-09-07' \gset
select pruebas.como('f0000000-0000-0000-0000-000000000002');
select pruebas.afirmar(alerta_presupuesto(:'ajeno') is null, 'otro usuario no ve la alerta');
select pruebas.como(null);
select pruebas.espera_error(format('select alerta_presupuesto(%L)', :'ajeno'), 'permission denied');
reset role;

-- El atajo de Apple Pay regresa la alerta en su respuesta
select pruebas.como('f0000000-0000-0000-0000-000000000002');
select generar_token_atajo() as token \gset
insert into presupuestos (anio, mes, categoria_id, monto)
values (extract(year from now() at time zone 'America/Mexico_City'), extract(month from now() at time zone 'America/Mexico_City'), null, 100);
select pruebas.como(null);
select pruebas.afirmar(registrar_gasto_atajo(:'token', '50', 'Café') ->> 'alerta' is null, 'el atajo sin cruce regresa alerta nula');
select pruebas.afirmar(
  registrar_gasto_atajo(:'token', '40', 'Café') ->> 'alerta' = 'Presupuesto del mes: ya usaste el 90% del presupuesto ($90 de $100)',
  'el atajo regresa el texto para la notificación');
reset role;

-- Limpia para no afectar a las pruebas que corren después en la misma base
delete from auth.users where id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002');
