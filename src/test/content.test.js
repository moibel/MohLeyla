import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateLessons, TRACKS, TRACK_SIZES } from '../data/validateContent.js';
import { buildExercises, validateExercise, evaluate } from '../features/quizzes/generate.js';
import { mulberry32 } from '../utils/random.js';

const dir = path.resolve(__dirname, '../data/content');
const lessons = fs.readdirSync(dir).flatMap((t) => fs.readdirSync(path.join(dir, t)).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, t, f), 'utf8'))));
const legacy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/legacy-v5-lessons.json'), 'utf8'));

describe('content', () => {
  it('has the expected number of lessons for every track (30 for every track; 240 in all)', () => {
    for (const t of TRACKS) expect(lessons.filter((l) => l.track === t), t).toHaveLength(TRACK_SIZES[t]);
    expect(lessons).toHaveLength(Object.values(TRACK_SIZES).reduce((a, b) => a + b, 0));
    expect(lessons).toHaveLength(240);
  });
  it('passes structural validation (trilingual, scripts, unique ids, distractors)', () => {
    expect(validateLessons(lessons)).toEqual([]);
  });
  it('has unique lesson ids and unique orders per track', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const t of TRACKS) {
      const orders = lessons.filter((l) => l.track === t).map((l) => l.order).sort((a, b) => a - b);
      expect(orders, t).toEqual(Array.from({ length: TRACK_SIZES[t] }, (_, i) => i + 1));
    }
  });
  it('keeps every legacy v5 lesson and item id (saved words / progress stay valid)', () => {
    const byId = new Map(lessons.map((l) => [l.id, new Set(l.items.map((i) => i.id))]));
    for (const l of legacy) {
      expect(byId.has(l.id), `lesson ${l.id}`).toBe(true);
      for (const it of l.items) expect(byId.get(l.id).has(it.id), `item ${it.id}`).toBe(true);
    }
  });
});

describe('exercises', () => {
  for (const ui of ['ar', 'en', 'id']) {
    it(`every lesson produces valid exercises with a unique correct answer (ui=${ui})`, () => {
      lessons.forEach((l, k) => {
        const exs = buildExercises(l, ui, mulberry32(k + 1));
        expect(exs.length).toBeGreaterThanOrEqual(14);
        const types = new Set(exs.map((e) => e.type));
        // Chinese text has no spaces, so the "put the words in order" exercise does not exist for that track
        for (const need of ['listening', 'match', 'fill', 'arrange', 'translate', 'conversation']) if (!(need === 'arrange' && l.track === 'zh')) expect(types.has(need), `${l.id} ${need}`).toBe(true);
        for (const e of exs) {
          expect(validateExercise(e), `${l.id} ${e.id}`).toEqual([]);
          if (e.choices) expect(evaluate(e, e.answerId).correct).toBe(true);
          if (e.choices) expect(evaluate(e, '__nope__').correct).toBe(false);
          if (e.type === 'arrange') expect(evaluate(e, e.tokens).correct).toBe(true);
        }
      });
    });
  }
  it('does not always place the correct answer first', () => {
    const pos = new Set();
    lessons.slice(0, 20).forEach((l, k) => buildExercises(l, 'en', mulberry32(100 + k)).forEach((e) => e.choices && pos.add(e.choices.findIndex((c) => c.id === e.answerId))));
    expect(pos.size).toBeGreaterThanOrEqual(3);
  });
});
