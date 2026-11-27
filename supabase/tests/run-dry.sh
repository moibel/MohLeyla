#!/bin/sh
# Builds a combined "migration(s) + permission tests" script. Paste it into the Supabase SQL editor and Run:
# it ends with a deliberate error that rolls EVERYTHING back; the error text is the pass/fail report.
#   sh supabase/tests/run-dry.sh            -> roles and classes 
#   sh supabase/tests/run-dry.sh announcements -> announcements (004)
#   sh supabase/tests/run-dry.sh switch        -> content switches (005)
#   sh supabase/tests/run-dry.sh chat          -> chat (007)
#   sh supabase/tests/run-dry.sh rewards    -> rewards
#   sh supabase/tests/run-dry.sh hardening  -> security hardening, block / report / suspend / terms (014); LOCAL ONLY (uses the stand-ins)
# Every suite runs against the FINAL state: all migrations 002-014 (needs 001 applied), then its tests.
cd "$(dirname "$0")/.." || exit 1
case "${1:-roles}" in
  announcements) suite=announcements ;;
  calls) suite=calls ;;
  switch) suite=content_switch ;;
  deletion) suite=account_deletion ;;
  push) suite=push ;;
  attachments) suite=chat_attachments ;;
  chat) suite=chat ;;
  rewards) suite=rewards ;;
  hardening) suite=security_hardening ;;
  *) suite=roles_classes ;;
esac
cat migrations/00[2-9]_*.sql migrations/01[0-4]_*.sql "tests/$suite.test.sql"
