-- Simula lo mínimo de Supabase para probar las migraciones en un Postgres normal:
-- roles anon/authenticated, auth.users, auth.uid() y los permisos por defecto del esquema public.
-- En las pruebas, auth.uid() lee la variable de sesión `prueba.uid`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- Ayudantes de aserción
create schema pruebas;
grant usage on schema pruebas to anon, authenticated;

create function pruebas.afirmar(condicion boolean, mensaje text) returns void
language plpgsql as $$
begin
  if condicion is distinct from true then
    raise exception 'FALLÓ: %', mensaje;
  end if;
end;
$$;

-- Ejecuta `sentencia` y exige que falle con un mensaje que contenga `patron`.
create function pruebas.espera_error(sentencia text, patron text) returns void
language plpgsql as $$
begin
  execute sentencia;
  raise exception 'FALLÓ: se esperaba el error «%» en: %', patron, sentencia;
exception when others then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
  if position(lower(patron) in lower(sqlerrm)) = 0 then
    raise exception 'FALLÓ: se esperaba «%» pero el error fue «%»', patron, sqlerrm;
  end if;
end;
$$;

-- Actúa como un usuario con sesión (o como anon si uid es null).
create function pruebas.como(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('prueba.uid', coalesce(uid::text, ''), false);
  execute format('set role %I', case when uid is null then 'anon' else 'authenticated' end);
end;
$$;

grant execute on all functions in schema pruebas to anon, authenticated;
