// Pure progress logic: state shape, legacy migration, XP rules, streaks, spaced repetition, achievements.
// No React, no DOM: everything takes `now`/`today` explicitly so it is deterministic and unit-testable.
import { addDays, diffDays, localDay } from '../../utils/dates.js';

export const STORAGE_KEY = 'mohleyla-v6';
export const LEGACY_KEY = 'mohleyla-v1'; // v1-v5 stored { completed: string[], saved: string[], xp: number }
export const SCHEMA = 6;

export const XP = { lesson: 50, perfectBonus: 20, reviewCorrect: 2, reviewDailyCap: 40 };
export const GOALS = [30, 50, 100];
export const SRS_INTERVALS = [0, 0, 1, 2, 4, 8, 16]; // days, indexed by box (1..6)
export const MAX_BOX = 6;
export const MASTERED_BOX = 5;

export const defaultSettings = () => ({ speed: 'normal', source: 'auto', goal: 50, theme: 'system', onboarded: false, lastTrack: null });

export function emptyState() {
  return {
    schema: SCHEMA,
    completed: {}, // lessonId -> { first, last, best, attempts, perfect }
    saved: {}, // itemId -> timestamp
    srs: {}, // itemId -> { box, due, reps, lapses, last }
    xp: 0,
    stats: { answered: 0, correct: 0, reviewSessions: 0, reviewAnswered: 0, reviewCorrect: 0 },
    days: {}, // YYYY-MM-DD -> { xp, reviewXp, answered }
    streak: { current: 0, best: 0, last: null },
    settings: defaultSettings(),
  };
}

/** Upgrade any stored value (v6 object, legacy v1 object, or junk) to a valid v6 state. Never throws, never loses data. */
export function migrate(raw, legacy) {
  const base = emptyState();
  const src = raw && typeof raw === 'object' ? raw : null;
  if (src && src.schema === SCHEMA) {
    return {
      ...base,
      ...src,
      stats: { ...base.stats, ...(src.stats || {}) },
      streak: { ...base.streak, ...(src.streak || {}) },
      settings: { ...base.settings, ...(src.settings || {}) },
      completed: src.completed || {},
      saved: src.saved || {},
      srs: src.srs || {},
      days: src.days || {},
    };
  }
  const old = src || legacy;
  if (old && typeof old === 'object') {
    const s = emptyState();
    if (Array.isArray(old.completed)) for (const id of old.completed) if (typeof id === 'string') s.completed[id] = { first: null, last: null, best: null, attempts: 1, perfect: false };
    if (Array.isArray(old.saved)) for (const id of old.saved) if (typeof id === 'string') s.saved[id] = 0;
    if (Number.isFinite(old.xp) && old.xp > 0) s.xp = Math.floor(old.xp);
    return s;
  }
  return base;
}

export function touchDay(state, today) {
  const days = { ...state.days, [today]: { xp: 0, reviewXp: 0, answered: 0, ...(state.days[today] || {}) } };
  // Keep roughly the last 90 days.
  const keys = Object.keys(days).sort();
  if (keys.length > 90) for (const k of keys.slice(0, keys.length - 90)) delete days[k];
  const st = state.streak;
  let current = st.current;
  if (st.last !== today) current = st.last && diffDays(st.last, today) === 1 ? st.current + 1 : 1;
  return { ...state, days, streak: { current, best: Math.max(st.best, current), last: today } };
}

/** Streak as it should be displayed right now: a streak is broken if the last activity was before yesterday. */
export function liveStreak(state, today) {
  const { last, current } = state.streak;
  if (!last) return 0;
  return diffDays(last, today) <= 1 ? current : 0;
}

const addXp = (state, today, amount, extra = {}) => ({
  ...state,
  xp: state.xp + amount,
  days: { ...state.days, [today]: { ...state.days[today], xp: (state.days[today]?.xp || 0) + amount, ...extra } },
});

/**
 * Apply the result of finishing a lesson practice.
 * XP is awarded only the first time a lesson is completed (+50, +20 more for a perfect first-try run).
 */
export function applyLessonResult(state, { lessonId, itemIds, correct, total, firstTryCorrect, now = Date.now() }) {
  const today = localDay(new Date(now));
  let s = touchDay(state, today);
  const prev = s.completed[lessonId];
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const perfect = total > 0 && firstTryCorrect === total;
  let xp = 0;
  if (!prev) {
    xp = XP.lesson + (perfect ? XP.perfectBonus : 0);
  }
  s = {
    ...s,
    completed: {
      ...s.completed,
      [lessonId]: {
        first: prev?.first ?? now,
        last: now,
        best: Math.max(prev?.best ?? 0, pct),
        attempts: (prev?.attempts ?? 0) + 1,
        perfect: !!(prev?.perfect || perfect),
      },
    },
    stats: { ...s.stats, answered: s.stats.answered + total, correct: s.stats.correct + firstTryCorrect },
  };
  s = addXp(s, today, xp, { answered: (s.days[today]?.answered || 0) + total });
  // enter this lesson's words into the spaced-repetition queue (due tomorrow); existing entries are untouched
  const srs = { ...s.srs };
  for (const id of itemIds) if (!srs[id]) srs[id] = { box: 1, due: addDays(today, 1), reps: 0, lapses: 0, last: null };
  s = { ...s, srs };
  return { state: s, xp, pct, perfect, firstTime: !prev };
}

