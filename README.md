# MohLeyla v6

Multilingual language-learning app: **Modern Standard Arabic**, **Saudi Arabic**, **English** and **Indonesian**, with the interface in **Arabic, English or Indonesian**.

- Live site: https://mohleyla.netlify.app
- Repository: https://github.com/moibel/MohLeyla
- Stack: React 18 + Vite 5 + JavaScript + CSS (no UI framework), `react-i18next`, `react-router-dom`, `vite-plugin-pwa`
- Hosting: Netlify (`npm run build` → `dist`)

## What is in v6

| Area | Status |
| --- | --- |
| Courses | **120 lessons** (30 per track), 726 vocabulary items, each lesson with objectives, intro, real-world context, grammar note, 6 words + examples, 2 cloze items and 1 conversation |
| Exercises | multiple choice, match, fill in the blank, arrange words, listening, translation, conversation completion, spaced-repetition vocabulary review |
| Interface languages | Arabic (RTL), English, Indonesian – every string is translated; no fallback to another language |
| Audio | 1,900+ pre-generated mp3 clips (content-addressed, cached) + Web Speech API fallback with explicit voice selection |
| Progress | XP, streak, daily goal, accuracy, words learned/mastered, achievements, Leitner spaced repetition, backup/restore |
| Existing users | v1–v5 progress (`mohleyla-v1`) is migrated automatically, never deleted, and never re-awards XP |
| PWA | manifest, icons, maskable icons, service worker, update prompt, install button |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
```

Node 18.18+ (Netlify uses Node 20 via `netlify.toml`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run check` | content validation + i18n validation + unit tests + production build |
| `npm test` | Vitest unit tests (content, exercise generation, progress/XP/migration, audio service, i18n parity) |
| `npm run test:e2e` | Playwright end-to-end tests against a production build (see *Testing*) |
| `npm run validate:content` | strict structural validation of all 120 lessons |
| `npm run validate:i18n` | key/placeholder/script parity of `ar` / `en` / `id` UI strings |
| `npm run generate:audio` | (macOS only) regenerate missing audio clips |
| `npm run generate:icons` | regenerate all brand/PWA icons from `assets-src/logo-master.png` |

## Project structure

```
index.html  vite.config.js  netlify.toml  package.json
public/            icons/ (logo, favicon, PWA)  fonts/  audio/{ar,en,id}/*.mp3 + manifest.json
src/
  app/             App (routes), Layout, ProgressContext, usePwa
  components/      Logo, Button, SpeakButton, LessonCard, Notices …
  pages/           Home, Courses, LessonPage, Review, Vocabulary, Progress, Settings
  features/
    audio/         audioService.js (playback engine), hash.js, useAudio.js
    lessons/       Overview, word cards, result screen
    quizzes/       generate.js (exercise generation + evaluation), ExerciseRunner.jsx
    progress/      engine.js (pure XP/streak/SRS/migration logic), storage.js, selectors.js, Onboarding
  data/            content/{ar,sa,en,id}/*.json  manifest.json (generated)  content.js  validateContent.js
  i18n/{ar,en,id}/ui.js   interface strings (react-i18next)
  styles/          tokens, base, layout, components, pages
scripts/           validate-content, validate-i18n, build-manifest, generate-audio, generate-icons, scan-leakage
tests/e2e/         Playwright specs
docs/              CONTENT_AUTHORING.md, CURRICULUM.md, legacy data, AUDIO.md, TESTING.md
legacy-v5/         the original v5 source, kept for reference only
```

## Data model: learning language vs. explanation language

Interface translations (`src/i18n`) are separate from educational content (`src/data/content`).
A lesson belongs to a **track** (`ar`, `sa`, `en`, `id` → the language being learned). Every explanatory string is `{ ar, en, id }`, and the UI picks the entry for the selected interface language:

