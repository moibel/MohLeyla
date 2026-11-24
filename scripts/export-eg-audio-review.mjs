// Writes docs/native-review/eg-audio.html: every Egyptian line with its recording(s), so a native speaker can listen in a browser and tick
// what is wrong. Open the file locally (it links to public/audio/...). Run: npm run export:eg-audio-review
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey, normalizeSpeech } from '../src/features/audio/hash.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/data/content/eg');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/audio/manifest.json'), 'utf8')).clips;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const player = (text, lang) => {
  const k = audioKey(normalizeSpeech(text), lang);
  return manifest[lang]?.includes(k) ? `<audio controls preload="none" src="../../public/audio/${lang}/${k}.mp3"></audio>` : '<span class="none">—</span>';
};
const lessons = fs.readdirSync(dir).filter((f) => /^part\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.order - b.order);
let total = 0, native = 0;
let body = '';
for (const l of lessons) {
  const rows = [];
  const add = (kind, text, meaning) => { total++; if (manifest.eg?.includes(audioKey(normalizeSpeech(text), 'eg'))) native++; rows.push(`<tr><td>☐</td><td>${esc(kind)}</td><td dir="rtl" lang="ar-EG" class="ar">${esc(text)}</td><td>${esc(meaning || '')}</td><td>${player(text, 'eg')}</td><td>${player(text, 'ar')}</td><td></td></tr>`); };
  for (const it of l.items) { add('word', it.target, `${it.translit} — ${it.tr.en}`); add('example', it.example.target, it.example.tr.en); }
  for (const c of l.cloze) add('fill-in', c.sentence.replace('___', c.answer), c.tr.en);
  l.conversation.turns.forEach((t) => add('dialogue', t.target, t.tr.en));
  body += `<h2>Lesson ${l.order}: ${esc(l.title.en)}</h2><table><thead><tr><th>OK</th><th>Type</th><th>Egyptian text</th><th>Pronunciation / meaning</th><th>Egyptian recording</th><th>Standard Arabic (old)</th><th>Correction</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Egyptian Arabic audio review</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;max-width:1200px}table{border-collapse:collapse;width:100%;margin:8px 0 28px}th,td{border:1px solid #ccd;padding:6px 8px;text-align:start;vertical-align:middle}th{background:#eef}.ar{font-size:1.25rem}.none{color:#999}audio{max-width:200px;height:34px}</style></head><body>
<h1>Egyptian Arabic: listen and check</h1>
<p><strong>${native} of ${total}</strong> lines have a real Egyptian recording so far. For each line: does the Egyptian recording sound like natural Cairene speech (not Standard Arabic)? Is it the right words, spoken clearly? Write what is wrong in the last column. The "Standard Arabic (old)" column is the previous voice, for comparison.</p>${body}</body></html>`;
fs.mkdirSync(path.join(root, 'docs/native-review'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/native-review/eg-audio.html'), html);
console.log(`eg-audio.html: ${total} lines, ${native} with a real Egyptian recording`);
