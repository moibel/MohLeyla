# MohLeyla v6

Multilingual language-learning app: **Modern Standard Arabic**, **Saudi Arabic**, **English** and **Indonesian** (30 lessons each) plus four **beta** paths, **Egyptian Arabic**, **French**, **Spanish** and **Chinese** (30 lessons each, see [docs/NEW_LANGUAGES.md](docs/NEW_LANGUAGES.md)), with the interface in **Arabic, English or Indonesian**.

- Live site: https://mohleyla.pages.dev
- Repository: https://github.com/moibel/MohLeyla
- Stack: React 18 + Vite 5 + JavaScript + CSS (no UI framework), `react-i18next`, `react-router-dom`, `vite-plugin-pwa`
- Hosting: Cloudflare Pages (`npm run build` → `dist`); Netlify config is kept as a fallback (see [docs/HOSTING.md](docs/HOSTING.md))

## What is in v6

| Area | Status |
| --- | --- |
| Courses | **240 lessons** (30 per track, eight tracks), 1,669 vocabulary items, each lesson with objectives, intro, real-world context, grammar note, 6 words + examples, 2 cloze items and 1 conversation |
| Exercises | multiple choice, match, fill in the blank, arrange words, listening, translation, conversation completion, spaced-repetition vocabulary review |
| Interface languages | Arabic (RTL), English, Indonesian – every string is translated; no fallback to another language |
| Audio | 4,700 pre-generated mp3 clips (content-addressed, cached) + Web Speech API fallback with explicit voice selection |
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

Node 18.18+ (Cloudflare and Netlify both build with a current Node; Netlify is pinned to 20 in `netlify.toml`).

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

1. **Primary: bundled recordings.** Every word, example sentence, cloze sentence and dialogue line has an mp3 in `public/audio/<lang>/<hash>.mp3` (name = hash of language + text). They are generated once with the macOS system voices **Majed** (Arabic, also for Saudi and Egyptian), **Samantha** (US English), **Damayanti** (Indonesian), **Thomas** (French), **Mónica** (Spanish) and **Tingting** (Chinese) and cached by the browser/service worker. No API keys, no server, no recurring cost.
2. **Fallback: device voices** (Web Speech API). The engine waits for `voiceschanged`, prefers the exact locale (`ar-SA` → other `ar-*`, `en-US` → `en-GB`, `id-ID`) and never picks a voice of another language.
3. Failures are always shown to the user, in the interface language, via an `alert` toast. Repeated clicks stop the current clip instead of overlapping.

**Saudi Arabic:** the audio is a *Standard Arabic* voice reading Saudi text. It does **not** reproduce a Saudi accent, and the app says so on the lesson screen and in Settings. For authentic Saudi audio, record native speakers or use a dialect-capable TTS service and drop the files in `public/audio/ar/` (keyed by `audioKey(text,'ar')`).

**Licensing note:** the clips were produced with Apple system voices. Review Apple's licence terms for redistributing synthesized speech in a public product before relying on them commercially; swap in licensed recordings or a TTS service whose terms allow redistribution if in doubt. If you want a cloud TTS later (e.g. Azure Speech `ar-SA-HamedNeural`, Google Cloud TTS, ElevenLabs), generate the files offline with a script like `scripts/generate-audio.mjs` so **no API key ever ships in the frontend**; a Netlify Function is only needed for on-demand generation and is not required for v6.

## Accounts and sync (optional)

Sign-in and cross-device sync use Supabase (and `VITE_REQUIRE_SIGN_IN=true` makes sign-in mandatory) and stay switched off until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (see `.env.example`). Setup, privacy notes and the merge rules are in [docs/ACCOUNTS.md](docs/ACCOUNTS.md); the database schema is in `supabase/migrations/`.

## Offline use (honest limits)

The service worker precaches the app shell, fonts, icons and **all lesson text** (about 5 MB). Audio is **not** precached (about 50 MB); a clip is saved after it has been played once, so previously played audio replays offline. Unplayed audio offline falls back to your device voice if it has one. Progress is stored in `localStorage` and works offline.

## Deployment

Production runs on **Cloudflare Pages** at https://mohleyla.pages.dev (free, no build-credit counter). Settings: connect the GitHub repo,
production branch `main`, build command `npm run build`, build output directory `dist`, no dashboard variables needed.
The public build settings (Supabase URL, publishable key, sign-in switches) are committed in `.env.production`.

- Security headers (including `microphone=(self)`, required for speaking practice) and caching rules live in `public/_headers`, which
  Cloudflare and Netlify both read. `netlify.toml` repeats them for Netlify; a unit test keeps the two in agreement.
- Unknown paths such as `/lesson/ar-01` serve the app (Cloudflare Pages does this automatically; Netlify uses the redirect in `netlify.toml`).
- Netlify (`mohleyla.netlify.app`) is no longer the live host and its builds are stopped; `netlify.toml` stays as a fallback.
- Steps, costs and the address checklist (Supabase redirect URLs and Site URL) are in [docs/HOSTING.md](docs/HOSTING.md).

## Testing

See [docs/TESTING.md](docs/TESTING.md) for what is automated, how to run it, and what was and was not tested on real devices.

```bash
npm test                     # unit tests
npx playwright install chromium
npm run test:e2e             # builds, serves dist/, runs browser tests
```

## Known limitations

- Native-speaker review of the Arabic (especially Saudi and Egyptian), Indonesian, French, Spanish and Chinese lesson text has **not** been done (the four newest paths are labelled Beta; review sheets are in `docs/native-review/`); it was authored and checked structurally and by scripts. Please have native speakers skim before public promotion.
- Audio has been tested for real playback only in headless Chromium (desktop). iOS Safari, Android Chrome and desktop Safari/Firefox are untested by the author.
- Saudi audio is Standard Arabic pronunciation (see above).
- `npm audit` reports advisories in dev-only tooling (Vitest/Vite dev server); they do not affect the deployed static site.
