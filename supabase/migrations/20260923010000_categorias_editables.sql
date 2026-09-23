-- Categorías editables desde la app.
-- Una categoría con movimientos no puede cambiar de tipo: dejaría gastos en una categoría de ingresos.

create function public.validar_cambio_tipo_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo <> old.tipo and exists (select 1 from public.movimientos m where m.categoria_id = old.id) then
    raise exception 'La categoría % ya tiene movimientos; no puede cambiar de tipo.', old.nombre using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger categorias_validar_tipo
before update of tipo on public.categorias
for each row execute function public.validar_cambio_tipo_categoria();

-- El nombre no puede quedar vacío ni repetido ignorando mayúsculas y espacios.
alter table public.categorias drop constraint categorias_user_id_nombre_key;
create unique index categorias_nombre_unico on public.categorias (user_id, lower(trim(nombre)));
