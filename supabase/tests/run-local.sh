#!/bin/sh
# Runs a permission test on a scratch local Postgres (no Supabase needed): sh supabase/tests/run-local.sh [roles|rewards|announcements|switch|chat|attachments|calls|push|deletion|hardening]
# Creates and drops a throwaway database named mohleyla_dryrun. Everything inside also rolls back by design.
cd "$(dirname "$0")/.." || exit 1
DB=mohleyla_dryrun
dropdb -h "${PGHOST:-/tmp}" --if-exists "$DB" && createdb -h "${PGHOST:-/tmp}" "$DB" || exit 1
psql -h "${PGHOST:-/tmp}" -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/local-stub.sql -f migrations/001_progress.sql || exit 1
sh tests/run-dry.sh "${1:-roles}" | psql -h "${PGHOST:-/tmp}" -q -d "$DB" 2>&1 | sed -n '/TEST REPORT/,$p' | head -120
dropdb -h "${PGHOST:-/tmp}" "$DB"
