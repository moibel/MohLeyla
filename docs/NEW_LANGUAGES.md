# New learning paths (beta): Egyptian Arabic, French, Spanish, Chinese

Four paths were added next to Modern Standard Arabic, Saudi Arabic, English and Indonesian. Each has **30 lessons** (about 240 words and phrases: lessons 1-10 beginner, 11-20 elementary, 21-30 intermediate, roughly CEFR A1 to A2), marked **Beta**. The plans they follow, with sources and the decisions made, are in `docs/curriculum/` (`*-plan.md`), and what the independent review changed is in `*-review.md`. The French, Spanish and Egyptian plans are based on A1-A2 syllabi and coursebook outlines; the Chinese plan reaches HSK 3 grammar but not its full vocabulary, so do not claim HSK 3 coverage.

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
`node scripts/export-review-sheet.mjs` writes one review sheet per path to `docs/native-review/` (a table per lesson with the target text, pronunciation, the three meanings, examples and a "correction" column). Give a sheet to a native speaker; apply the corrections to the matching `part1.json`, `part2.json` or `part3.json` in `src/data/content/<track>/`; run `npm run validate:content`; regenerate audio for changed texts (`npm run generate:audio`); remove the track from `BETA_TRACKS` in `src/data/content.js` and `src/data/validateContent.js` when you are satisfied.

## Where the lessons live
`part1.json` (lessons 1-10), `part2.json` (11-20) and `part3.json` (21-30) in `src/data/content/<track>/`. To add more, continue the ids and orders and raise `TRACK_SIZES` in `src/data/validateContent.js`. Follow `docs/CONTENT_AUTHORING.md`.

## Technical notes
- The content validator knows the new alphabets (Chinese characters and pinyin tone marks) and the dialect tracks.
- Audio clips are generated offline with macOS voices (`npm run generate:audio`, needs `ffmpeg`); the browser's own voices are the fallback and are picked by language (French, Spanish, Chinese, Arabic).
- Admin lesson/path switches accept the new paths (migration `009_content_switch_languages.sql`).
- Chinese text uses the system's own Chinese font (no font download).
