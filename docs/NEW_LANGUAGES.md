# New learning paths (beta): Egyptian Arabic, French, Spanish, Chinese

Four paths were added next to Modern Standard Arabic, Saudi Arabic, English and Indonesian. Each has **10 lessons** (about 70-80 words and phrases), marked **Beta**.

| Path | Track id | Written in | Audio |
| --- | --- | --- | --- |
| Egyptian Arabic | `eg` | Arabic script, Cairo colloquial; the Arabic gloss of every item is the Modern Standard Arabic equivalent (like the Saudi path) | A **Standard Arabic** voice (Majed). It does not reproduce the Egyptian accent, and the app says so |
| French | `fr` | Standard French | Thomas (fr-FR) |
| Spanish | `es` | Neutral standard Spanish (tú/usted/ustedes) | Mónica (es-ES) |
| Chinese | `zh` | Simplified characters with pinyin (tone marks) | Tingting (zh-CN) |

Every lesson has the same parts as the existing paths: objectives, introduction, culture note, a grammar note, 6-8 words with example sentences and hints, two fill-in-the-blank items and a short conversation, all explained in Arabic, English and Indonesian. The eight exercise types work for the new paths too, except "put the words in order" for Chinese (Chinese has no spaces between words).

## How accurate is it?
Honestly: **careful, but not native-reviewed.** The lessons were drafted by one model pass, then re-read item by item by a second independent pass that corrected mistakes, then checked by scripts (structure, scripts and alphabets, pinyin tone marks, unique answers). That catches many errors but **cannot replace a native speaker**, especially for Egyptian colloquial forms, pronunciation guides, tone of voice and the Arabic and Indonesian explanations. That is why the paths show a **Beta** label and a note on the course page.

## Getting them reviewed
`node scripts/export-review-sheet.mjs` writes one review sheet per path to `docs/native-review/` (a table per lesson with the target text, pronunciation, the three meanings, examples and a "correction" column). Give a sheet to a native speaker; apply the corrections to `src/data/content/<track>/part1.json`; run `npm run validate:content`; regenerate audio for changed texts (`npm run generate:audio`); remove the track from `BETA_TRACKS` in `src/data/content.js` and `src/data/validateContent.js` when you are satisfied.

## Adding the remaining 20 lessons per path
Add `part2.json` and `part3.json` next to `part1.json`, continue the ids (`fr-11` ...) and orders (11 ...), and raise `TRACK_SIZES` in `src/data/validateContent.js` to 30. Follow `docs/CONTENT_AUTHORING.md`.

## Technical notes
- The content validator knows the new alphabets (Chinese characters and pinyin tone marks) and the dialect tracks.
- Audio clips are generated offline with macOS voices (`npm run generate:audio`, needs `ffmpeg`); the browser's own voices are the fallback and are picked by language (French, Spanish, Chinese, Arabic).
- Admin lesson/path switches accept the new paths (migration `009_content_switch_languages.sql`).
- Chinese text uses the system's own Chinese font (no font download).
