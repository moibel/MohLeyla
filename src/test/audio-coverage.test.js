import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { audioKey, normalizeSpeech } from '../features/audio/hash.js';
import { trackLang, speechLang } from '../data/validateContent.js';

// Every sentence the app can speak must have a recorded clip, in every language, so nothing falls back to a device voice by accident.
const dir = path.resolve(__dirname, '../data/content');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/audio/manifest.json'), 'utf8'));
const have = Object.fromEntries(Object.entries(manifest.clips).map(([l, keys]) => [l, new Set(keys)]));

describe('audio coverage', () => {
  for (const track of fs.readdirSync(dir)) {
    it(`every word, example, cloze and dialogue line of the ${track} track has a clip (and the file exists)`, () => {
      // Egyptian lines are covered by their own recording OR, until one exists, by the Standard Arabic recording the app falls back to.
      const langs = track === 'eg' ? ['eg', 'ar'] : [trackLang(track)];
      const missing = [];
      const has = (lang, text) => { const k = audioKey(normalizeSpeech(text), lang); return have[lang]?.has(k) && fs.existsSync(path.resolve(__dirname, `../../public/audio/${lang}/${k}.mp3`)); };
      const need = (text) => { if (!langs.some((l) => has(l, text))) missing.push(text); };
      for (const f of fs.readdirSync(path.join(dir, track))) {
        for (const l of JSON.parse(fs.readFileSync(path.join(dir, track, f), 'utf8'))) {
          for (const it of l.items) { need(it.target); need(it.example.target); }
          for (const c of l.cloze) need(c.sentence.replace('___', c.answer));
          for (const t of l.conversation.turns) need(t.target);
          for (const w of l.conversation.wrong) need(w);
        }
      }
      expect(missing.slice(0, 5), `${missing.length} texts without a clip`).toEqual([]);
    });
  }

  it('reports how many Egyptian lines already have a real Egyptian recording (informational: the rest use the Standard Arabic fallback)', () => {
    const texts = new Set();
    for (const f of fs.readdirSync(path.join(dir, 'eg'))) for (const l of JSON.parse(fs.readFileSync(path.join(dir, 'eg', f), 'utf8'))) {
      for (const it of l.items) { texts.add(it.target); texts.add(it.example.target); }
      for (const c of l.cloze) texts.add(c.sentence.replace('___', c.answer));
      for (const t of l.conversation.turns) texts.add(t.target);
      for (const w of l.conversation.wrong) texts.add(w);
    }
    const native = [...texts].filter((t) => have.eg?.has(audioKey(normalizeSpeech(t), 'eg'))).length;
    // eslint-disable-next-line no-console
    console.log(`Egyptian recordings: ${native} of ${texts.size} lines have a real Egyptian recording`);
    expect(native).toBeLessThanOrEqual(texts.size);
    // all-or-nothing is not required, but a clip listed in the manifest must exist on disk
    for (const k of have.eg || []) expect(fs.existsSync(path.resolve(__dirname, `../../public/audio/eg/${k}.mp3`)), k).toBe(true);
    void speechLang;
  });
});