export function toggleSaved(state, itemId, now = Date.now()) {
  const saved = { ...state.saved };
  if (saved[itemId] !== undefined) delete saved[itemId];
  else saved[itemId] = now;
  return { ...state, saved };
}

// ----- spaced repetition (Leitner boxes) -----
export const isMastered = (e) => !!e && e.box >= MASTERED_BOX;
export const isDifficult = (e) => !!e && (e.lapses >= 2 || (e.lapses >= 1 && e.box <= 2));

export function applyReview(state, itemId, correct, now = Date.now()) {
  const today = localDay(new Date(now));
  let s = touchDay(state, today);
  const e = s.srs[itemId] || { box: 1, due: today, reps: 0, lapses: 0, last: null };
  const box = correct ? Math.min(MAX_BOX, e.box + 1) : 1;
  const next = { box, reps: e.reps + 1, lapses: e.lapses + (correct ? 0 : 1), last: today, due: addDays(today, correct ? SRS_INTERVALS[box] : 0) };
  s = { ...s, srs: { ...s.srs, [itemId]: next }, stats: { ...s.stats, reviewAnswered: s.stats.reviewAnswered + 1, reviewCorrect: s.stats.reviewCorrect + (correct ? 1 : 0) } };
  let xp = 0;
  if (correct) {
    const used = s.days[today]?.reviewXp || 0;
    xp = Math.max(0, Math.min(XP.reviewCorrect, XP.reviewDailyCap - used));
  }
  s = addXp(s, today, xp, { reviewXp: (s.days[today]?.reviewXp || 0) + xp });
  return { state: s, xp };
}

export function finishReviewSession(state) {
  return { ...state, stats: { ...state.stats, reviewSessions: state.stats.reviewSessions + 1 } };
}

/** Item ids eligible for review: saved words plus all words of completed lessons. */
export function reviewPool(state, lessonItems) {
  const ids = new Set(Object.keys(state.saved));
  for (const lid of Object.keys(state.completed)) for (const i of lessonItems(lid)) ids.add(i);
  return ids;
}

export function dueItems(state, pool, today, { limit = 10, maxNew = 5 } = {}) {
  const overdue = [];
  const fresh = [];
  for (const id of pool) {
    const e = state.srs[id];
    if (!e) fresh.push(id);
    else if (e.due <= today) overdue.push([e.due, id]);
  }
  overdue.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1].localeCompare(b[1])));
  const picked = overdue.map(([, id]) => id).slice(0, limit);
  const room = limit - picked.length;
  return { session: [...picked, ...fresh.sort().slice(0, Math.min(room, maxNew))], overdue: overdue.length, fresh: fresh.length };
}

// ----- derived stats & achievements -----
export function learnedItems(state, lessonItems) {
  const set = new Set(Object.keys(state.saved));
  for (const lid of Object.keys(state.completed)) for (const i of lessonItems(lid)) set.add(i);
  return set;
}
export const accuracy = (state) => (state.stats.answered ? Math.round((state.stats.correct / state.stats.answered) * 100) : null);

export const ACHIEVEMENTS = [
  { id: 'firstLesson', icon: 'Sprout', test: (s) => Object.keys(s.completed).length >= 1 },
  { id: 'fiveLessons', icon: 'Rocket', test: (s) => Object.keys(s.completed).length >= 5 },
  { id: 'twentyLessons', icon: 'Medal', test: (s) => Object.keys(s.completed).length >= 20 },
  { id: 'perfect', icon: 'Sparkles', test: (s) => Object.values(s.completed).some((c) => c.perfect) },
  { id: 'streak3', icon: 'Flame', test: (s) => s.streak.best >= 3 },
  { id: 'streak7', icon: 'Flame', test: (s) => s.streak.best >= 7 },
  { id: 'firstReview', icon: 'Brain', test: (s) => s.stats.reviewSessions >= 1 },
  { id: 'words50', icon: 'BookMarked', test: (s, c) => c.learned >= 50 },
  { id: 'xp500', icon: 'Star', test: (s) => s.xp >= 500 },
  { id: 'polyglot', icon: 'Languages', test: (s, c) => c.tracksTouched >= 2 },
  { id: 'trackDone', icon: 'Trophy', test: (s, c) => c.tracksDone >= 1 },
];

export function achievementContext(state, { lessonsByTrack, lessonItems }) {
  const tracksTouched = new Set();
  let tracksDone = 0;
  for (const [track, ids] of Object.entries(lessonsByTrack)) {
    const done = ids.filter((id) => state.completed[id]).length;
    if (done > 0) tracksTouched.add(track);
    if (ids.length && done === ids.length) tracksDone++;
  }
  return { learned: learnedItems(state, lessonItems).size, tracksTouched: tracksTouched.size, tracksDone };
}
export const unlockedAchievements = (state, ctx) => ACHIEVEMENTS.filter((a) => a.test(state, ctx)).map((a) => a.id);

// ----- backup -----
export function exportBackup(state) {
  return JSON.stringify({ app: 'mohleyla', schema: SCHEMA, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || data.app !== 'mohleyla' || !data.state) return null;
  return migrate(data.state);
}
