import { afterEach } from 'vitest';

// Node 22+ ships an experimental global `localStorage` that can shadow jsdom's: use a plain in-memory Storage.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const mem = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => void mem.set(k, String(v)),
      removeItem: (k) => void mem.delete(k),
      clear: () => mem.clear(),
    },
  });
}
afterEach(() => localStorage.clear());
