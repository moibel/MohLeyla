// Pre-generates audio clips for every spoken text in the course using the macOS `say` voices + ffmpeg (mp3).
// Run on a Mac:  npm run generate:audio        (idempotent: existing clips are skipped; --force to redo)
// Voices: Arabic = Majed (ar_001, Standard Arabic; also used for the Saudi and Egyptian dialect tracks), English = Samantha (en_US),
// Indonesian = Damayanti (id_ID), French = Thomas (fr_FR), Spanish = Mónica (es_ES), Chinese = Tingting (zh_CN).
// Egyptian Arabic ('eg') is different: macOS has no Egyptian voice (Majed would read it in Standard Arabic pronunciation), so those clips come
// from an Egyptian neural voice: ElevenLabs (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID) or Azure Speech (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION),
// from the environment or a git-ignored .env.local (scripts/egyptian-tts.mjs picks the service; see docs/EGYPTIAN_AUDIO.md).
// Without a key the Egyptian clips are skipped (existing ones are kept) and the app falls back to the Standard Arabic recordings, which this
// script still makes for the Egyptian texts under 'ar'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { toCairene } from './eg-pronunciation.mjs';
import { audioKey, normalizeSpeech } from '../src/features/audio/hash.js';
import { chooseEngine } from './egyptian-tts.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
// --redo-eg: remake only the Egyptian clips whose voice text changes under the Cairo pronunciation rule (ق -> ʾ, ج -> g)
const redoEg = process.argv.includes('--redo-eg');
const VOICES = {
  ar: { voice: 'Majed', rate: 135 }, en: { voice: 'Samantha', rate: 150 }, id: { voice: 'Damayanti', rate: 150 },
  fr: { voice: 'Thomas', rate: 150 }, es: { voice: 'Mónica', rate: 150 }, zh: { voice: 'Tingting', rate: 140 },
  eg: { engine: 'cloud' },
};
// Saudi uses the Standard Arabic recordings; Egyptian is read in BOTH: its own (eg) and, as the fallback, the Standard Arabic ones (ar).
const speechLangs = (track) => (track === 'sa' ? ['ar'] : track === 'eg' ? ['eg', 'ar'] : [track]);
const egEngine = chooseEngine(root);
const haveEgEngine = egEngine.name !== 'none';

function collect() {
  const texts = Object.fromEntries(Object.keys(VOICES).map((l) => [l, new Set()]));
  const dir = path.join(root, 'src/data/content');
  for (const track of fs.readdirSync(dir)) {
    const td = path.join(dir, track);
    if (!fs.statSync(td).isDirectory()) continue;
    for (const f of fs.readdirSync(td).filter((x) => x.endsWith('.json'))) {
      for (const l of JSON.parse(fs.readFileSync(path.join(td, f), 'utf8'))) {
        const add = (s) => { for (const lang of speechLangs(track)) texts[lang].add(normalizeSpeech(s)); };
        for (const it of l.items) { add(it.target); add(it.example.target); }
        for (const c of l.cloze) add(c.sentence.replace('___', c.answer));
        for (const t of l.conversation.turns) add(t.target);
        for (const w of l.conversation.wrong) add(w);
      }
    }
  }
  return texts;
}

const texts = collect();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mohleyla-audio-'));
const manifest = {};
let made = 0, skipped = 0, failed = 0;
for (const lang of Object.keys(texts)) {
  const outDir = path.join(root, 'public/audio', lang);
  fs.mkdirSync(outDir, { recursive: true });
  manifest[lang] = [];
  const list = [...texts[lang]];
  const viaCloud = VOICES[lang].engine === 'cloud';
  if (viaCloud && !haveEgEngine) console.log(`audio: ${lang}: ${egEngine.reason}, so no new Egyptian recordings are made (existing ones are kept; the app uses the Standard Arabic recordings for lines without one).`);
  if (viaCloud && haveEgEngine) console.log(`audio: ${lang}: making Egyptian recordings with ${egEngine.label}`);
  let idx = 0;
  const worker = async () => {
    while (idx < list.length) {
      const text = list[idx++];
      const key = audioKey(text, lang);
      const out = path.join(outDir, key + '.mp3');
      if (fs.existsSync(out) && !force && !(redoEg && VOICES[lang].engine === 'cloud' && haveEgEngine && toCairene(text) !== text)) { skipped++; manifest[lang].push(key); continue; }
      if (viaCloud) {
        if (!haveEgEngine) continue;
        try {
          let bytes;
          for (let attempt = 1; ; attempt++) {
            try { bytes = await egEngine.synthesize(text); break; } catch (e) { if (attempt >= 4 || !/rate limited|HTTP 5/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 1500 * attempt)); }
          }
          if (egEngine.convert) {
            // same format as every other clip (mono, 24 kHz, 40 kbps), so the files stay small
            const raw = path.join(tmp, `${lang}-${key}.raw.mp3`);
            fs.writeFileSync(raw, bytes);
            await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out]);
            fs.rmSync(raw, { force: true });
          } else fs.writeFileSync(out, bytes);
          manifest[lang].push(key); made++;
        } catch (e) { failed++; console.error(`FAILED [${lang}] ${text}: ${e.message}`); }
        continue;
      }
      const aiff = path.join(tmp, `${lang}-${key}.aiff`);
      try {
        const { voice, rate } = VOICES[lang];
        await run('say', ['-v', voice, '-r', String(rate), '-o', aiff, '--', text]);
        await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', aiff, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out]);
        fs.rmSync(aiff, { force: true });
        manifest[lang].push(key); made++;
      } catch (e) { failed++; console.error(`FAILED [${lang}] ${text}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: viaCloud ? 3 : 4 }, worker));
  manifest[lang].sort();
}
fs.writeFileSync(path.join(root, 'public/audio/manifest.json'), JSON.stringify({ version: 1, voices: { ar: 'Majed (macOS, Standard Arabic)', en: 'Samantha (macOS, en-US)', id: 'Damayanti (macOS, id-ID)', fr: 'Thomas (macOS, fr-FR)', es: 'Mónica (macOS, es-ES)', zh: 'Tingting (macOS, zh-CN)', ...(manifest.eg.length ? { eg: `${haveEgEngine ? egEngine.label : 'cloud voice'} (Egyptian Arabic)` } : {}) }, clips: manifest }));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`audio: ${made} generated, ${skipped} existing, ${failed} failed`);
if (failed) process.exit(1);
