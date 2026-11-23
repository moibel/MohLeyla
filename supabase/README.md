# Supabase

| File | What |
| --- | --- |
| `migrations/001_progress.sql` | The `progress` table (one row per learner) with row-level security. |
| `migrations/002_roles_classes.sql` | Roles (student / teacher / admin), classes with join codes, and the admin/teacher functions. All permissions are enforced in the database. |
| `migrations/003_rewards.sql` | Admin-given rewards (stars, bonus XP, named badges) by email address. No direct table access; admin-only functions; learners read their own. |
| `migrations/004_announcements.sql` | Admin announcements to everyone or one class, in ar/en/id, with optional expiry and archiving. No direct table access; admin-only functions. |
| `migrations/006_announcements_pro.sql` | Announcements to ONE person (by e-mail) and a look for each (info / celebrate / alert). Needs 002, 003, 004. |
| `tests/announcements.test.sql` | 40 permission and validation checks for announcements (004 + 006). |
| `migrations/005_content_switch.sql` | Admin switches to hide / show a whole learning path or single lessons. Readable by everyone (public configuration), changeable only by admins. |
| `tests/content_switch.test.sql` | 21 checks for the content switches. |
| `migrations/007_chat.sql` | Private one-to-one chat (admin with anyone, teacher with own students), admin read-only access to all chats, message removal, unread counts. No direct table access. |
| `tests/chat.test.sql` | 40 permission checks for chat (who can start, read, write; outsiders; admin read-only; removal; rate limit). |
| `migrations/008_chat_attachments.sql` | Voice notes and photos in chat: a private storage bucket with per-conversation access, 90-day expiry, `send_attachment`, admin clean-up list. Needs 007. |
| `tests/chat_attachments.test.sql` | 43 checks for attachments (uploads, reads, expiry, validation). Locally it uses a storage stand-in in `local-stub.sql`. |
| `migrations/010_calls.sql` | Private one-to-one voice and video calls started from a chat (admin: anyone; teacher: own students); call state and connection messages only, nothing recorded. Needs 007 and 008. |
| `tests/calls.test.sql` | 44 checks for calls (who can start, answer, poll; outsiders and admins cannot listen in; chat lines; rate limit). |
| `migrations/011_push.sql` | Phone notification tokens and the hooks that tell the push Edge Function about new messages, incoming calls, announcements and rewards. Needs 002-010 and the `pg_net` extension. Does nothing until a push address is stored in `push_config`; setup in `docs/PUSH_NOTIFICATIONS.md`. |
| `functions/push/` | The Edge Function that sends to Apple (APNs) and Google (FCM). |
| `tests/push.test.sql` | 39 checks for push (tokens, who is notified, no message text in notifications, failures never block the action). Needs the `net` stand-in in `local-stub.sql` locally. |
| `migrations/012_account_deletion.sql` | Helpers for deleting an account (service role only): list chat files, refuse the last admin, remove data stored by e-mail. Needs 002-011. Setup in `docs/ACCOUNT_DELETION.md`. |
| `functions/delete-account/` | The Edge Function behind Settings -> Delete my account (also revokes the Apple token). |
| `tests/account_deletion.test.sql` | 25 checks: only the service role can call the helpers, last-admin guard, the file list, and exactly what the cascade removes and keeps. |
| `tests/roles_classes.test.sql` | 39 permission checks run as real database users (student, teacher, admin, signed-out). |
| `tests/rewards.test.sql` | 29 permission checks for the rewards (who can grant / list / revoke, validation, matching by email, revoke). |
| `tests/run-dry.sh [roles\|rewards\|announcements\|switch\|chat\|attachments\|calls\|push]` | Builds `migration + tests` into one script. |
| `tests/run-local.sh [roles\|rewards\|announcements\|switch\|chat\|attachments\|calls\|push]` | Runs the same tests on a throwaway local Postgres (stand-in for Supabase in `tests/local-stub.sql`); no Supabase needed. |

## Test the permissions without changing anything
1. `sh supabase/tests/run-dry.sh` prints the combined script.
2. Paste it into Supabase -> SQL Editor and Run (choose *Run without RLS* if asked).
3. The script ends with a **deliberate error** so Postgres rolls everything back (the migration, the fake users, everything).
   The error text is the report: `TEST REPORT ...: 39 passed, 0 failed`.

## Apply the migration for real
Run `migrations/002_roles_classes.sql` on its own (then `003_rewards.sql` for rewards and `004_announcements.sql` for announcements, `006_announcements_pro.sql` for one-person messages and looks, `005_content_switch.sql` for the lesson switches and `007_chat.sql` for chat; all additive). Then make yourself admin (once, with SQL; roles cannot be changed from the browser):

```sql
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'YOUR-EMAIL');
```
