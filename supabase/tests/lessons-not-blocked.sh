#!/bin/sh
# The chat word filter must never refuse ordinary course language: every lesson sentence and translation, in every course, is
# run through the real database function (migration 015) on a scratch local Postgres.   sh supabase/tests/lessons-not-blocked.sh
cd "$(dirname "$0")/.." || exit 1
H="${PGHOST:-/tmp}"; DB=mohleyla_lessons
dropdb -h "$H" --if-exists "$DB" && createdb -h "$H" "$DB" || exit 1
psql -h "$H" -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/local-stub.sql -f migrations/001_progress.sql >/dev/null 2>&1 || exit 1
cat migrations/00[2-9]_*.sql migrations/01[0-9]_*.sql | psql -h "$H" -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null 2>&1 || { echo "migrations failed"; exit 1; }
{ echo "create table lesson_text(t text); copy lesson_text from stdin;"
  node -e '
    const fs = require("fs"), path = require("path"); const dir = path.resolve("../src/data/content"); const all = new Set();
    const walk = (v) => { if (typeof v === "string") all.add(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
    for (const t of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, t))) walk(JSON.parse(fs.readFileSync(path.join(dir, t, f), "utf8")));
    process.stdout.write([...all].map((s) => s.replace(/\\/g, "\\\\").replace(/[\t\r\n]+/g, " ")).join("\n") + "\n");'
  echo '\.'
  echo "select 'checked ' || count(*) || ' lesson texts, blocked ' || count(*) filter (where public.text_is_blocked(t)) from lesson_text;"
  echo "select 'BLOCKED: ' || t from lesson_text where public.text_is_blocked(t) limit 30;"
} | psql -h "$H" -At -v ON_ERROR_STOP=1 -d "$DB"
dropdb -h "$H" "$DB"
