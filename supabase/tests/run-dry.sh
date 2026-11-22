#!/bin/sh
# Builds a combined "migration(s) + permission tests" script. Paste it into the Supabase SQL editor and Run:
# it ends with a deliberate error that rolls EVERYTHING back; the error text is the pass/fail report.
#   sh supabase/tests/run-dry.sh            -> roles and classes (002)
#   sh supabase/tests/run-dry.sh rewards    -> rewards (needs 002 applied; this script includes it so it also works on an empty copy)
cd "$(dirname "$0")/.." || exit 1
case "${1:-roles}" in
  rewards) cat migrations/002_roles_classes.sql migrations/003_rewards.sql tests/rewards.test.sql ;;
  *) cat migrations/002_roles_classes.sql tests/roles_classes.test.sql ;;
esac
