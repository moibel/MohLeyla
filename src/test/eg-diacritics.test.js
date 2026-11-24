import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The Egyptian voice reads unmarked Arabic like Standard Arabic, so every Egyptian word the learner HEARS must carry vowel marks.
// New lessons: add the words to a dictionary and run `node scripts/apply-eg-diacritics.mjs <dictionary.json>` (see docs/EGYPTIAN_AUDIO.md).
const dir = path.resolve(__dirname, '../data/content/eg');
const MARK = /[ً-ْ]/;
const WORD = /[ء-يٱً-ْ]+/g;
const spoken = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  for (const l of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
    for (const it of l.items) spoken.push([l.id, it.target], [l.id, it.example.target]);
    for (const c of l.cloze) spoken.push([l.id, c.sentence.replace('___', c.answer)]);
    for (const t of l.conversation.turns) spoken.push([l.id, t.target]);
  }
}

describe('Egyptian lessons: spoken text has vowel marks', () => {
  it('every word of every spoken line is vowelled', () => {
    const bare = [];
    for (const [id, s] of spoken) for (const w of s.match(WORD) || []) if (w.length > 1 && !MARK.test(w) && !/^آ?[اآ]$/.test(w)) bare.push(`${id}: ${w}`);
    expect(bare.slice(0, 10), `${bare.length} unmarked words`).toEqual([]);
  });
});
