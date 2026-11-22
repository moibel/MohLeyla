# Changelog

## Unreleased
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
