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
| `tests/roles_classes.test.sql` | 39 permission checks run as real database users (student, teacher, admin, signed-out). |
| `tests/rewards.test.sql` | 29 permission checks for the rewards (who can grant / list / revoke, validation, matching by email, revoke). |
| `tests/run-dry.sh [roles\|rewards\|announcements\|switch]` | Builds `migration + tests` into one script. |
| `tests/run-local.sh [roles\|rewards\|announcements\|switch]` | Runs the same tests on a throwaway local Postgres (stand-in for Supabase in `tests/local-stub.sql`); no Supabase needed. |

## Test the permissions without changing anything
1. `sh supabase/tests/run-dry.sh` prints the combined script.
2. Paste it into Supabase -> SQL Editor and Run (choose *Run without RLS* if asked).
3. The script ends with a **deliberate error** so Postgres rolls everything back (the migration, the fake users, everything).
   The error text is the report: `TEST REPORT ...: 39 passed, 0 failed`.

## Apply the migration for real
Run `migrations/002_roles_classes.sql` on its own (then `003_rewards.sql` for rewards and `004_announcements.sql` for announcements, `006_announcements_pro.sql` for one-person messages and looks, and `005_content_switch.sql` for the lesson switches; all additive). Then make yourself admin (once, with SQL; roles cannot be changed from the browser):

```sql
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'YOUR-EMAIL');
```
