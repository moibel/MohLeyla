#!/bin/sh
# Builds the combined "migration + permission tests" script. Paste it into the Supabase SQL editor and Run:
# it ends with a deliberate error that rolls EVERYTHING back; the error text is the pass/fail report.
cd "$(dirname "$0")/.." || exit 1
cat migrations/002_roles_classes.sql tests/roles_classes.test.sql
