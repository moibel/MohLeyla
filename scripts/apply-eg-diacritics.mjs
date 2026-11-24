// Adds Arabic vowel marks (tashkeel) to the SPOKEN Egyptian Arabic text of the lessons, from a word list.
//   node scripts/apply-eg-diacritics.mjs <dictionary.json> [--check]
// The dictionary maps each plain word to its vowelled form. Why: the Egyptian voice reads unmarked Arabic like Standard Arabic; with the
// marks it reads the Cairene vowels. Only the text the learner hears is changed (item words, example sentences, fill-in sentences and their
// answers/wrong choices, conversation lines and wrong replies). Titles, explanations and translations stay as they are.
// Idempotent: already-marked words are left as they are. --check only reports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dictFile = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!dictFile) { console.error('usage: node scripts/apply-eg-diacritics.mjs <dictionary.json> [--check]'); process.exit(2); }
const dict = JSON.parse(fs.readFileSync(dictFile, 'utf8'));
const MARKS = /[ً-ْ]/g;
// a word is a run of letters AND marks, so a word that already has some marks is looked up whole (its marks are replaced by the full set)
const WORD = /[ء-يٱً-ْ]+/g;
const missing = new Set();
const mark = (s) => String(s).replace(WORD, (w) => { const plain = w.replace(MARKS, ''); const d = dict[plain]; if (!d) { missing.add(plain); return w; } return d; });

const dir = path.join(root, 'src/data/content/eg');
let changed = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const file = path.join(dir, f);
  const lessons = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const l of lessons) {
    for (const it of l.items) { it.target = mark(it.target); it.example.target = mark(it.example.target); }
    for (const c of l.cloze) { c.sentence = mark(c.sentence); c.answer = mark(c.answer); c.wrong = c.wrong.map(mark); }
    for (const t of l.conversation.turns) t.target = mark(t.target);
    l.conversation.wrong = l.conversation.wrong.map(mark);
  }
  const out = JSON.stringify(lessons, null, 2) + '\n';
  const before = fs.readFileSync(file, 'utf8');
  if (out !== before) changed++;
  if (!checkOnly) fs.writeFileSync(file, out);
}
// every dictionary entry must be the same word plus marks only
const bad = Object.entries(dict).filter(([k, v]) => v.replace(MARKS, '') !== k);
if (bad.length) { console.error('dictionary entries that change letters:', bad.slice(0, 10)); process.exit(1); }
if (missing.size) { console.error('words missing from the dictionary:', [...missing].join(' ')); process.exit(1); }
console.log(`${checkOnly ? 'would change' : 'changed'} ${changed} file(s); ${Object.keys(dict).length} words`);
