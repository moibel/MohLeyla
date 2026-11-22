# Changelog

## Unreleased
- **Admin announcements**: an admin posts a message to everyone or to one class, in one to three languages (each learner sees their own, else English), with an optional "hide after" date and archiving. Learners see the newest two on Home (closable) and all current ones on their profile. Stored behind admin-checked functions (`supabase/migrations/004_announcements.sql`, 27 permission checks). Translated in ar, en, id.
- **Reliability**: a render error or a page file that cannot be loaded now shows a translated recovery screen (Try again / Reload / Clear cached copy and reload) instead of a blank page; progress is never touched. After a new deploy, an old cached copy that asks for a file that no longer exists is healed automatically once. Cloud sync now retries by itself after a failed attempt while online (5 s, 15 s, 45 s, 2 min, then every 5 min), stops when it succeeds or on sign-out, and still waits for the "online" event when offline.
- **Speed**: the connection to Supabase is opened while the page loads (when accounts are on). A bundle budget check (`npm run check:size`, part of `npm run check`) fails if the first-screen JavaScript grows past 150 kB gzip (now about 126 kB), the CSS past 15 kB (now about 9 kB), or the Supabase library leaks into it.
- **Admin rewards**: an admin can give stars, bonus XP or a named badge to any email address (with a reason), see the history and take rewards back. Learners are told once, and see them on their profile (stars and bonus XP also in the top bar and XP totals). Bonus rewards do not change the daily goal, streak or learning achievements. Stored in the database behind admin-checked functions (`supabase/migrations/003_rewards.sql`, 29 permission checks). A local Postgres test runner was added (`supabase/tests/run-local.sh`). Translated in ar, en, id.
- **Learning paths ordered by interface language**: with the Arabic interface, English and Indonesian come first (Arabic and Saudi Arabic last); with English or Indonesian, the Arabic paths come first. Applies to Home, Courses, Progress, Words and the first-run suggestion. Nothing is hidden, and a learner's own choice of path is always kept.
- **New logo**: a speech bubble (conversation) holding an "M" with a smile and a gold star (joy and rewards). Source is `assets-src/logo-master.svg`; `npm run generate:icons` rebuilds the app icons, favicon, PWA icons and social preview from it.
- **Course map**: each path shows "N of 30 lessons complete" with a progress bar and a one-tap "Continue: <next lesson>" button; each level heading shows its own progress.
- **Review**: keyboard support (Enter or Space reveals the answer, 1 = didn't know, 2 = knew) and a "words learned · mastered" line on the start screen. Review badge in the sidebar darkened to meet contrast requirements.
- **Exercise screens**: press 1-9 to answer multiple-choice questions and Enter to continue (keyboard users and desktop learners); an "In a row: N" chip appears after three correct answers in a row and clears on a mistake; the correct option and the chip pop in (no motion when reduced motion is on). Translated in ar, en, id.
- **Lesson result screen**: after a lesson you now see your streak, progress toward today's XP goal (with how much is left, or that it is reached), any achievements the lesson unlocked (not repeated on a replay), and a button to review due words. Success green darkened for better contrast. Translated in ar, en, id.
- **Creator signature and About page**: "Made with care by Mohamed Ebrahim" in the footer, the sidebar and the sign-in screen, linking to a new About page (`/about`) with the creator's name in English and Arabic, the story, what the app offers and the project link. Translated in ar, en and id.
- **Admin and teacher insights**: the admin page shows totals (accounts, students, teachers, admins, active this week) and a role filter; each class roster shows how many students were active in the last 7 days and the average XP.
- **Polish**: page entrance motion, themed text selection and scrollbars, tabular numerals, hover/press states on cards, an icon instead of an emoji in the greeting, and sidebar/logo links whose accessible name contains their visible text.
- **Roles, classes and an admin page**: student / teacher / admin roles enforced in the database (row-level security + admin-checked functions). Admin page to list accounts and assign roles; teachers create classes with a join code and see a progress summary per student; students join or leave with a code. New `supabase/migrations/002_roles_classes.sql` with a 39-check rolled-back permission test. Fully translated (ar, en, id).
- **Hosting moved to Cloudflare Pages** (`https://mohleyla.pages.dev`): free, no credit counter. Netlify builds stopped; Supabase Site URL and redirect list updated; docs updated.
- **Public build settings in the repo**: committed `.env.production` (Supabase URL, publishable key, required sign-in, Google sign-in) so Cloudflare, Netlify and local builds are identical without dashboard variables. Guard tests forbid secrets in it. `.env.example` is now tracked (it had been ignored by mistake).
- **Cloudflare-ready hosting**: `wrangler.jsonc` (static assets, single-page-app fallback) and `public/_headers` (security headers incl. `microphone=(self)`, caching) so the same repo deploys on Cloudflare as well as Netlify; `docs/HOSTING.md` has the steps. Unit tests keep netlify.toml and _headers in agreement.
- **Profiles**: signed-in learners are greeted by name ("Hi, Amina!") and have a profile page (avatar, editable name, email, member-since, learning stats). Google users get their Google name and photo; email users are asked once "What should we call you?" (skippable; falls back to the readable part of the email). The name is stored in the account (user metadata) so it follows them to every device; the greeting works offline. Avatars fall back to coloured initials, and only https photo links are used.
- **Continue with Google**: optional (`VITE_GOOGLE_SIGN_IN=true`) one-tap Google sign-in / registration next to the email option, on the sign-in screen and in Settings. Needs the Google provider enabled in Supabase (see docs/ACCOUNTS.md). Same-email accounts are linked by Supabase.
- **Required sign-in (optional switch)**: with `VITE_REQUIRE_SIGN_IN=true` every learner must sign in with their own email before using the app. Remembered sign-in works offline; first sign-in needs internet. Existing progress on a device is kept and uploaded at first sign-in. Sign-out on a shared device saves to the cloud first, then clears the device (asks before discarding unsaved progress); the next person starts clean. A cleared device gets a new device id so per-device XP counters never collide.
- **Microphone help**: when the microphone request is refused the app now works out why and says so: an out-of-date cached copy that blocks the microphone (with a "Fix and reload" button that clears the app cache and keeps progress), a blocked site (how to open site settings), or a dismissed pop-up (tap Record again and choose Allow). A hint before the first recording tells the learner to tap Allow.
- **Fix**: the Netlify `Permissions-Policy` header disabled the microphone (`microphone=()`), so speaking practice could not record on the live site. It is now `microphone=(self)`; a unit test guards it.
- **Accounts and cloud sync (optional, Supabase)**: email one-time-code sign-in, local-first background sync, conflict-free merge of progress between devices (XP counted per device and summed, un-saves propagate), shared-device prompt (combine / use account / cancel), delete cloud data, reset also clears the cloud copy. Needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; without them the app is unchanged. Setup: `docs/ACCOUNTS.md`, schema: `supabase/migrations/001_progress.sql`.
- **Speaking practice**: record yourself on every word card, compare with the model voice, self-rate ("close" / "needs practice"). Recordings stay in memory on the device and are never stored or uploaded. +1 XP per "close" rating (max 20/day), new "Speaker" achievement. Mapped microphone errors (blocked / no mic / unsupported / too short) in ar, en, id.

## 6.0.0 — MohLeyla v6

### Critical fixes
- **Arabic audio**: replaced the silent-failing `speechSynthesis` call with a two-layer engine – 2,157 pre-generated mp3 clips (Arabic 1,044 · English 558 · Indonesian 555) plus a Web Speech fallback that waits for `voiceschanged`, prefers the exact locale and never picks another language's voice. Replay/stop, speed control (0.75×/1×/1.25×), no overlapping clips, and every failure is shown in the interface language.
- **Honest Saudi audio**: Saudi text is read by a Standard Arabic voice and labelled as such (lesson screen + Settings).
- **Complete localisation**: three full interface languages (ar/en/id) through `react-i18next`; all lesson explanations, exercises, feedback, errors and achievements are translated; no fallback language (`fallbackLng: false`). The v5 `LessonCard` crash (`uiText` undefined) is gone.
- **RTL**: `dir`/`lang` on `<html>`, CSS logical properties everywhere, mirrored arrows, direction-isolated mixed text (`<bdi lang dir>`).
- **Assets**: logo/hero no longer depend on external or missing paths; emoji hero replaced by SVG-free CSS art + bundled logo; all icons exist and are verified by tests.
- **Progress preserved**: `mohleyla-v1` (`completed[]`, `saved[]`, `xp`) is migrated into the new `mohleyla-v6` store without deleting the old key; all v5 lesson and word ids are kept, so saved words still resolve.

### UI/UX
- New design system (blue/teal brand, Cairo + Inter self-hosted, light/dark/system), mobile-first layout, bottom navigation on phones/tablets, sidebar on desktop, onboarding dialog for new learners.
- Brand assets generated from the supplied logo: transparent marks, on-dark mark, favicon (ico/svg/png), apple-touch icon, PWA + maskable icons, social image.

### Content
- 50 → **120 lessons** (30 per track), 200 → **726 vocabulary items** with trilingual meanings, examples, pronunciation guides and usage hints; 240 cloze sentences; 120 dialogues; grammar and cultural notes. Legacy lessons kept their ids and were expanded.
- New learning paths ordered from alphabet/sounds through greetings, numbers, family, food, travel, health, work, tenses, to capstone conversations. The Saudi track compares Saudi and Standard Arabic.

### Learning features
- Eight exercise kinds (multiple choice both directions, listening, match, fill-in-the-blank, arrange words, translation, conversation completion, vocabulary review), per-answer explanations, second-chance retry of missed questions, shuffled non-repeating distractors.
- XP awarded once per lesson (+50, +20 first-try perfect bonus); review XP capped per day.
- Daily goal, streaks, accuracy, words learned/mastered, 11 achievements, per-language progress, 7-day chart, review reminders.
- Vocabulary page: search, language/status filters, replay audio, save/remove; Leitner spaced repetition review.
- Export/import/reset of progress.

### Engineering
- Restructured into `src/{app,components,pages,features,data,i18n,styles,utils}`; per-track code splitting; lazy pages.
- PWA via `vite-plugin-pwa` (manifest, service worker, update toast, install button, runtime audio cache).
- Netlify: `netlify.toml` with SPA redirect, cache headers; no secrets or env vars.
- Tests: 33 Vitest unit tests, 71 Playwright browser tests (see docs/TESTING.md).
