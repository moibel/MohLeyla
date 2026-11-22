// The one active call (if any) and calls ringing for me. Incoming calls are checked every 4 seconds while the page is visible
// (and at once when the tab regains focus); the call itself is run by CallSession.
import { useEffect, useSyncExternalStore } from 'react';
import { myIncomingCalls } from '../classes/api.js';
import { useSync } from '../sync/useSync.js';

let state = { active: null, incoming: [] }; // active: { callId, media, isCaller, name, conversationId }
let userId = null;
let declined = new Set(); // calls I declined or that I answered, so they never ring again
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const set = (patch) => { state = { ...state, ...patch }; emit(); };

export async function refreshIncoming() {
  if (!userId) return;
  const uid = userId;
  try {
    const rows = await myIncomingCalls();
    if (uid !== userId) return;
    set({ incoming: (Array.isArray(rows) ? rows : []).filter((r) => !declined.has(r.call_id) && r.call_id !== state.active?.callId) });
  } catch { /* offline: keep what we have */ }
}

/** Open the call screen (as the caller right after starting, or as the person who answered). */
export function openCall(call) { declined.add(call.callId); set({ active: call, incoming: state.incoming.filter((r) => r.call_id !== call.callId) }); }
export function closeCall() { set({ active: null }); refreshIncoming(); }
/** Remember that I said no, so the banner goes away immediately. */
export function dismissIncoming(callId) { declined.add(callId); set({ incoming: state.incoming.filter((r) => r.call_id !== callId) }); }

export function useCalls() {
  const { userId: uid } = useSync();
  useEffect(() => {
    if (uid !== userId) { userId = uid || null; declined = new Set(); set({ active: null, incoming: [] }); }
    if (!uid) return undefined;
    refreshIncoming();
    const tick = () => { if (document.visibilityState === 'visible') refreshIncoming(); };
    const id = setInterval(tick, 4000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); };
  }, [uid]);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}
