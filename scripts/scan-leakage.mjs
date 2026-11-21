// Heuristic scan for language mix-ups in trilingual strings (not a substitute for native review).
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/data/content');
const ID = /\b(yang|dan|untuk|dengan|saya|kamu|adalah|tidak|ini|itu|atau|pada|dari|akan|bisa|juga)\b/i;
const EN = /\b(the|and|you|your|is|are|this|that|with|for|have|will|can)\b/i;
const out = [];
const walk = (o, p, track) => {
  if (!o || typeof o !== 'object') return;
  if (typeof o.en === 'string' && typeof o.id === 'string' && typeof o.ar === 'string') {
    // en field with Indonesian words, but skip if the learning language is Indonesian (examples may legitimately quote id)
    if (track !== 'id' && ID.test(o.en) && !EN.test(o.en)) out.push(`${p}.en looks Indonesian: ${o.en}`);
    if (track !== 'en' && EN.test(o.id) && !ID.test(o.id)) out.push(`${p}.id looks English: ${o.id}`);
    if (o.en.trim() === o.id.trim() && o.en.length > 25) out.push(`${p}: en == id: ${o.en}`);
  }
  for (const [k, v] of Object.entries(o)) walk(v, `${p}.${k}`, track);
};
for (const t of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, t))) for (const l of JSON.parse(fs.readFileSync(path.join(root, t, f), 'utf8'))) walk(l, l.id, l.track);
console.log(out.length ? out.join('\n') : 'no obvious leakage');
console.log(out.length, 'findings');
