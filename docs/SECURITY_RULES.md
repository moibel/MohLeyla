# Security rules

These are the rules the app and the database follow. Each says where it is enforced and what checks it. Change a rule only together with its check.

## Access (database)
| # | Rule | Enforced in | Checked by |
|---|---|---|---|
| S1 | Every table has row level security; sensitive tables have no direct browser access and are reached only through checked functions. | migrations 001-014 | `src/test/security.test.js`, `api-contract.test.js`, `supabase/tests/*` |
| S2 | Every `security definer` function pins `search_path` and checks who is calling. No admin, chat, call or report function is granted to signed-out visitors. | migrations | same |
| S3 | Roles (student, teacher, admin) can be changed only by an admin through `admin_set_role`; the last admin cannot be removed. The role shown in the app only decides which links appear. | 002 | `roles_classes.test.sql` |
| S4 | A demoted teacher loses the roster, chat, calls and the class code at once. | 014 | `security_hardening.test.sql` |
| S5 | Data a person writes themselves (progress, name) is never trusted: casts are safe, values are clamped, names are cleaned and shortened. | 014, `profile.js` | hardening tests, `profile.test.js` |
| S6 | Data addressed by email (rewards, personal announcements) needs a confirmed email. | 014 | hardening tests |
| S7 | Class codes cannot be read by students, are made from a secure random source, join attempts are limited (10 an hour), a removed student cannot rejoin, and the teacher can replace the code. | 014 | hardening tests |

## Chat, files and calls
| # | Rule |
|---|---|
| S8 | Only the two people can read or write a chat; admins can read all chats and remove messages, never write in other people's chats. |
| S9 | Anyone in a chat can **block** the other person and **report** them or a message. While blocked: no messages, files or calls. |
| S10 | A **suspended** account cannot send messages or files, start chats or calls, or create or join classes. Admins cannot be suspended. |
| S11 | Chat files: private storage, 5 MB, images and audio only, exact file names, 60 uploads an hour and 200 MB per person. A removed message's file is unreadable at once; files older than 90 days are unreadable and are deleted by the daily `purge-files` job. |
| S12 | Rate limits (per person): 20 messages a minute, 10 calls per 10 minutes, 10 reports an hour. |
| S13 | Calls are not recorded. Connection details are deleted when the call ends or within about a day. |

## App and hosting
| # | Rule | Checked by |
|---|---|---|
| S14 | Content security policy: scripts only from the app, no inline script or eval, network only to the app, its Supabase project and the audio host. Change it only in `scripts/csp.mjs`. | `security.test.js`, `tests/e2e/security.spec.js` |
| S15 | No service-role or secret key in the app, the phone projects or git. Signing keys and service files are git-ignored. | `security.test.js` |
| S16 | Server functions authenticate every request themselves (the user's token, or a shared secret compared in constant time). Secrets live only as Edge Function secrets. | function tests |
| S17 | Phone apps: no cleartext traffic, no Android backups, only the permissions in use, only the bundled app is loaded. | `security.test.js` |

## People and process
- Admin accounts are the most powerful: use few of them, each with its own email, with 2-step verification on that mailbox and on the Supabase, GitHub, Cloudflare, Google, Apple accounts.
- Never paste keys, passwords or codes into chat, issues or screenshots. If one leaks, replace it the same day.
- Check the admin **Reports** tab every day (the app does not alert you). The terms say reports are handled within 24 hours as an aim.
- Before each release: `npm run check`, `npm run test:e2e`, `sh supabase/tests/run-local.sh <name>` for every suite, and `npm audit`.
