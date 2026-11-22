# Accounts and cloud sync (optional)

MohLeyla works fully **offline and without an account**. Accounts add one thing: progress syncs between devices
(phone, tablet, laptop) and survives clearing the browser. Everything is built on [Supabase](https://supabase.com)
(free plan is enough for a family and a class).

## What is stored
Per learner: the **email address** (for sign-in), an optional **display name** (stored in the account's user metadata; for Google users also the Google name and a link to their Google profile picture), and **one JSON document of learning progress**
(XP, completed lessons, saved words, review schedule, streak, speaking self-ratings). Voice recordings are never stored.
There is no analytics, no tracking, no advertising. Interface settings (language, speed, theme) stay on the device.

Children: under 13 should use a parent's or teacher's email (the app says so). Make sure you have the parents' consent
before enrolling students, and tell them what is stored (the text above).

## One-time setup (about 10 minutes)

1. **Create the table.** Supabase Dashboard -> *SQL Editor* -> *New query* -> paste `supabase/migrations/001_progress.sql` -> *Run*.
   It creates `public.progress` with Row Level Security: a signed-in user can only touch their own row.
2. **Allow your site URLs.** *Authentication -> URL Configuration*:
   - Site URL: `https://mohleyla.pages.dev`
   - Redirect URLs: `https://mohleyla.pages.dev/**` and `http://localhost:5173/**`
3. **(Optional) Make the email show a code.** *Requires custom SMTP first: Supabase does not allow editing templates on its built-in sender.* Without it, sign-in works by clicking the link in the email (the app always shows both the code box and the link option). With it: *Authentication -> Email Templates -> Magic Link*: add the code (`{{ .Token }}`, 8 digits by default) to BOTH the *Confirm sign up* template (new learners) and the *Magic link or OTP* template (returning learners), so people can sign
   in on a phone without leaving the app, for example:
   ```html
   <h2>Your MohLeyla sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">sign in with one click</a>.</p>
   ```
   (*Authentication -> Providers -> Email*: keep "Confirm email" off or on, both work with codes. Code length 6, expiry 1 hour is fine.)
4. **Give the app the two public values** (they are committed in `.env.production`; a host dashboard variable overrides them, so this is only needed when you change project). *Project Settings -> API*: copy the **Project URL** and the **anon / publishable key**.
   - Local: copy `.env.example` to `.env.local` and fill both.
   - Netlify: *Site configuration -> Environment variables* -> add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
   Leave "Contains secret values" unchecked: both are public by design. `netlify.toml` sets `SECRETS_SCAN_OMIT_KEYS` so Netlify's secrets scanner does not fail the build because they appear in the bundle.
   Never use or share the `service_role` key.
5. Open the app -> *Settings -> Account & sync*.

### Important: email limits on the free plan
Supabase's built-in email sender is for testing: only about **2-4 emails per hour** project-wide. For a class or family
that will hit the limit ("Too many emails" in the app). Fix: *Authentication -> SMTP Settings* -> connect your own SMTP
(Resend, Brevo, Gmail SMTP, etc. all have free tiers). Do this before onboarding students.

## Continue with Google (optional)

Adds a **Continue with Google** button above the email option (sign-in and first-time registration are the same step).
You do the Google part (it is your Google account); the app part is already built.

1. **Google Cloud Console** (console.cloud.google.com): create or pick a project.
2. **Google Auth Platform / OAuth consent screen**: app name `MohLeyla`, a support email, audience **External**, and **Publish** the app.
   Only the basic scopes (`openid`, email, profile) are used, so no Google verification is needed. If you leave it in *Testing*, only
   listed test users can sign in. Add `flswmuuvimgoewlrqizs.supabase.co` as an authorized domain.
3. **Credentials -> Create credentials -> OAuth client ID -> Web application**:
   - Authorized JavaScript origins: `https://mohleyla.netlify.app` (and `http://localhost:5173` for local work)
   - Authorized redirect URI: `https://flswmuuvimgoewlrqizs.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
4. **Supabase -> Authentication -> Sign In / Providers -> Google**: enable it, paste the Client ID and Client secret, Save.
   The client secret lives only in Supabase; it never goes in the app, Netlify, or GitHub.
5. **Netlify**: add `VITE_GOOGLE_SIGN_IN` = `true`, then deploy (the setting is baked in at build time).

Notes: Supabase links accounts that share the same verified email, so someone who signed in by email code and later uses Google with the
same address keeps one account and one progress. Under-13 learners can use a Google account managed by a parent (Family Link) or the email option.

## Requiring sign-in (one email per learner)

Set `VITE_REQUIRE_SIGN_IN=true` (Netlify -> Environment variables, next to the two Supabase values; those two are also required) and redeploy.
Then nothing in the app is shown until the learner has signed in with their own email.

- **Identification, not security.** The gate decides who the progress belongs to. It is a front-end screen; a technical user can bypass it
  on their own device. The progress data itself is protected in the cloud by row-level security.
- **One email = one learner.** Siblings cannot share an email. With Gmail, plus-addresses work: `parent+amina@gmail.com`,
  `parent+omar@gmail.com` arrive in the same inbox but are separate accounts.
- **Offline.** The first sign-in needs internet. After that the sign-in is remembered, so reopening works offline.
- **Existing progress** on a device is kept and uploaded to the account at first sign-in.
- **Shared devices.** *Sign out* first saves everything to the account, then removes the progress from the device, so the next
  person starts clean. If the save fails (for example offline) the app asks before discarding anything.
- **Teachers.** There is no teacher dashboard yet; each learner's progress lives in their own row in Supabase.

## How sync works (and its limits)
- **Local first.** The app always reads and writes the local copy. Sync runs in the background a few seconds after a change,
  when the app comes back to the foreground, and when the network returns.
- **Merge, never overwrite.** Progress from two devices is merged with a conflict-free rule (`src/features/progress/merge.js`):
  completed lessons and saved words are unioned (an un-save on one device is respected), best scores and counters take the
  larger value, the most recent review entry wins, and **XP is counted per device and summed**, so two devices never lose or
  double-count XP. Merging is order-independent and safe to repeat (covered by property tests).
- **Shared devices.** If a different account signs in on a device that already has progress, the app asks: combine, use the
  account's progress, or cancel. Handy for a shared family tablet.
- **Known limits.** Per-day XP and the answered/correct counters use "largest value wins" when two devices were used on the
  same day, so those *statistics* can slightly undercount (total XP does not). Two devices editing at the very same second
  resolve to whichever synced last for streak/review entries; no lesson completion or XP is ever lost.
- **Offline.** Everything works; sync resumes when you are online again.

## Deleting data
*Settings -> Account & sync -> Delete my cloud data* removes the learner's cloud progress row and signs out (progress on the
device stays). The sign-in identity (email) itself can be deleted by the project owner in *Authentication -> Users*.
"Reset all progress" also deletes the cloud copy when signed in, so it cannot come back on the next sync.

## Roles, classes and the admin page
Every account has one role: **student** (default), **teacher** or **admin**. Roles live in the database (`public.profiles`) and
can only be changed through `admin_set_role()`, which checks that the caller is an admin; the browser cannot change them.

- **Admin** (`/admin`): searchable list of every account (name, email, sign-in method, role, XP, lessons, last active) and a role
  selector with a confirmation step. The last admin cannot be demoted.
- **Teacher** (`/teach`): create a class, share its 8-character join code, see each student's summary (name, email, XP, lessons,
  streak, accuracy, last active), remove a student or delete a class. A teacher never receives a student's raw progress document.
- **Student** (`/classes`): join a class with a code (joining is the consent to be seen by that teacher) and leave at any time.

Setup: run `supabase/migrations/002_roles_classes.sql` once in the Supabase SQL editor, then make yourself admin
(Table editor -> `profiles` -> set your row's `role` to `admin`). After that, assign teachers from the Admin page.
`supabase/tests/roles_classes.test.sql` checks 39 permission rules as real database users and rolls itself back; see `supabase/README.md`.

## Rewards from the admin
An admin can give **stars**, **bonus XP** or a named **badge** to any email address from *Admin -> Rewards* (or the gift button on a user row),
with an optional reason, and can take a reward back (it stays in the history, marked "taken back").

- Rewards are stored in the database (`public.rewards`) and are only readable or writable through admin-checked functions, so nobody can give themselves one.
- Matching is by the e-mail of the signed-in account. Someone who has not signed up yet receives the reward at their first sign-in.
- Limits: stars 1-1000, bonus XP 1-10000 per grant, badge name up to 40 characters, reason up to 140.
- Bonus XP is added to the XP totals shown in the app but **not** to the daily goal, the streak or the learning achievements. The learner is told once, and sees stars, bonus XP and badges on the profile page.
- Setup: run `supabase/migrations/003_rewards.sql` once (after 002). Tests: `sh supabase/tests/run-local.sh rewards`.

## Announcements
An admin can post a message from *Admin -> Announcements* to **everyone** or to the students of **one class**. Write the title and message in one, two or all three languages: each learner sees their own language, else English, else the first one written. Optionally choose a date after which it stops showing; an announcement can be archived at any time (it stays in the history).

- Learners see the two newest on the home page (each can be closed there) and all current ones on their profile page.
- Titles up to 80 characters, messages up to 600, shown as plain text only.
- Stored behind admin-checked functions (`supabase/migrations/004_announcements.sql`, 27 permission checks): nobody but an admin can post, and a learner only reads what is meant for them.
- Setup: run `supabase/migrations/004_announcements.sql` once (after 002). Tests: `sh supabase/tests/run-local.sh announcements`.

## Testing status
Unit tests cover the merge rules and the sync manager against an in-memory fake. Browser tests run the full sign-in and
two-device flow against a **mocked** Supabase API. Not yet exercised against a real Supabase project, real emails, or real
phones; do the checklist in `docs/TESTING.md` before enrolling students.
