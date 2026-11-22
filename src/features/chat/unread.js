// How many chat messages are waiting for the signed-in person. Checked now, every 30 s while the page is visible, and when
// the tab regains focus or the device comes back online. Failures keep the last number.
import { useEffect, useSyncExternalStore } from 'react';
import { chatUnreadTotal } from '../classes/api.js';
import { useSync } from '../sync/useSync.js';

let count = 0;
let userId = null;
const subs = new Set();
const set = (n) => { if (n !== count) { count = n; subs.forEach((f) => f()); } };

export async function refreshChatUnread() {
  if (!userId) return;
  const uid = userId;
  try { const n = await chatUnreadTotal(); if (uid === userId) set(Number(n) || 0); } catch { /* offline or not set up yet */ }
}

export function useChatUnread() {
  const { userId: uid } = useSync();
  useEffect(() => {
    if (uid !== userId) { userId = uid || null; set(0); }
    if (!uid) return undefined;
    refreshChatUnread();
    const tick = () => { if (document.visibilityState === 'visible') refreshChatUnread(); };
    const id = setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); window.removeEventListener('online', tick); };
  }, [uid]);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => count, () => count);
}
