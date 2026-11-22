# Testing report (v6)

Automated tests were run on **macOS, Node 26, Chromium (Playwright headless shell 159)** against the **production build** served by `vite preview`.

## Results of the last run

| Suite | Command | Result |
| --- | --- | --- |
| Content validation (strict) | `npm run validate:content` | 120 lessons / 726 items OK |
| i18n parity | `npm run validate:i18n` | 348 base keys, ar = en = id |
| Unit tests (Vitest) | `npm test` | 119 passed |
| Browser tests (Playwright) | `npm run test:e2e` | 138 passed |
| Production build | `npm run build` | OK, PWA precache generated |

## What is covered

**Unit (`src/test`)**
- Every lesson is structurally valid; unique lesson/item ids; 30 lessons per track; every v5 lesson/item id still exists.
- Exercise generation for all 120 lessons × 3 interface languages: ≥14 exercises, every type present, exactly one correct answer, no duplicate options, answer evaluation correct, answer position varies.
- Progress engine: v1→v6 migration (legacy key untouched), junk input, XP awarded once, perfect bonus, review XP cap, streaks, Leitner boxes, review queue, backup round-trip.
- Audio service with fake `Audio`/`speechSynthesis`: recording playback, fallback to device voice, `noVoice`, `blocked`, `unsupported`, recording-only mode, stop-on-second-click, no overlap (single `<audio>` element), playback speed, stable content hashes. Voice selection (exact locale, same-language fallback, never another language, Android `ar_SA`).

**Browser (`tests/e2e`)**
- Full lesson flow with real clicks; XP +70, persists after reload, repeat gives +0; wrong answer → explanation → second chance → +50.
- Legacy `mohleyla-v1` data shows correct XP/lessons/saved words; existing learners skip onboarding.
- All 120 lesson pages load and show overview and first word card.
- Vocabulary search/filter/remove and a spaced-repetition review session.
- **Real audio playback** in Chromium for MSA, Saudi, English and Indonesian: the `<audio>` element fires `playing` and `ended`, `currentTime` advances, duration > 0.3 s, correct file path, no error toast. Example-sentence audio, repeated-click behaviour, playback speed applied.
- Audio fallback with a mocked speech engine: exact `ar-SA` voice chosen over `ar-EG`; missing recording + no Arabic voice → alert toast in **en / ar / id**; no speech support → alert.
- Interface language: no Latin text in the Arabic UI, no Indonesian/Arabic UI text in the English UI, no English/Arabic in the Indonesian UI (7 pages × 3 languages); live switching and persistence; lesson content follows UI language independent of learning language.
- RTL: `dir=rtl`, navigation order, sidebar side, mirrored arrows, bdi isolation.
- Responsive at 360, 390, 820, 1366, 1920 px in en and ar on 7 pages: no horizontal overflow, no clipped headings/buttons, correct nav (bottom bar < 1024 px, sidebar ≥ 1024 px). Screenshots land in `test-results/screens/`.
- Accessibility: axe-core (WCAG 2.0/2.1 A + AA incl. colour contrast) on 5 pages × 2 languages, lesson + exercise screens in dark mode; skip link first in tab order; visible focus; exercise answerable by keyboard; reduced motion.
- Branding: every `<img>` loads on every page, favicon/manifest icons return 200, no failed network requests.
- PWA: service worker registers; app shell and a visited lesson load while offline.

- **Speaking practice**: real recording through Chromium's fake microphone (MediaRecorder), playback of the user's clip, microphone released after stop and on navigation, denied-mic errors in en/ar/id, unsupported browsers, axe in RTL.
- **Accounts and sync**: merge rules as property tests (commutative, associative, idempotent), sync manager against an in-memory fake, and browser tests of sign-in with a code, two devices converging, session restore, shared-device prompt, delete/reset and translated errors, all against a **mocked** Supabase API.

## NOT tested (be honest with users)

- **Real Supabase**: nothing has run against a real project, real emails (templates, rate limits), or row-level-security policies. Test with two real devices and a real inbox before enrolling students.
- **Real devices**: no iPhone/iPad Safari, no Android Chrome, no desktop Safari/Firefox. Only Chromium (desktop viewport emulation for phone sizes, which does not reproduce touch, safe-area, or iOS audio-unlock behaviour).
- **Speaking on real hardware**: only Chromium's synthetic microphone tone was used; real voices, iOS Safari (mp4 recording) and Android permission prompts are untested.
- **Audio quality**: playback was verified technically (events/time/duration). Nobody has listened to all clips for pronunciation accuracy, and the Arabic voice reading Saudi dialect text is *not* a Saudi accent.
- **Device speech voices**: fallback logic is tested with a fake speech engine; no real OS voice list was exercised in the browser tests.
- **Native-speaker review** of Arabic / Saudi / Indonesian lesson text has not happened.
- The "new version available" toast and the install prompt (`beforeinstallprompt`) are not exercised by the automated suite.
- Netlify itself: the build was verified locally; the deploy on Netlify was not run from this environment.

## Suggested real-device checklist
1. iPhone Safari: open a lesson, tap each speaker (Arabic, English, Indonesian) – sound after the first tap; silent switch off.
2. Android Chrome: same, plus Add to Home screen and airplane-mode replay of an already-played clip.
3. Arabic interface in landscape and portrait; rotate during a lesson.
4. Complete a lesson, close the browser, reopen: XP and lesson state persist.
5. A user with v5 progress: open the new site on the same origin and confirm XP/saved words are intact.