```json
{
  "id": "ar-01", "track": "ar", "level": "beginner", "order": 3,
  "title": { "ar": "…", "en": "Greetings", "id": "Salam dan sapaan" },
  "items": [{
    "id": "a1", "target": "مَرْحَبًا", "translit": "marḥaban",
    "tr": { "ar": "…", "en": "Hello", "id": "Halo" },
    "example": { "target": "…", "tr": { "ar": "…", "en": "…", "id": "…" } }
  }]
}
```

So an Arabic-interface user learning Indonesian sees Indonesian phrases explained in Arabic, and an English-interface user learning Arabic sees Arabic explained in English. See `docs/CONTENT_AUTHORING.md` to add lessons; `npm run validate:content` checks them.

## Audio (read this before relying on it)

Details are in [docs/AUDIO.md](docs/AUDIO.md). In short:

1. **Primary: bundled recordings.** Every word, example sentence, cloze sentence and dialogue line has an mp3 in `public/audio/<lang>/<hash>.mp3` (name = hash of language + text). They are generated once with the macOS system voices **Majed** (Arabic), **Samantha** (US English) and **Damayanti** (Indonesian) and cached by the browser/service worker. No API keys, no server, no recurring cost.
2. **Fallback: device voices** (Web Speech API). The engine waits for `voiceschanged`, prefers the exact locale (`ar-SA` → other `ar-*`, `en-US` → `en-GB`, `id-ID`) and never picks a voice of another language.
3. Failures are always shown to the user, in the interface language, via an `alert` toast. Repeated clicks stop the current clip instead of overlapping.

**Saudi Arabic:** the audio is a *Standard Arabic* voice reading Saudi text. It does **not** reproduce a Saudi accent, and the app says so on the lesson screen and in Settings. For authentic Saudi audio, record native speakers or use a dialect-capable TTS service and drop the files in `public/audio/ar/` (keyed by `audioKey(text,'ar')`).

**Licensing note:** the clips were produced with Apple system voices. Review Apple's licence terms for redistributing synthesized speech in a public product before relying on them commercially; swap in licensed recordings or a TTS service whose terms allow redistribution if in doubt. If you want a cloud TTS later (e.g. Azure Speech `ar-SA-HamedNeural`, Google Cloud TTS, ElevenLabs), generate the files offline with a script like `scripts/generate-audio.mjs` so **no API key ever ships in the frontend**; a Netlify Function is only needed for on-demand generation and is not required for v6.

## Offline use (honest limits)

The service worker precaches the app shell, fonts, icons and **all lesson text** (about 2.4 MB). Audio is **not** precached (about 25 MB); a clip is saved after it has been played once, so previously played audio replays offline. Unplayed audio offline falls back to your device voice if it has one. Progress is stored in `localStorage` and works offline.

## Netlify deployment

Nothing special is required:

1. Push this folder (its contents, not a parent directory) to the root of `moibel/MohLeyla`, replacing old files.
2. Netlify settings (already in `netlify.toml`): build command `npm run build`, publish directory `dist`, Node 20.
3. SPA routing: `/*` → `/index.html` (status 200) is configured; static files (`/audio/*`, `/icons/*`) are served first.
4. Caching headers: hashed assets and audio are immutable; `index.html`, `sw.js` and the manifest are `no-cache` so updates are noticed (the app then shows an "update available" toast).

No environment variables or secrets are used.

## Testing

See [docs/TESTING.md](docs/TESTING.md) for what is automated, how to run it, and what was and was not tested on real devices.

```bash
npm test                     # unit tests
npx playwright install chromium
npm run test:e2e             # builds, serves dist/, runs browser tests
```

## Known limitations

- Native-speaker review of the Arabic (especially Saudi) and Indonesian lesson text has **not** been done; it was authored and checked structurally and by scripts. Please have native speakers skim before public promotion.
- Audio has been tested for real playback only in headless Chromium (desktop). iOS Safari, Android Chrome and desktop Safari/Firefox are untested by the author.
- Saudi audio is Standard Arabic pronunciation (see above).
- `npm audit` reports advisories in dev-only tooling (Vitest/Vite dev server); they do not affect the deployed static site.
