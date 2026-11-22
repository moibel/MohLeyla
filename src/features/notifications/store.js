// "New since I last opened Notifications" bookkeeping for the bell. Per signed-in person, kept on the device.
import { useSyncExternalStore } from 'react';

const KEY = 'mohleyla-notif-opened-v1';
const subs = new Set();
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
let snap = read();
const emit = () => { snap = read(); subs.forEach((f) => f()); };

/** When the person last looked at Notifications (the first time we see them is "now", so old items never flood the bell). */
export function lastOpened(uid) {
  if (!uid) return Date.now();
  const all = read();
  if (!all[uid]) { all[uid] = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ } snap = all; }
  return all[uid];
}
export function markOpened(uid) {
  if (!uid) return;
  const all = read();
  all[uid] = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  emit();
}
export const useOpenedStamp = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => JSON.stringify(snap), () => '{}');
