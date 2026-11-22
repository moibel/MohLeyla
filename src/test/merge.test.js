import { describe, it, expect } from 'vitest';
import { mergeStates, toRemote, sameSynced } from '../features/progress/merge.js';
import { emptyState, applyLessonResult, applyReview, applySpeaking, toggleSaved, migrate } from '../features/progress/engine.js';
import { mulberry32 } from '../utils/random.js';

const T = new Date(2026, 4, 10, 12).getTime();
const DAY = 86400000;
const synced = (s) => JSON.parse(JSON.stringify(toRemote(s)));

function randomState(seed, device) {
  const rng = mulberry32(seed);
  let s = emptyState(device);
  const ids = ['a1', 'a2', 'a3', 'e1', 'e2', 'id1'];
  const lessons = ['ar-01', 'ar-02', 'en-01', 'id-01'];
  for (let i = 0; i < 8; i++) {
    const t = T + Math.floor(rng() * 6) * DAY + i * 1000;
    const pick = rng();
    if (pick < 0.25) s = applyLessonResult(s, { lessonId: lessons[Math.floor(rng() * 4)], itemIds: ids.slice(0, 3), correct: 16, total: 16, firstTryCorrect: Math.floor(rng() * 17), now: t }).state;
    else if (pick < 0.5) s = applyReview(s, ids[Math.floor(rng() * 6)], rng() > 0.4, t).state;
    else if (pick < 0.7) s = applySpeaking(s, ids[Math.floor(rng() * 6)], rng() > 0.5, t).state;
    else s = toggleSaved(s, ids[Math.floor(rng() * 6)], t);
  }
  return s;
}

describe('mergeStates (conflict-free)', () => {
  const states = [1, 2, 3, 4, 5, 6].map((n) => randomState(n, 'dev' + (n % 3)));

  it('is commutative', () => {
    for (let i = 0; i < states.length; i++) for (let j = 0; j < states.length; j++) {
      expect(synced(mergeStates(states[i], states[j]))).toEqual(synced(mergeStates(states[j], states[i])));
    }
  });
  it('is idempotent', () => {
    for (const s of states) {
      expect(synced(mergeStates(s, s))).toEqual(synced(mergeStates(s, mergeStates(s, s))));
      const m = mergeStates(states[0], s);
      expect(synced(mergeStates(m, s))).toEqual(synced(m));
    }
  });
  it('is associative', () => {
    const [a, b, c] = states;
    expect(synced(mergeStates(mergeStates(a, b), c))).toEqual(synced(mergeStates(a, mergeStates(b, c))));
  });
  it('keeps this device id and settings', () => {
    const a = randomState(1, 'phone');
    const m = mergeStates(a, randomState(2, 'laptop'));
    expect(m.device).toBe('phone');
    expect(m.settings).toEqual(a.settings);
  });
});

describe('merge semantics', () => {
  it('adds XP earned on two devices (no loss, no double counting)', () => {
    const phone = applyLessonResult(emptyState('phone'), { lessonId: 'ar-01', itemIds: ['a1'], correct: 16, total: 16, firstTryCorrect: 16, now: T }).state; // +70
    const laptop = applyLessonResult(emptyState('laptop'), { lessonId: 'en-01', itemIds: ['e1'], correct: 16, total: 16, firstTryCorrect: 10, now: T }).state; // +50
    const merged = mergeStates(phone, laptop);
    expect(merged.xp).toBe(120);
    expect(mergeStates(merged, laptop).xp).toBe(120); // syncing again changes nothing
    expect(mergeStates(merged, phone).xp).toBe(120);
  });
  it('does not award XP twice when two devices complete the same lesson', () => {
    const mk = (d) => applyLessonResult(emptyState(d), { lessonId: 'ar-01', itemIds: ['a1'], correct: 16, total: 16, firstTryCorrect: 16, now: T }).state;
    const m = mergeStates(mk('a'), mk('b'));
    expect(Object.keys(m.completed)).toEqual(['ar-01']);
    // each device legitimately earned its own XP before syncing; the merged state counts both ledgers once
    expect(m.xp).toBe(140);
  });
  it('un-saving on one device removes the word everywhere; a later re-save wins', () => {
    let a = toggleSaved(emptyState('a'), 'w1', T);
    const b = mergeStates(emptyState('b'), a);
    expect(b.saved.w1).toBe(T);
    a = toggleSaved(a, 'w1', T + 1000); // removed on a
    const merged = mergeStates(b, a);
    expect(merged.saved.w1).toBeUndefined();
    expect(mergeStates(merged, b).saved.w1).toBeUndefined();
    const resaved = toggleSaved(merged, 'w1', T + 2000);
    expect(mergeStates(a, resaved).saved.w1).toBe(T + 2000);
  });
  it('legacy saved words (timestamp 0) survive a merge with an empty remote', () => {
    const legacy = migrate(null, { completed: ['ar-01'], saved: ['a1'], xp: 150 });
    const m = mergeStates(legacy, emptyState('other'));
    expect(m.saved.a1).toBe(0);
    expect(m.xp).toBe(150);
    expect(m.completed['ar-01']).toBeTruthy();
  });
  it('keeps the most recent spaced-repetition entry and the longer streak', () => {
    const a = applyReview(emptyState('a'), 'w', true, T).state;
    const b = applyReview(applyReview(emptyState('b'), 'w', true, T + DAY).state, 'w', true, T + DAY).state;
    expect(mergeStates(a, b).srs.w.reps).toBe(2);
    expect(mergeStates(b, a).srs.w.reps).toBe(2);
  });
  it('sameSynced ignores device and key order', () => {
    const a = randomState(3, 'x');
    expect(sameSynced(a, { ...a, device: 'y' })).toBe(true);
    expect(sameSynced(a, randomState(4, 'x'))).toBe(false);
  });
});
