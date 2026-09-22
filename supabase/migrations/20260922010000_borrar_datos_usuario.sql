-- Borra en una sola transacción todos los datos financieros del usuario actual.
-- Conserva la cuenta de autenticación y las categorías para que pueda seguir usando la app.
create or replace function public.borrar_todos_mis_datos()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para borrar tus datos.' using errcode = 'P0001';
  end if;

  delete from public.presupuestos where user_id = (select auth.uid());
  delete from public.operaciones where user_id = (select auth.uid());
  delete from public.movimientos where user_id = (select auth.uid());
end;
$$;

revoke all on function public.borrar_todos_mis_datos() from public;
grant execute on function public.borrar_todos_mis_datos() to authenticated;
