# Egyptian Arabic audio

## The problem this fixes
Egyptian lessons used to be read by the Standard Arabic voice ("Majed", macOS). That voice pronounces Egyptian words the Standard way (ج as "j", ق as "q", full vowels), so it taught the wrong sounds. macOS has no Egyptian voice, so a different source is needed.

## How the app now works
- Egyptian Arabic has its **own recordings**: `public/audio/eg/<hash>.mp3` (hash of `eg|text`, listed in `manifest.json` under `eg`).
- A line **without** an Egyptian recording falls back to the old Standard Arabic recording (`public/audio/ar/...`), and the lesson keeps saying "read by a Standard Arabic voice, not an Egyptian accent" **for that line only**. A line with an Egyptian recording shows no such note.
- Only after that does the device voice speak (preferring an `ar-EG` voice). Saudi Arabic is unchanged.

## Two ways to make the Egyptian recordings
`npm run generate:audio` makes them with whichever service is configured in **`.env.local`** (git-ignored, so keys cannot be committed). If both are configured ElevenLabs is used; force one with `EG_TTS_ENGINE=elevenlabs` or `EG_TTS_ENGINE=azure`. With neither, Egyptian is skipped and nothing else changes. The whole Egyptian course is about 630 short lines and 9,300 characters.

### A. ElevenLabs (natural, Egyptian-accent voices)
1. Create an account at elevenlabs.io. **The free plan does not allow commercial use**, so for a public app use a paid plan (at the time of writing the cheapest, Starter, is about $5-6 a month with 30,000 credits; the whole course needs roughly 9,300 credits, less with the Flash model). Check the current plans and terms before relying on this; as described by ElevenLabs, commercial rights apply to audio generated while the subscription is active, so generate everything in one subscribed month and keep the files.
2. Pick the voice: **Voices -> Voice Library**, filter **Language: Arabic**, **Accent: Egyptian**, **listen** to a few, choose one that sounds like natural Cairene speech, **Add to My Voices**, then copy its **Voice ID** (the long code in the voice's menu / ID field). Listing sites mention Egyptian voices named Amir, Hoda, Omar and Yasmine; availability changes, so choose by listening.
3. Create an API key: your profile -> **API Keys** -> create one (limit it to Text to Speech if the page offers that).
4. Put this in `.env.local` in the project folder:
```
ELEVENLABS_API_KEY=<the key>
ELEVENLABS_VOICE_ID=<the voice id>
# optional: ELEVENLABS_MODEL=eleven_multilingual_v2   (default; also eleven_flash_v2_5, eleven_turbo_v2_5, eleven_v3)
```
**Never paste the key into chat, a commit or a screenshot.** If it leaks, delete it on the API Keys page and make a new one.

### B. Azure Speech (official Microsoft Egyptian voices, free tier)
`ar-EG-SalmaNeural` (female, default) or `ar-EG-ShakirNeural` (male). The free tier is 500,000 characters a month.
1. Create a free Azure account (a card is asked for identity checks; the free tier is not charged). Create a **Speech** resource, tier **Free F0**.
2. Open it -> **Keys and Endpoint**: copy **KEY 1** and the **Location/Region** (for example `westeurope`).
3. Put this in `.env.local`:
```
AZURE_SPEECH_KEY=<KEY 1>
AZURE_SPEECH_REGION=westeurope
# optional: AZURE_EG_VOICE=ar-EG-ShakirNeural
```

## After the key is in place
1. `npm run generate:audio` (only missing clips are made; about a minute or two), then `npm run export:eg-audio-review`.
2. Open `docs/native-review/eg-audio.html` in a browser and **listen** (or send it to an Egyptian speaker): every line with the new recording and the old one side by side, and a column for corrections. If a voice is clearly wrong overall, try another voice (delete `public/audio/eg/` and regenerate with a different voice id or engine). If single words are wrong, change their spelling in the lesson text and regenerate (changed text gets a new clip automatically).
3. Commit the new `public/audio/eg/` files and `manifest.json`.

## Security and honesty notes
- The key is read only from the environment or `.env.local`, sent only in a request header to the service's own host (`api.elevenlabs.io` or `<region>.tts.speech.microsoft.com`), never printed, and never part of an error message. Voice ids, models and regions are validated so they cannot redirect the key. Checked by `src/test/elevenlabs-tts.test.js`, `src/test/azure-tts.test.js` and the secret scan in `src/test/security.test.js`.
- These are machine voices. They should be much closer to Egyptian than the old Standard Arabic voice, but **no native speaker has listened to them yet**, and the lessons stay Beta until that happens.
- The lessons are written in everyday Cairene spelling without vowel marks; the voice decides the vowels. A few words may need a spelling tweak, which the listening page is for.

## Vowel marks (tashkeel) are required

The Egyptian voice reads unmarked Arabic like Standard Arabic. Every Egyptian word the learner hears (item words, example sentences, fill-in sentences and their answers, conversation lines) therefore carries vowel marks, written in Cairene pronunciation. The word list used is `docs/data/eg-diacritics.json`; `src/test/eg-diacritics.test.js` fails when a spoken word has no marks.

Adding or changing Egyptian text:

1. Write the lesson text without marks, add each new word to the dictionary (plain word -> marked word, same letters, only marks added), then run `node scripts/apply-eg-diacritics.mjs docs/data/eg-diacritics.json`. Words that are missing are listed.
2. `npm run generate:audio` makes the new clips (the text changed, so the clip names change); delete clips the manifest no longer lists.
3. The marks were written by an AI from the lessons' Latin transliterations and are not native-reviewed: a few words (long vowels in الله / ماشاء, loanwords) can only be approximated. Report wrong ones in the review page and fix them in the dictionary.

## Cairo pronunciation (ق and ج)

Cairo says ق as a glottal stop and ج as a hard g, but a text-to-speech voice reads the letters the Standard Arabic way. So the text sent to the voice (not the text shown) is changed in `scripts/eg-pronunciation.mjs`: ق becomes أ (قهوة -> أهوة) and ج becomes گ (جميل -> گميل). Words Egyptians say with a real q stay as they are: add them to `KEEP_Q` (today: القاهرة). After changing the rule run `npm run generate:audio -- --redo-eg`, which remakes only the Egyptian clips whose voice text changed.
