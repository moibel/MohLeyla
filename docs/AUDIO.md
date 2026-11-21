# MohLeyla audio architecture

## Why two layers

Browser speech synthesis (`speechSynthesis`) alone is unreliable for Arabic: many desktop/Android/iOS setups have **no** Arabic voice installed, voices load asynchronously (`voiceschanged`), and quality/locales differ per OS. v5 failed silently in that case. v6 therefore ships **recordings first** and uses device voices only as a fallback.

```
click speaker ─► AudioService.play({text, lang, track})
                  ├─ same clip already active? → stop (pause/cancel)         (no overlapping audio)
                  ├─ source = auto | recorded:
                  │     manifest has hash(lang|text)? → <audio src=/audio/<lang>/<hash>.mp3> (speed = playbackRate)
                  │     ok → done          error → (auto) fall through / (recorded) show error
                  └─ source = auto | device:
                        wait for voices (voiceschanged, 1.5 s timeout)
                        pickVoice(): exact locale → same language → none
                        none → error "noVoice"   speak() → onerror → error "failed"/"blocked"
```

Errors (`unsupported`, `noVoice`, `blocked`, `network`, `failed`, `noAudioFile`) are rendered by `<AudioNotice/>` as an `alert` toast in the **interface language** (`audio.errors.*` in `src/i18n/*/ui.js`).

## Files

- `src/features/audio/audioService.js` – engine (framework-free, unit-tested with fakes).
- `src/features/audio/hash.js` – `audioKey(text, lang)`; shared by the app and the generator, so file names are content-addressed: change a sentence → it gets a new hash → regenerate.
- `scripts/generate-audio.mjs` – offline generator (macOS `say` + `ffmpeg`/libmp3lame, mono 24 kHz 40 kbps). Idempotent; `--force` redoes all.
- `public/audio/manifest.json` – list of existing hashes per language (lets the app know a clip exists before requesting it).

## Voices used for the bundled clips

| Language | Voice | Notes |
| --- | --- | --- |
| Arabic (MSA and Saudi tracks) | Majed (macOS, `ar_001`) | Standard Arabic. MSA text is fully vowelised, which improves pronunciation. |
| English | Samantha (`en_US`) | |
| Indonesian | Damayanti (`id_ID`) | |

### Saudi Arabic

No Saudi *dialect* voice is bundled. The Saudi track reads Saudi spelling with a Standard Arabic voice; sounds such as ق→"g" will therefore be pronounced the MSA way. The UI states this under every Saudi word and in Settings. If you obtain real Saudi recordings, place them at `public/audio/ar/<audioKey(text,'ar')>.mp3` (the hash can be computed with `audioKey` from `hash.js`) and re-run nothing else – the manifest only needs the hash added (`npm run generate:audio` rebuilds the manifest from existing files).

## Cost and setup of alternatives

- **Current setup:** free, no keys, no server.
- **Azure AI Speech** (neural, has `ar-SA-HamedNeural`/`ar-SA-ZariyahNeural`, `id-ID-*`, `en-US-*`): free tier ≈ 0.5 M characters/month, then ≈ US$16 per 1 M neural characters. The full course is roughly 150 k characters, i.e. a few US dollars at most.
- **Google Cloud TTS** (Wavenet/Neural2/Chirp): `ar-XA` voices (not Saudi-specific), comparable pricing.
- **ElevenLabs**: multilingual, higher price per character, check licence for redistribution.
Generate offline, commit the mp3s, keep the key in your shell environment – never in `src/`. A Netlify Function is only worth adding for on-demand generation of *new* text.

## Licensing

Check the terms of whichever voice produced the files before commercial redistribution (see README).
