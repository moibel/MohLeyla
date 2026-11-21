# MohLeyla

A responsive Indonesian-language learning web app for Modern Standard Arabic, everyday Saudi Arabic, English, and Indonesian. Includes 50 lessons, 200 phrases, and 200 interactive multiple-choice questions, speech synthesis, bookmarks, and local progress.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

## Deploy to Netlify

**Recommended (Git repository):** push the project to GitHub, import it into Netlify, use build command `npm run build` and publish directory `dist` (already configured in `netlify.toml`).

**Manual drag-and-drop:** run `npm install && npm run build` locally, then drag the **dist folder** into Netlify's manual deploy page. Do **not** drag the source ZIP directly into Netlify's manual deploy area.

## Features and limitations

- Progress and saved vocabulary are stored in localStorage on the current browser/device, not synced across devices.
- Audio uses the browser's built-in Web Speech API. Voice availability, especially Arabic, varies by browser/OS. For reliable Saudi dialect pronunciation, recorded native audio is recommended for a future release.
- Saudi colloquial transliterations are approximate learner guides; the pronunciation engine may read them in standard Arabic.
- No authentication, backend, AI tutor, speech scoring, or offline caching in this release. The manifest enables install-like browser experiences where supported, but this is not a fully offline PWA.
- Learning content is editable in `src/data.js`.

## Indonesian learning track

The Indonesian track uses English glosses as prompts, Indonesian answers, examples and Indonesian TTS (`id-ID`). The app UI remains Indonesian.
