// Conflict-free merge of two progress states (e.g. this device and the cloud copy, or two devices).
// merge(a, b) is commutative, associative and idempotent, so devices can sync in any order, any number of times,
// and converge without losing progress. Device-local data (device id, settings) is never merged.
import { migrate } from './engine.js';

const maxNum = (a = 0, b = 0) => Math.max(Number(a) || 0, Number(b) || 0);
const maxStr = (a, b) => (a == null ? b ?? null : b == null ? a : a > b ? a : b);
const minNum = (a, b) => (a == null ? b ?? null : b == null ? a : Math.min(a, b));

function mergeMaps(a = {}, b = {}, pick) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = k in a && k in b ? pick(a[k], b[k]) : k in a ? a[k] : b[k];
  return out;
}

const mergeCompleted = (x, y) => ({
  first: minNum(x.first, y.first),
  last: maxNum(x.last, y.last) || null,
  best: maxNum(x.best, y.best) || (x.best === 0 || y.best === 0 ? 0 : null),
  attempts: maxNum(x.attempts, y.attempts),
  perfect: !!(x.perfect || y.perfect),
});
const mergeSrs = (x, y) => {
  const lx = x.last ?? '';
  const ly = y.last ?? '';
  if (lx !== ly) return lx > ly ? x : y;
  if ((x.reps || 0) !== (y.reps || 0)) return (x.reps || 0) > (y.reps || 0) ? x : y;
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y; // deterministic tie-break
};
const mergeSpeaking = (x, y) => ({ tries: maxNum(x.tries, y.tries), close: maxNum(x.close, y.close), last: maxStr(x.last, y.last) });
const mergeDay = (x, y) => ({ ...mergeMaps(x, y, maxNum) });

function mergeStreak(a, b) {
  const best = Math.max(a.best || 0, b.best || 0);
  if ((a.last ?? '') > (b.last ?? '')) return { current: a.current, best: Math.max(best, a.current), last: a.last };
  if ((b.last ?? '') > (a.last ?? '')) return { current: b.current, best: Math.max(best, b.current), last: b.last };
  const current = Math.max(a.current || 0, b.current || 0);
  return { current, best: Math.max(best, current), last: a.last ?? null };
}

/** Fields that are synced. Everything else (device, settings) stays on the device. */
export function mergeStates(local, remote) {
  const a = migrate(local);
  const b = migrate(remote);

  const savedTs = mergeMaps(a.saved, b.saved, maxNum);
  const unsavedTs = mergeMaps(a.unsaved, b.unsaved, maxNum);
  const saved = {};
  const unsaved = {};
  for (const id of new Set([...Object.keys(savedTs), ...Object.keys(unsavedTs)])) {
    const s = id in savedTs ? savedTs[id] : -1;
    const u = id in unsavedTs ? unsavedTs[id] : -1;
    if (s > u) saved[id] = s; // saved after the last removal
    if (u >= 0) unsaved[id] = u;
  }

  const ledger = mergeMaps(a.xpLedger, b.xpLedger, maxNum);
  const days = mergeMaps(a.days, b.days, mergeDay);
  const keep = Object.keys(days).sort().slice(-90);
  const keptDays = Object.fromEntries(keep.map((k) => [k, days[k]]));

  return {
    schema: a.schema,
    device: a.device,
    settings: a.settings,
    completed: mergeMaps(a.completed, b.completed, mergeCompleted),
    saved,
    unsaved,
    srs: mergeMaps(a.srs, b.srs, mergeSrs),
    speaking: mergeMaps(a.speaking, b.speaking, mergeSpeaking),
    xpLedger: ledger,
    xp: Object.values(ledger).reduce((x, y) => x + y, 0),
    stats: mergeMaps(a.stats, b.stats, maxNum),
    days: keptDays,
    streak: mergeStreak(a.streak, b.streak),
  };
}

/** The part of a state that goes to the cloud (no device id, no device settings). */
export function toRemote(state) {
  const { device, settings, ...rest } = state; // eslint-disable-line no-unused-vars
  return rest;
}

/** Equality of the synced parts, ignoring key order. */
export function sameSynced(a, b) {
  const norm = (s) => JSON.stringify(toRemote(mergeStates(s, s)), (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1))) : v));
  return norm(a) === norm(b);
}
