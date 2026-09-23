#!/usr/bin/env bash
# Aplica todas las migraciones en una base limpia y corre supabase/tests/*.test.sql.
#
# Usa el servidor indicado por las variables PG* (PGHOST, PGPORT, PGUSER, PGPASSWORD), como en CI.
# Si no hay PGHOST y tienes Postgres instalado (initdb), levanta un servidor temporal y lo borra al terminar.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
base=mis_finanzas_pruebas

if [[ -z "${PGHOST:-}" ]]; then
  command -v initdb >/dev/null || { echo "Define PGHOST o instala Postgres (initdb) para correr las pruebas SQL." >&2; exit 1; }
  temporal="$(mktemp -d)"
  export PGHOST=127.0.0.1 PGPORT="${PGPORT:-55433}" PGUSER=postgres
  initdb -D "$temporal/datos" -U postgres -A trust >/dev/null
  pg_ctl -D "$temporal/datos" -o "-p $PGPORT -h 127.0.0.1 -k ''" -l "$temporal/log" -w start >/dev/null
  trap 'pg_ctl -D "$temporal/datos" -m immediate stop >/dev/null; rm -rf "$temporal"' EXIT
fi

psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_q -d postgres -c "drop database if exists $base" -c "create database $base"
psql_q -d "$base" -f "$raiz/supabase/tests/00_entorno_supabase.sql"

for migracion in "$raiz"/supabase/migrations/*.sql; do
  echo "migración  $(basename "$migracion")"
  psql_q -d "$base" -f "$migracion"
done

fallas=0
for prueba in "$raiz"/supabase/tests/*.test.sql; do
  if salida="$(psql_q -d "$base" -f "$prueba" 2>&1 >/dev/null)"; then
    echo "ok         $(basename "$prueba")"
  else
    echo "FALLÓ      $(basename "$prueba")"
    echo "$salida" | sed 's/^/           /'
    fallas=$((fallas + 1))
  fi
done

psql_q -d postgres -c "drop database $base"
[[ $fallas -eq 0 ]] || { echo "$fallas archivo(s) de pruebas SQL fallaron." >&2; exit 1; }
echo "Pruebas SQL: todo en orden."
