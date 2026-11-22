import { useEffect } from 'react';
import { contentDisabled } from '../classes/api.js';
import { setDisabled } from '../../data/availability.js';
import { sync } from '../sync/index.js';

let lastFetch = 0;
/** Fetch the hidden list (works signed out too: it is public configuration). Failures keep the copy already on the device. */
export async function refreshAvailability(force = false) {
  if (!sync.getSnapshot().configured) return;
  if (!force && Date.now() - lastFetch < 3000) return;
  lastFetch = Date.now();
  try { setDisabled(await contentDisabled()); } catch { /* offline or not set up yet */ }
}

/** Keeps the hidden list fresh: at start, when the tab regains focus and when the device is back online. */
export function useAvailabilitySync() {
  useEffect(() => {
    refreshAvailability();
    const again = () => refreshAvailability();
    window.addEventListener('focus', again);
    window.addEventListener('online', again);
    return () => { window.removeEventListener('focus', again); window.removeEventListener('online', again); };
  }, []);
}
