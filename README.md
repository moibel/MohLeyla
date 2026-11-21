# MohLeyla v4 — GitHub / Netlify update

## Deploy
Upload **all files from this folder** to the root of `moibel/MohLeyla`, replacing old files. Netlify builds automatically with `npm run build` and publishes `dist`. Do not upload ZIP directly.

## Included
- Four courses: Arabic MSA, Saudi Arabic, English, Indonesian. 50 lessons / 200 items / 200 quizzes.
- UI locale selector (Indonesian, English, Arabic), RTL for Arabic.
- Localized core vocabulary and quiz prompts. Some longer authored lesson descriptions and example translations remain Indonesian; these are retained instead of inventing inaccurate translations.
- Arabic audio: device speech voices preferred; optional Google Translate TTS web fallback if no Arabic voice exists (requires internet; third-party endpoint may block or change).
- Same localStorage key as previous releases, so saved progress is retained on same origin/browser.
- Logo, responsive UI, PWA manifest.

## Testing
1. Check UI languages and RTL.
2. Test audio on actual devices (Arabic especially).
3. Complete a lesson and refresh; verify progress.
4. Run `npm install && npm run build` locally or confirm Netlify deploy status.

**Note:** Browser TTS availability depends on OS/browser; external Arabic audio fallback is not a guaranteed production audio service. For guaranteed pronunciation, ship licensed audio assets or integrate a paid TTS service via a secure server-side endpoint.
