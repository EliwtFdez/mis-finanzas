-- Compras y Transporte quedaban con el mismo azul por defecto: son dos de las categorías más
-- frecuentes y en la barra de reparto no se distinguían. Compras pasa a rosa (lo comparte con
-- Salud, que suele ser menor). Solo cambia las que siguen con el color por defecto.

update public.categorias
set color = '#E87BA4'
where nombre = 'Compras' and color = '#2A78D6';

create or replace function public.crear_categorias_iniciales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (user_id, nombre, tipo, orden, icono, color) values
    (new.id, 'Vivienda',           'Gasto',    1, '🏠', '#EB6834'),
    (new.id, 'Comida',             'Gasto',    2, '🍽️', '#008300'),
    (new.id, 'Transporte',         'Gasto',    3, '🚗', '#2A78D6'),
    (new.id, 'Servicios',          'Gasto',    4, '💡', '#1BAF7A'),
    (new.id, 'Salud',              'Gasto',    5, '🩺', '#E87BA4'),
    (new.id, 'Entretenimiento',    'Gasto',    6, '🎬', '#4A3AA7'),
    (new.id, 'Compras',            'Gasto',    7, '🛍️', '#E87BA4'),
    (new.id, 'Educación',          'Gasto',    8, '📚', '#1BAF7A'),
    (new.id, 'Deudas e intereses', 'Gasto',    9, '💳', null),
    (new.id, 'Otros',              'Gasto',   10, '📦', null),
    (new.id, 'Sueldo',             'Ingreso', 11, '💼', '#008300'),
    (new.id, 'Ingreso extra',      'Ingreso', 12, '✨', '#1BAF7A');
  return new;
end;
$$;
