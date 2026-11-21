import { describe, it, expect } from 'vitest';
import { migrate, emptyState, applyLessonResult, applyReview, toggleSaved, dueItems, liveStreak, XP, parseBackup, exportBackup, isMastered, touchDay } from '../features/progress/engine.js';
import { loadState, saveState } from '../features/progress/storage.js';
import { localDay } from '../utils/dates.js';

const T0 = new Date(2026, 4, 10, 12).getTime();
const DAY = 86400000;
const res = (o = {}) => ({ lessonId: 'ar-01', itemIds: ['a1', 'a2'], correct: 16, total: 16, firstTryCorrect: 16, now: T0, ...o });

describe('legacy migration (v1-v5 -> v6)', () => {
  it('preserves completed lessons, saved words and xp', () => {
    const s = migrate(null, { completed: ['ar-01', 'en-02'], saved: ['a1', 'e3'], xp: 150 });
    expect(Object.keys(s.completed).sort()).toEqual(['ar-01', 'en-02']);
    expect(Object.keys(s.saved).sort()).toEqual(['a1', 'e3']);
    expect(s.xp).toBe(150);
  });
  it('loads the legacy localStorage key and does not delete it', () => {
    localStorage.setItem('mohleyla-v1', JSON.stringify({ completed: ['ar-01'], saved: ['a1'], xp: 50 }));
    const { state } = loadState();
    expect(state.xp).toBe(50);
    expect(localStorage.getItem('mohleyla-v1')).not.toBeNull();
    saveState(state);
    expect(loadState().state.completed['ar-01']).toBeTruthy();
  });
  it('survives junk input', () => {
    expect(migrate('x').xp).toBe(0);
    localStorage.setItem('mohleyla-v6', '{broken');
    expect(loadState().state.xp).toBe(0);
  });
  it('does not re-award xp for a migrated completed lesson', () => {
    const s = migrate(null, { completed: ['ar-01'], saved: [], xp: 50 });
    const r = applyLessonResult(s, res());
    expect(r.xp).toBe(0);
    expect(r.state.xp).toBe(50);
  });
});

describe('xp rules', () => {
  it('awards 50 + 20 perfect bonus once', () => {
    const a = applyLessonResult(emptyState(), res());
    expect(a.xp).toBe(XP.lesson + XP.perfectBonus);
    const b = applyLessonResult(a.state, res({ now: T0 + 1000 }));
    expect(b.xp).toBe(0);
    expect(b.state.xp).toBe(70);
    expect(b.state.completed['ar-01'].attempts).toBe(2);
  });
  it('awards 50 without bonus when not perfect and tracks best score', () => {
    const a = applyLessonResult(emptyState(), res({ firstTryCorrect: 12, correct: 16 }));
    expect(a.xp).toBe(50);
    const b = applyLessonResult(a.state, res({ firstTryCorrect: 16, correct: 16, now: T0 + 5 }));
    expect(b.state.completed['ar-01'].best).toBe(100);
    expect(b.state.xp).toBe(50);
  });
  it('review xp is capped per day', () => {
    let s = emptyState();
    let total = 0;
    for (let i = 0; i < 40; i++) { const r = applyReview(s, 'a' + (i % 5), true, T0 + i); s = r.state; total += r.xp; }
    expect(total).toBe(XP.reviewDailyCap);
  });
});

describe('streaks', () => {
  it('increments on consecutive days, resets after a gap', () => {
    let s = emptyState();
    s = touchDay(s, '2026-05-10'); expect(s.streak.current).toBe(1);
    s = touchDay(s, '2026-05-10'); expect(s.streak.current).toBe(1);
    s = touchDay(s, '2026-05-11'); expect(s.streak.current).toBe(2);
    s = touchDay(s, '2026-05-12'); expect(s.streak.best).toBe(3);
    s = touchDay(s, '2026-05-15'); expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(3);
    expect(liveStreak(s, '2026-05-16')).toBe(1);
    expect(liveStreak(s, '2026-05-18')).toBe(0);
  });
});

describe('spaced repetition', () => {
  it('moves up boxes with longer gaps and resets on a miss', () => {
    let s = emptyState();
    const today = localDay(new Date(T0));
    s = applyReview(s, 'a1', true, T0).state;
    expect(s.srs.a1.box).toBe(2);
    for (let i = 0; i < 5; i++) s = applyReview(s, 'a1', true, T0 + i).state;
    expect(isMastered(s.srs.a1)).toBe(true);
    expect(s.srs.a1.due > today).toBe(true);
    s = applyReview(s, 'a1', false, T0).state;
    expect(s.srs.a1.box).toBe(1);
    expect(s.srs.a1.lapses).toBe(1);
  });
  it('queues due and new items, capped', () => {
    let s = applyLessonResult(emptyState(), res({ itemIds: ['a1', 'a2', 'a3'] })).state;
    const pool = new Set(['a1', 'a2', 'a3', 'z1', 'z2']);
    const tomorrow = localDay(new Date(T0 + DAY));
    const q = dueItems(s, pool, tomorrow);
    expect(q.overdue).toBe(3);
    expect(q.session.length).toBe(5);
    expect(dueItems(s, pool, localDay(new Date(T0))).overdue).toBe(0);
  });
  it('saving toggles', () => {
    let s = toggleSaved(emptyState(), 'a1'); expect('a1' in s.saved).toBe(true);
    s = toggleSaved(s, 'a1'); expect('a1' in s.saved).toBe(false);
  });
});

describe('backup', () => {
  it('round-trips and rejects foreign files', () => {
    const s = applyLessonResult(emptyState(), res()).state;
    expect(parseBackup(exportBackup(s)).xp).toBe(70);
    expect(parseBackup('{"a":1}')).toBeNull();
    expect(parseBackup('nope')).toBeNull();
  });
});
