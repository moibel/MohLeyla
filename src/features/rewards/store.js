// The learner's admin-given rewards (stars, bonus XP, badges). They live in the database; this keeps a copy on the device so the
// numbers show immediately and offline. The copy is per user and never trusted for anything but display.
import { useEffect, useSyncExternalStore } from 'react';
import { myRewards } from '../classes/api.js';
import { useSync } from '../sync/useSync.js';

const KEY = 'mohleyla-rewards-v1';
const SEEN_KEY = 'mohleyla-rewards-seen-v1';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable: rewards still show for this visit */ } };

export function summarize(list) {
  const rows = Array.isArray(list) ? list : [];
  const sum = (kind) => rows.filter((r) => r.kind === kind).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  return { list: rows, bonusXp: sum('xp'), stars: sum('star'), badges: rows.filter((r) => r.kind === 'badge') };
}

let userId = null;
let lastFetch = 0;
let snap = { ...summarize([]), userId: null, unseen: [] };
const subs = new Set();
const emit = () => subs.forEach((f) => f());

function unseenOf(uid, list) {
  const seen = new Set((read(SEEN_KEY) || {})[uid] || []);
  return list.filter((r) => !seen.has(r.id));
}
function setList(uid, list) {
  snap = { ...summarize(list), userId: uid, unseen: unseenOf(uid, list) };
  emit();
}

/** Switch to a user (or none): show the cached copy at once, then refresh from the database. */
export async function load(uid) {
  if (uid !== userId) {
    userId = uid;
    const cached = uid ? read(KEY) : null;
    setList(uid, cached && cached.userId === uid ? cached.list : []);
  }
  if (!uid) return;
  if (Date.now() - lastFetch < 3000) return; // several components ask at once on a page change
  lastFetch = Date.now();
  try {
    const list = await myRewards();
    if (userId !== uid) return;
    write(KEY, { userId: uid, list });
    setList(uid, Array.isArray(list) ? list : []);
  } catch { /* offline or not deployed yet: keep the cached copy */ }
}

/** The learner has been told about these rewards. */
export function markSeen() {
  if (!userId) return;
  const all = read(SEEN_KEY) || {};
  all[userId] = snap.list.map((r) => r.id);
  write(SEEN_KEY, all);
  snap = { ...snap, unseen: [] };
  emit();
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const getSnapshot = () => snap;

/** Rewards for the signed-in learner; refreshes on sign-in, when the tab regains focus and when the device is back online. */
export function useRewards() {
  const { userId: uid } = useSync();
  useEffect(() => {
    load(uid || null);
    if (!uid) return undefined;
    const again = () => load(uid);
    window.addEventListener('focus', again);
    window.addEventListener('online', again);
    return () => { window.removeEventListener('focus', again); window.removeEventListener('online', again); };
  }, [uid]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
