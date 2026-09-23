-- Paleta de categorías validada para daltonismo y visión normal (la anterior tenía pares
-- indistinguibles, p. ej. azul e índigo). Remapea los colores ya guardados y los de las cuentas nuevas.

update public.categorias
set color = case color
  when '#2F6B4F' then '#008300'  -- verde
  when '#1F8A8A' then '#1BAF7A'  -- turquesa → aqua
  when '#3A6EA5' then '#2A78D6'  -- azul
  when '#4B5BA6' then '#2A78D6'  -- índigo → azul
  when '#7A4E9C' then '#4A3AA7'  -- morado → violeta
  when '#A8487A' then '#E87BA4'  -- rosa → magenta
  when '#8A6A4A' then '#EB6834'  -- café → naranja
  when '#5B6F66' then null       -- gris → neutro de la app
  else color
end
where color is not null;

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
    (new.id, 'Compras',            'Gasto',    7, '🛍️', '#2A78D6'),
    (new.id, 'Educación',          'Gasto',    8, '📚', '#1BAF7A'),
    (new.id, 'Deudas e intereses', 'Gasto',    9, '💳', null),
    (new.id, 'Otros',              'Gasto',   10, '📦', null),
    (new.id, 'Sueldo',             'Ingreso', 11, '💼', '#008300'),
    (new.id, 'Ingreso extra',      'Ingreso', 12, '✨', '#1BAF7A');
  return new;
end;
$$;
