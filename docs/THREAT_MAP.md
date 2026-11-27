# Threat map

Who might attack, what they want, what stops them, and what is left. Based on three code audits on 27 November 2026 (database, login and data, phone apps). It is not a human penetration test.

## What we protect
Accounts and sessions; learners' personal data and chats (including children aged 13-17); admin and teacher powers; chat files; the service keys; the availability of the app.

## Data flow
Person → website or phone app → (HTTPS) → Supabase (Auth, database with row rules, file storage, functions) → Apple/Google push. Lesson audio and the website come from Cloudflare. Calls go device to device; only set-up messages pass through the database. The weakest places are the boundary between the browser and the database (anyone can call it with the public key) and the shared or stolen device.

## Threats
Likelihood and impact: L / M / H.

| # | Threat | L | I | Defence | What remains |
|---|---|---|---|---|---|
| T1 | Anyone with the public key calls the database directly to read or change others' data | H | H | row rules, checked functions, no direct access to sensitive tables (S1-S6) | not tested against the live project from outside |
| T2 | Student becomes teacher or admin | L | H | roles writable only by admin function | audit found no path |
| T3 | Stolen or phished admin mailbox | M | H | email codes only, few admins | no second factor inside the app: protect the mailbox with 2-step verification |
| T4 | Crafted sign-in link puts someone into the attacker's account | M | M | PKCE, no tokens from links (L1-L2) | no verified App Links yet; another Android app can claim the custom link but cannot use the code |
| T5 | Next user of a shared device gets the previous account or progress | M | H | offline-safe sign-out, progress ownership (L4-L7) | set-aside progress is readable with technical access to the device |
| T6 | Abuse, grooming or harassment in chat or calls | M | H | teacher/admin start chats, block, report, suspend, admin review, 13+, terms | no automatic filter for text, photos or voice; nobody is alerted to new reports; age is self-declared |
| T7 | Guessing or sharing class codes to reach a teacher | M | M | secure codes, hidden from students, attempt limit, bans, new code | many accounts could still try slowly |
| T8 | Spam or filling storage | M | M | rate limits and quotas (S11-S12) | quota can be exceeded slightly by parallel uploads (not verified on real Supabase) |
| T9 | Removed or old files still downloadable | M | M | read rules and daily purge | an already-issued file link works up to 1 hour; **the purge must be deployed** |
| T10 | Many sign-up or code emails (email bombing, sender blocked) | M | M | one-minute wait in the app, Supabase limits | no CAPTCHA; Gmail sender has a daily limit and weak reputation |
| T11 | One user's bad data breaks admin or teacher screens | M | M | safe casts (S5) | - |
| T12 | Script injection steals the session stored in the browser | L | H | strict content security policy, no unsafe HTML | tokens live in browser storage |
| T13 | Leaked keys (service key, signing key, push keys) | M | H | git ignore rules, secrets only on the server | the owner's habits; rotate on any doubt |
| T14 | Dependency with a security flaw | M | M | few dependencies, `npm audit` before release | 2 moderate react-router advisories (server rendering only, not used) |
| T15 | Service outage or lost database | L | H | the app keeps progress on the device and works offline | backups depend on the Supabase plan |
| T16 | Calls reveal IP addresses | H | L | disclosed in the privacy policy | a TURN relay would hide them (not set up) |
