# Egyptian Arabic audio

## The problem this fixes
Egyptian lessons used to be read by the Standard Arabic voice ("Majed", macOS). That voice pronounces Egyptian words the Standard way (ج as "j", ق as "q", full vowels), so it taught the wrong sounds. macOS has no Egyptian voice, so a different source is needed.

## How the app now works
- Egyptian Arabic has its **own recordings**: `public/audio/eg/<hash>.mp3` (hash of `eg|text`, listed in `manifest.json` under `eg`).
- A line **without** an Egyptian recording falls back to the old Standard Arabic recording (`public/audio/ar/...`), and the lesson keeps saying "read by a Standard Arabic voice, not an Egyptian accent" **for that line only**. A line with an Egyptian recording shows no such note.
- Only after that does the device voice speak (preferring an `ar-EG` voice).
- Saudi Arabic is unchanged (Standard Arabic voice, labelled).

## Making the Egyptian recordings (Azure Speech, free tier)
Microsoft's Egyptian neural voices: `ar-EG-SalmaNeural` (female, default) and `ar-EG-ShakirNeural` (male). The free tier is 500,000 characters a month; the whole Egyptian course is about 9,300 characters (about 630 short lines).

1. Create a free Azure account (portal.azure.com; a card is asked for identity checks, the free tier is not charged).
2. Create a resource: **Speech** (search "Speech" in the portal), pricing tier **Free F0**, any region close to you (for example West Europe).
3. Open the resource -> **Keys and Endpoint**. Note **KEY 1** and the **Location/Region** (for example `westeurope`).
4. In the project folder create a file named `.env.local` (it is git-ignored, so it cannot be committed) containing:
```
AZURE_SPEECH_KEY=<KEY 1>
AZURE_SPEECH_REGION=westeurope
# optional: AZURE_EG_VOICE=ar-EG-ShakirNeural
```
**Never paste the key into chat, a commit or a screenshot.** If it leaks, regenerate it under Keys and Endpoint.
5. Run `npm run generate:audio` (only missing clips are made; about a minute), then `npm run export:eg-audio-review`.
6. Open `docs/native-review/eg-audio.html` in a browser and **listen** (or send it to an Egyptian speaker): it lists every line with the new recording and the old one side by side, and a column for corrections. A line whose recording is wrong can be changed in the lesson text (or its recording deleted so the fallback is used), then regenerated.

## Licensing and honesty notes
- Azure Speech output may be used in an application under Microsoft's terms for the service; keep the key private and check the current terms for your use.
- The recordings are machine voices, much closer to Egyptian than the old ones, but they have **not been listened to by a native speaker yet**. The beta label stays until that is done.
- Egyptian lessons were written in everyday Cairene spelling without vowel marks; the neural voice decides the vowels. A few words may need a spelling tweak to be pronounced as intended, which the listening page is for.
