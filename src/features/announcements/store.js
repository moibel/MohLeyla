// Announcements for the signed-in learner. A copy is kept on the device (per user) so they show at once and offline.
import { useEffect, useSyncExternalStore } from 'react';
import { myAnnouncements } from '../classes/api.js';
import { useSync } from '../sync/useSync.js';

const KEY = 'mohleyla-news-v1';
const GONE_KEY = 'mohleyla-news-dismissed-v1';
const POPPED_KEY = 'mohleyla-news-popped-v1';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/** The text in the learner's language, else English, else whatever language the admin wrote it in. */
export const pick = (obj, lang) => (obj && (obj[lang] || obj.en || Object.values(obj).find(Boolean))) || '';

let userId = null;
let lastFetch = 0;
let snap = { userId: null, list: [], visible: [], queue: [] };
const subs = new Set();
const emit = () => subs.forEach((f) => f());

function setList(uid, list) {
  const gone = new Set((read(GONE_KEY) || {})[uid] || []);
  const popped = new Set((read(POPPED_KEY) || {})[uid] || []);
  const visible = list.filter((a) => !gone.has(a.id));
  // Messages meant for one person, and celebration / important ones, open as a pop-up once; ordinary broadcasts just sit on the home page.
  const queue = visible.filter((a) => !popped.has(a.id) && (a.audience === 'user' || (a.style && a.style !== 'info')));
  snap = { userId: uid, list, visible, queue };
  emit();
}

export async function load(uid) {
  if (uid !== userId) {
    userId = uid;
    const cached = uid ? read(KEY) : null;
    setList(uid, cached && cached.userId === uid ? cached.list : []);
  }
  if (!uid) return;
  if (Date.now() - lastFetch < 3000) return;
  lastFetch = Date.now();
  try {
    const list = await myAnnouncements();
    if (userId !== uid) return;
    const rows = Array.isArray(list) ? list : [];
    write(KEY, { userId: uid, list: rows });
    setList(uid, rows);
  } catch { /* offline or not deployed yet: keep the cached copy */ }
}

/** The pop-up for this announcement has been shown; it will not open again. */
export function markPopped(id) {
  if (!userId) return;
  const all = read(POPPED_KEY) || {};
  all[userId] = [...new Set([...(all[userId] || []), id])];
  write(POPPED_KEY, all);
  setList(userId, snap.list);
}

/** The learner closed this announcement on the home page (it stays readable on the profile page). */
export function dismiss(id) {
  if (!userId) return;
  const all = read(GONE_KEY) || {};
  all[userId] = [...new Set([...(all[userId] || []), id])];
  write(GONE_KEY, all);
  setList(userId, snap.list);
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const getSnapshot = () => snap;

export function useAnnouncements() {
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
