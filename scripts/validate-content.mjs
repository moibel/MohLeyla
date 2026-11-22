// Usage: node scripts/validate-content.mjs [file-or-dir ...] [--strict]
// With no path: validates every JSON file under src/data/content.
// --strict additionally requires the expected number of lessons per track (30 for the original four, 10 for the beta tracks) with unique orders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLessons, TRACKS, TRACK_SIZES } from '../src/data/validateContent.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const strict = process.argv.includes('--strict');

function collect(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).flatMap((f) => collect(path.join(p, f)));
  return p.endsWith('.json') ? [p] : [];
}

const targets = args.length ? args : [path.join(root, 'src/data/content')];
const files = targets.flatMap(collect);
let lessons = [];
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    lessons = lessons.concat(Array.isArray(data) ? data : [data]);
  } catch (e) {
    console.error(`JSON error in ${f}: ${e.message}`);
    process.exit(1);
  }
}

const errors = validateLessons(lessons);
if (strict) {
  for (const t of TRACKS) {
    const ls = lessons.filter((l) => l.track === t);
    if (ls.length !== TRACK_SIZES[t]) errors.push(`track ${t}: ${ls.length} lessons, expected ${TRACK_SIZES[t]}`);
    const orders = new Set(ls.map((l) => l.order));
    if (orders.size !== ls.length) errors.push(`track ${t}: duplicate order values`);
  }
}
const items = lessons.reduce((n, l) => n + (l.items?.length || 0), 0);
console.log(`Checked ${files.length} file(s): ${lessons.length} lessons, ${items} items.`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  errors.slice(0, 200).forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log('Content OK.');
