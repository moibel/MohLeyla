// Pre-generates audio clips for every spoken text in the course using the macOS `say` voices + ffmpeg (mp3).
// Run on a Mac:  npm run generate:audio        (idempotent: existing clips are skipped; --force to redo)
// Voices: Arabic = Majed (ar_001, Standard Arabic; also used for the Saudi and Egyptian dialect tracks), English = Samantha (en_US),
// Indonesian = Damayanti (id_ID), French = Thomas (fr_FR), Spanish = Mónica (es_ES), Chinese = Tingting (zh_CN).
// The Modern Standard Arabic course ('msa' clips) is made with ElevenLabs too (ELEVENLABS_VOICE_ID_AR; scripts/msa-tts.mjs).
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
import { audioKey, normalizeSpeech } from '../src/features/audio/hash.js';
import { chooseEngine } from './egyptian-tts.mjs';
import { chooseMsaEngine, chooseIdnEngine, chooseSauEngine } from './msa-tts.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
// --redo-eg: remake the Egyptian clips whose text has ق or ج (the letters the Cairo pronunciation rule touches)
const redoEg = process.argv.includes('--redo-eg');
const VOICES = {
  ar: { voice: 'Majed', rate: 135 }, en: { voice: 'Samantha', rate: 150 }, id: { voice: 'Damayanti', rate: 150 },
  fr: { voice: 'Thomas', rate: 150 }, es: { voice: 'Mónica', rate: 150 }, zh: { voice: 'Tingting', rate: 140 },
  eg: { engine: 'cloud' }, msa: { engine: 'cloud' }, idn: { engine: 'cloud' }, sau: { engine: 'cloud' },
};
// Saudi uses the Standard Arabic recordings; Egyptian is read in BOTH: its own (eg) and, as the fallback, the Standard Arabic ones (ar).
// The Arabic course ('ar') has its own ElevenLabs set ('msa') and the Indonesian course ('id') has 'idn' and the Saudi course ('sa') has 'sau'; the macOS recordings stay as their fallback.
const speechLangs = (track) => (track === 'sa' ? ['sau', 'ar'] : track === 'eg' ? ['eg', 'ar'] : track === 'ar' ? ['msa', 'ar'] : track === 'id' ? ['idn', 'id'] : [track]);
const egEngine = chooseEngine(root);
const msaEngine = chooseMsaEngine(root);
const idnEngine = chooseIdnEngine(root);
const sauEngine = chooseSauEngine(root);
const engines = { eg: egEngine, msa: msaEngine, idn: idnEngine, sau: sauEngine };
const WHAT = { eg: 'Egyptian', msa: 'Modern Standard Arabic', idn: 'Indonesian', sau: 'Saudi' };

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
  const eng = engines[lang];
  const haveEng = !!eng && eng.name !== 'none';
  if (viaCloud && !haveEng) console.log(`audio: ${lang}: ${eng.reason}, so no new ${WHAT[lang]} recordings are made (existing ones are kept; the app uses the macOS recordings for lines without one).`);
  if (viaCloud && haveEng) console.log(`audio: ${lang}: making ${WHAT[lang]} recordings with ${eng.label}`);
  let idx = 0;
  const worker = async () => {
    while (idx < list.length) {
      const text = list[idx++];
      const key = audioKey(text, lang);
      const out = path.join(outDir, key + '.mp3');
      if (fs.existsSync(out) && !force && !(redoEg && lang === 'eg' && haveEng && /[قج]/.test(text))) { skipped++; manifest[lang].push(key); continue; }
      if (viaCloud) {
        if (!haveEng) continue;
        try {
          let bytes;
          for (let attempt = 1; ; attempt++) {
            try { bytes = await eng.synthesize(text); break; } catch (e) { if (attempt >= 4 || !/rate limited|HTTP 5/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 1500 * attempt)); }
          }
          if (eng.convert) {
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
fs.writeFileSync(path.join(root, 'public/audio/manifest.json'), JSON.stringify({ version: 1, voices: { ar: 'Majed (macOS, Standard Arabic)', en: 'Samantha (macOS, en-US)', id: 'Damayanti (macOS, id-ID)', fr: 'Thomas (macOS, fr-FR)', es: 'Mónica (macOS, es-ES)', zh: 'Tingting (macOS, zh-CN)', ...(manifest.eg.length ? { eg: `${egEngine.label || 'cloud voice'} (Egyptian Arabic)` } : {}), ...(manifest.msa.length ? { msa: `${msaEngine.label || 'cloud voice'} (Modern Standard Arabic)` } : {}), ...(manifest.idn.length ? { idn: `${idnEngine.label || 'cloud voice'} (Indonesian)` } : {}), ...(manifest.sau.length ? { sau: `${sauEngine.label || 'cloud voice'} (Saudi Arabic)` } : {}) }, clips: manifest }));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`audio: ${made} generated, ${skipped} existing, ${failed} failed`);
if (failed) process.exit(1);
