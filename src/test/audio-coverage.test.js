import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { audioKey, normalizeSpeech } from '../features/audio/hash.js';
import { trackLang } from '../data/validateContent.js';

// Every sentence the app can speak must have a recorded clip, in every language, so nothing falls back to a device voice by accident.
const dir = path.resolve(__dirname, '../data/content');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/audio/manifest.json'), 'utf8'));
const have = Object.fromEntries(Object.entries(manifest.clips).map(([l, keys]) => [l, new Set(keys)]));

describe('audio coverage', () => {
  for (const track of fs.readdirSync(dir)) {
    it(`every word, example, cloze and dialogue line of the ${track} track has a clip (and the file exists)`, () => {
      const lang = trackLang(track);
      const missing = [];
      const need = (text) => { const k = audioKey(normalizeSpeech(text), lang); if (!have[lang]?.has(k) || !fs.existsSync(path.resolve(__dirname, `../../public/audio/${lang}/${k}.mp3`))) missing.push(text); };
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
});
