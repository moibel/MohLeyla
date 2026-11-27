#!/bin/sh
# Checks supabase/seed/review_accounts.sql on a scratch local Postgres:   sh supabase/tests/review_seed.test.sh
cd "$(dirname "$0")/.." || exit 1
H="${PGHOST:-/tmp}"; DB=mohleyla_seed
dropdb -h "$H" --if-exists "$DB" >/dev/null 2>&1; createdb -h "$H" "$DB" || exit 1
Q() { psql -h "$H" -At -v ON_ERROR_STOP=1 -d "$DB" "$@" 2>&1; }
Q -q -f tests/local-stub.sql -f migrations/001_progress.sql >/dev/null || exit 1
cat migrations/00[2-9]_*.sql migrations/01[0-9]_*.sql | Q -q >/dev/null || { echo "migrations failed"; exit 1; }
T=mohleyla.support+review-teacher@gmail.com; S=mohleyla.support+review-student@gmail.com
Q -q -c "insert into auth.users (id,aud,role,email,raw_user_meta_data,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000b1','authenticated','authenticated','$T','{}',now()),
 ('00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','$S','{}',now()),
 ('00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','boss+review@test.local','{}',now()),
 ('00000000-0000-0000-0000-0000000000c9','authenticated','authenticated','real.learner@test.local','{}',now());
 update public.profiles set role='admin' where user_id='00000000-0000-0000-0000-0000000000a1';" >/dev/null
seed() { sed -e "s/REPLACE-teacher-review@example.com/$1/" -e "s/REPLACE-student-review@example.com/$2/" seed/review_accounts.sql | Q -q; }
pass=0; fail=0; ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 (got: $2)"; fi; }
has() { case "$2" in *"$3"*) ok "$1" y y ;; *) ok "$1" "$2" y ;; esac; }
state() { Q -c "select concat_ws(',', (select role from public.profiles where user_id='00000000-0000-0000-0000-0000000000b1'), (select role from public.profiles where user_id='00000000-0000-0000-0000-0000000000c1'), (select count(*) from public.classes), (select count(*) from public.class_members), (select count(*) from public.conversations), (select count(*) from public.chat_messages), (select count(*) from public.chat_blocks), (select count(*) from public.suspensions))"; }
has "untouched placeholders are refused" "$(seed REPLACE-teacher-review@example.com REPLACE-student-review@example.com)" "create both users first"
has "an address without the word review is refused" "$(seed $T real.learner@test.local)" "must contain the word"
has "an admin is refused" "$(seed boss+review@test.local $S)" "admin account must never"
has "the same account twice is refused" "$(seed $T $T)" "two different accounts"
ok "refusals change nothing" "$(state)" "student,student,0,0,0,0,0,0"
has "first run succeeds" "$(seed $T $S)" "review accounts are ready"
ok "teacher, student, one class, member, chat and welcome message" "$(state)" "teacher,student,1,1,1,1,0,0"
has "second run succeeds" "$(seed $T $S)" "review accounts are ready"
ok "running again adds nothing twice" "$(state)" "teacher,student,1,1,1,1,0,0"
Q -q -c "delete from public.class_members; insert into public.chat_blocks (conversation_id, blocker_id) select id, '00000000-0000-0000-0000-0000000000c1' from public.conversations; insert into public.suspensions (user_id) values ('00000000-0000-0000-0000-0000000000c1'); update public.chat_messages set removed_at=now();" >/dev/null
has "run after a reviewer blocked, left and was suspended" "$(seed $T $S)" "review accounts are ready"
ok "everything is restored" "$(state)" "teacher,student,1,1,1,2,0,0"
ok "the teacher really teaches the student (may start chats and calls)" "$(Q -c "select public.teaches_student('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1')")" t
ok "the real learner was never touched" "$(Q -c "select role from public.profiles where user_id='00000000-0000-0000-0000-0000000000c9'")" student
dropdb -h "$H" "$DB"
echo "TEST REPORT: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
