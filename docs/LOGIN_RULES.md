# Login rules

## How sign-in works
- **Required:** the website and the phone apps open only after sign-in (`VITE_REQUIRE_SIGN_IN=true`). This screen is a convenience; the database is what protects data.
- **Methods:** email one-time code (the email has the code, no link), Google, and Sign in with Apple (always on iPhone). There are no passwords in the app.
- **New accounts** are created by the first successful sign-in.
- **First sign-in set-up** (before any lesson): confirm 13 or older and accept the terms (both required), choose languages, level for each, and daily goal. Saved in the account and recorded in the database (`accept_terms`). Asked again only if the terms version changes (`TERMS_VERSION` in `src/features/welcome/plan.js`). Languages and levels can be changed in Settings. A remembered person who is offline is not locked out.

## Rules
| # | Rule |
|---|---|
| L1 | Sign-in uses PKCE: a link or app link carries only a one-time code that works only on the device that started it. Ready-made tokens in a link are refused. |
| L2 | The phone apps accept only `com.mohleyla.app://auth?code=...`, listen only while a sign-in is pending (5 minutes at most), one listener at a time. |
| L3 | One minute must pass before "send again". The server's own limits still apply (check them in Supabase). |
| L4 | **Sign-out is for this device only** and always removes the stored session, even offline. |
| L5 | On a device that requires sign-in, sign-out saves progress first, asks before discarding anything unsaved, then clears the device. |
| L6 | Progress is never merged into another account. If someone else signs in, the previous person's unsynced progress is set aside and comes back when they return. Progress made without any account asks before it is combined with an account that already has progress. |
| L7 | A sync that is running when the person signs out writes nothing back. |
| L8 | Signing out removes the person's cached announcements and rewards, and the phone stops receiving their notifications (if the server cannot be reached, the phone's registration is switched off). |
| L9 | Deleting an account needs the person's own sign-in token; the last admin cannot be deleted. See `ACCOUNT_DELETION.md`. |

Checks: `src/test/sync.test.js`, `security.test.js`, `push.test.js`, `tests/e2e/gate.spec.js`, `welcome.spec.js`, `accounts.spec.js`.

## Supabase settings these rules depend on (check by hand; code cannot)
- Authentication → Providers → Email: **Confirm email ON**.
- Authentication → URL Configuration: Site URL is the live address; Redirect URLs list exact addresses (`https://mohleyla.pages.dev/**` only if needed, `com.mohleyla.app://auth`), no other sites.
- Email OTP expiry 1 hour or less; review Rate Limits.
- Email templates "Confirm signup" and "Magic link or OTP" show `{{ .Token }}` and no link.
