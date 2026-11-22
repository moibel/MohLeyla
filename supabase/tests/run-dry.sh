#!/bin/sh
# Builds a combined "migration(s) + permission tests" script. Paste it into the Supabase SQL editor and Run:
# it ends with a deliberate error that rolls EVERYTHING back; the error text is the pass/fail report.
#   sh supabase/tests/run-dry.sh            -> roles and classes (002)
#   sh supabase/tests/run-dry.sh announcements -> announcements (004)
#   sh supabase/tests/run-dry.sh switch        -> content switches (005)
#   sh supabase/tests/run-dry.sh chat          -> chat (007)
#   sh supabase/tests/run-dry.sh rewards    -> rewards (needs 002 applied; this script includes it so it also works on an empty copy)
cd "$(dirname "$0")/.." || exit 1
case "${1:-roles}" in
  announcements) cat migrations/002_roles_classes.sql migrations/003_rewards.sql migrations/004_announcements.sql migrations/006_announcements_pro.sql tests/announcements.test.sql ;;
  switch) cat migrations/002_roles_classes.sql migrations/005_content_switch.sql tests/content_switch.test.sql ;;
  calls) cat migrations/002_roles_classes.sql migrations/007_chat.sql migrations/008_chat_attachments.sql migrations/010_calls.sql tests/calls.test.sql ;;
  switch) cat migrations/002_roles_classes.sql migrations/005_content_switch.sql migrations/009_content_switch_languages.sql tests/content_switch.test.sql ;;
  attachments) cat migrations/002_roles_classes.sql migrations/007_chat.sql migrations/008_chat_attachments.sql tests/chat_attachments.test.sql ;;
  chat) cat migrations/002_roles_classes.sql migrations/007_chat.sql tests/chat.test.sql ;;
  rewards) cat migrations/002_roles_classes.sql migrations/003_rewards.sql tests/rewards.test.sql ;;
  *) cat migrations/002_roles_classes.sql tests/roles_classes.test.sql ;;
esac
