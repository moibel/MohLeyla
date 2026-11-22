# Accounts and cloud sync (optional)

MohLeyla works fully **offline and without an account**. Accounts add one thing: progress syncs between devices
(phone, tablet, laptop) and survives clearing the browser. Everything is built on [Supabase](https://supabase.com)
(free plan is enough for a family and a class).

## What is stored
Only two things, per learner: the **email address** (for sign-in) and **one JSON document of learning progress**
(XP, completed lessons, saved words, review schedule, streak, speaking self-ratings). Voice recordings are never stored.
There is no analytics, no tracking, no advertising. Interface settings (language, speed, theme) stay on the device.

Children: under 13 should use a parent's or teacher's email (the app says so). Make sure you have the parents' consent
before enrolling students, and tell them what is stored (the text above).

## One-time setup (about 10 minutes)

1. **Create the table.** Supabase Dashboard -> *SQL Editor* -> *New query* -> paste `supabase/schema.sql` -> *Run*.
   It creates `public.progress` with Row Level Security: a signed-in user can only touch their own row.
2. **Allow your site URLs.** *Authentication -> URL Configuration*:
   - Site URL: `https://mohleyla.netlify.app`
   - Redirect URLs: `https://mohleyla.netlify.app/**`, `https://*--mohleyla.netlify.app/**` (Netlify deploy previews),
     `http://localhost:5173/**`
3. **(Optional) Make the email show a code.** *Requires custom SMTP first: Supabase does not allow editing templates on its built-in sender.* Without it, sign-in works by clicking the link in the email (the app shows a link-first screen with an optional "I have a code" box). With it: *Authentication -> Email Templates -> Magic Link*: add the 6-digit code so people can sign
   in on a phone without leaving the app, for example:
   ```html
   <h2>Your MohLeyla sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">sign in with one click</a>.</p>
   ```
   (*Authentication -> Providers -> Email*: keep "Confirm email" off or on, both work with codes. Code length 6, expiry 1 hour is fine.)
4. **Give the app the two public values.** *Project Settings -> API*: copy the **Project URL** and the **anon / publishable key**.
   - Local: copy `.env.example` to `.env.local` and fill both.
   - Netlify: *Site configuration -> Environment variables* -> add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
   Never use or share the `service_role` key.
5. Open the app -> *Settings -> Account & sync*.

### Important: email limits on the free plan
Supabase's built-in email sender is for testing: only about **2-4 emails per hour** project-wide. For a class or family
that will hit the limit ("Too many emails" in the app). Fix: *Authentication -> SMTP Settings* -> connect your own SMTP
(Resend, Brevo, Gmail SMTP, etc. all have free tiers). Do this before onboarding students.

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

## Testing status
Unit tests cover the merge rules and the sync manager against an in-memory fake. Browser tests run the full sign-in and
two-device flow against a **mocked** Supabase API. Not yet exercised against a real Supabase project, real emails, or real
phones; do the checklist in `docs/TESTING.md` before enrolling students.
