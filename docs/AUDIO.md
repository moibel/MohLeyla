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
- Egyptian Arabic has its own recordings (`public/audio/eg/`, made with Azure Speech's Egyptian neural voices) with a fallback to the Standard Arabic ones: see `docs/EGYPTIAN_AUDIO.md`.
- `scripts/generate-audio.mjs` – offline generator (macOS `say` + `ffmpeg`/libmp3lame, mono 24 kHz 40 kbps). Idempotent; `--force` redoes all.
- `public/audio/manifest.json` – list of existing hashes per language (lets the app know a clip exists before requesting it).
  The list changes with every release, so it is **never cached for long**: hosting sends `no-cache` for it (only the clips, named by a hash of their text, are cached for a year), the app requests it as `manifest.json?v=<fingerprint>` (set in `vite.config.js`), and when a clip looks missing it re-reads the list once with the cache bypassed. History: it used to be `immutable` for a year, which hid the new languages' recordings from browsers that had used the app before.

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

## Modern Standard Arabic course: ElevenLabs voice (`msa` clips)

The Arabic course ('ar') plays `public/audio/msa/` clips made with ElevenLabs, and falls back to the macOS (Majed) `ar` clips for a line without one (then to the phone's own voice). The Saudi and Egyptian tracks are not affected (Saudi still uses the macOS Arabic clips; Egyptian has its own `eg` set).

1. In ElevenLabs open **Voices > Voice Library**, filter **Language: Arabic**, listen for a clear Modern Standard Arabic voice (calm, good for learners; not an Egyptian or Gulf accent), **Add to My Voices**, copy its **Voice ID**.
2. Add one line to the git-ignored `.env.local` (the same file that already holds `ELEVENLABS_API_KEY`):
   `ELEVENLABS_VOICE_ID_AR=<the voice id>`
3. `npm run generate:audio` makes the `msa` clips (about 14,700 characters of ElevenLabs credit for the 551 lines of the Arabic course). Clips are named from the text and the `msa` set name, so a returning visitor never meets an old cached file.

Every Arabic word in this course already carries vowel marks, which the voice needs to read it correctly.

## Indonesian course: ElevenLabs voice (`idn` clips)

Same pattern as the Arabic course: the Indonesian course ('id') plays `public/audio/idn/` clips and falls back to the macOS (Damayanti) `id` clips. In ElevenLabs choose an Indonesian voice (**Voice Library > Language: Indonesian**), add it to My Voices, copy its Voice ID, put `ELEVENLABS_VOICE_ID_ID=<the voice id>` in the git-ignored `.env.local`, then `npm run generate:audio` (about 12,350 characters, 555 lines).

## Saudi course: vowel marks and an ElevenLabs voice (`sau` clips)

The Saudi course ('sa') has vowel marks on every spoken word (`docs/data/sa-diacritics.json`; add new words there and run `node scripts/apply-eg-diacritics.mjs docs/data/sa-diacritics.json --track sa`; `src/test/eg-diacritics.test.js` guards it). The marks were written by an AI from the lessons' Latin spelling and are not native-reviewed. NO letters are changed for the voice (the Egyptian-only ق/ج rules in `scripts/eg-pronunciation.mjs` do not apply to Saudi).

The Saudi track plays `public/audio/sau/` clips and falls back to the macOS Arabic `ar` clips (never to the Modern Standard Arabic `msa` set). In ElevenLabs choose a Saudi voice (**Voice Library > Language: Arabic**, accent Saudi), put its Voice ID in `.env.local` as `ELEVENLABS_VOICE_ID_SA=<the voice id>`, then `npm run generate:audio` (about 8,500 characters, 493 lines).
