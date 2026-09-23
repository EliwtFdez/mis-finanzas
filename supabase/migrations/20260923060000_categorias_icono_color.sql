-- Ícono (un emoji) y color para reconocer cada categoría de un vistazo.
-- Nulos = la app muestra la inicial del nombre en gris.
-- La paleta evita el rojo y el ámbar: en la app significan presupuesto al límite.

alter table public.categorias
  add column icono text check (icono is null or char_length(icono) between 1 and 8),
  add column color text check (color is null or color ~ '^#[0-9A-F]{6}$');

-- Las categorías iniciales que ya existen reciben el ícono y color por defecto.
update public.categorias c
set icono = d.icono, color = d.color
from (values
  ('Vivienda',           '🏠', '#8A6A4A'),
  ('Comida',             '🍽️', '#2F6B4F'),
  ('Transporte',         '🚗', '#3A6EA5'),
  ('Servicios',          '💡', '#1F8A8A'),
  ('Salud',              '🩺', '#A8487A'),
  ('Entretenimiento',    '🎬', '#7A4E9C'),
  ('Compras',            '🛍️', '#4B5BA6'),
  ('Educación',          '📚', '#3A6EA5'),
  ('Deudas e intereses', '💳', '#5B6F66'),
  ('Otros',              '📦', '#5B6F66'),
  ('Sueldo',             '💼', '#2F6B4F'),
  ('Ingreso extra',      '✨', '#1F8A8A')
) as d (nombre, icono, color)
where c.nombre = d.nombre and c.icono is null and c.color is null;

create or replace function public.crear_categorias_iniciales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (user_id, nombre, tipo, orden, icono, color) values
    (new.id, 'Vivienda',           'Gasto',    1, '🏠', '#8A6A4A'),
    (new.id, 'Comida',             'Gasto',    2, '🍽️', '#2F6B4F'),
    (new.id, 'Transporte',         'Gasto',    3, '🚗', '#3A6EA5'),
    (new.id, 'Servicios',          'Gasto',    4, '💡', '#1F8A8A'),
    (new.id, 'Salud',              'Gasto',    5, '🩺', '#A8487A'),
    (new.id, 'Entretenimiento',    'Gasto',    6, '🎬', '#7A4E9C'),
    (new.id, 'Compras',            'Gasto',    7, '🛍️', '#4B5BA6'),
    (new.id, 'Educación',          'Gasto',    8, '📚', '#3A6EA5'),
    (new.id, 'Deudas e intereses', 'Gasto',    9, '💳', '#5B6F66'),
    (new.id, 'Otros',              'Gasto',   10, '📦', '#5B6F66'),
    (new.id, 'Sueldo',             'Ingreso', 11, '💼', '#2F6B4F'),
    (new.id, 'Ingreso extra',      'Ingreso', 12, '✨', '#1F8A8A');
  return new;
end;
$$;
