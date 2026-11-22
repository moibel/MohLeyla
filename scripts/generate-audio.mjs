// Pre-generates audio clips for every spoken text in the course using the macOS `say` voices + ffmpeg (mp3).
// Run on a Mac:  npm run generate:audio        (idempotent: existing clips are skipped; --force to redo)
// Voices: Arabic = Majed (ar_001, Standard Arabic; also used for the Saudi and Egyptian dialect tracks), English = Samantha (en_US),
// Indonesian = Damayanti (id_ID), French = Thomas (fr_FR), Spanish = Mónica (es_ES), Chinese = Tingting (zh_CN).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { audioKey, normalizeSpeech } from '../src/features/audio/hash.js';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const VOICES = {
  ar: { voice: 'Majed', rate: 135 }, en: { voice: 'Samantha', rate: 150 }, id: { voice: 'Damayanti', rate: 150 },
  fr: { voice: 'Thomas', rate: 150 }, es: { voice: 'Mónica', rate: 150 }, zh: { voice: 'Tingting', rate: 140 },
};
const speechLang = (track) => (track === 'sa' || track === 'eg' ? 'ar' : track);

function collect() {
  const texts = Object.fromEntries(Object.keys(VOICES).map((l) => [l, new Set()]));
  const dir = path.join(root, 'src/data/content');
  for (const track of fs.readdirSync(dir)) {
    const td = path.join(dir, track);
    if (!fs.statSync(td).isDirectory()) continue;
    const lang = speechLang(track);
    for (const f of fs.readdirSync(td).filter((x) => x.endsWith('.json'))) {
      for (const l of JSON.parse(fs.readFileSync(path.join(td, f), 'utf8'))) {
        for (const it of l.items) { texts[lang].add(normalizeSpeech(it.target)); texts[lang].add(normalizeSpeech(it.example.target)); }
        for (const c of l.cloze) texts[lang].add(normalizeSpeech(c.sentence.replace('___', c.answer)));
        for (const t of l.conversation.turns) texts[lang].add(normalizeSpeech(t.target));
        for (const w of l.conversation.wrong) texts[lang].add(normalizeSpeech(w));
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
  let idx = 0;
  const worker = async () => {
    while (idx < list.length) {
      const text = list[idx++];
      const key = audioKey(text, lang);
      const out = path.join(outDir, key + '.mp3');
      if (fs.existsSync(out) && !force) { skipped++; manifest[lang].push(key); continue; }
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
  await Promise.all(Array.from({ length: 4 }, worker));
  manifest[lang].sort();
}
fs.writeFileSync(path.join(root, 'public/audio/manifest.json'), JSON.stringify({ version: 1, voices: { ar: 'Majed (macOS, Standard Arabic)', en: 'Samantha (macOS, en-US)', id: 'Damayanti (macOS, id-ID)', fr: 'Thomas (macOS, fr-FR)', es: 'Mónica (macOS, es-ES)', zh: 'Tingting (macOS, zh-CN)' }, clips: manifest }));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`audio: ${made} generated, ${skipped} existing, ${failed} failed`);
if (failed) process.exit(1);
