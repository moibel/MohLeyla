import { STORAGE_KEY, LEGACY_KEY, migrate } from './engine.js';

/** Load progress: v6 key first, else upgrade the legacy v1 key (left untouched as a backup). */
export function loadState() {
  let raw = null;
  let legacy = null;
  let blocked = false;
  try {
    const a = localStorage.getItem(STORAGE_KEY);
    if (a) raw = JSON.parse(a);
    if (!raw) {
      const b = localStorage.getItem(LEGACY_KEY);
      if (b) legacy = JSON.parse(b);
    }
  } catch (e) {
    blocked = e && e.name !== 'SyntaxError';
  }
  return { state: migrate(raw, legacy), blocked };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
