import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadState, saveState } from '../features/progress/storage.js';
import { emptyState, migrate } from '../features/progress/engine.js';
import { audio } from '../features/audio/audioService.js';
import { SPEEDS } from '../features/audio/audioService.js';
import { sync } from '../features/sync/index.js';
import { shouldConnectAtStartup } from '../services/supabaseClient.js';

const Ctx = createContext(null);
export const useProgress = () => useContext(Ctx);

export function ProgressProvider({ children }) {
  const initial = useRef(null);
  if (!initial.current) initial.current = loadState();
  const [state, setState] = useState(initial.current.state);
  const [storageBlocked, setBlocked] = useState(initial.current.blocked);
  const ref = useRef(state);

  /** Run a pure update `fn(state) -> { state, ...extra }` and return `extra`. */
  const commit = useCallback((fn) => {
    const result = fn(ref.current);
    const next = result.state ?? result;
    ref.current = next;
    setState(next);
    return result;
  }, []);

  useEffect(() => {
    if (!saveState(state)) setBlocked(true);
    sync.schedule(); // no-op unless signed in
  }, [state]);

  // Optional cloud sync: restore a stored session at startup, re-sync when coming back online / to the foreground.
  useEffect(() => {
    sync.attach({
      getState: () => ref.current,
      apply: (s) => commit(() => ({ state: s })),
      // a NEW device id: XP counters restart from zero, so they must not collide with the old id's counters in the cloud
      clearLocal: () => commit((cur) => ({ state: { ...emptyState(), settings: { ...cur.settings, onboarded: true } } })),
    });
    const snap = sync.getSnapshot();
    if (snap.configured && (snap.restoring || shouldConnectAtStartup())) sync.init();
    const resync = () => sync.getSnapshot().userId && sync.syncNow();
    const onVisible = () => document.visibilityState === 'visible' && resync();
    window.addEventListener('online', resync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', resync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [commit]);

  useEffect(() => {
    audio.setPrefs({ speed: SPEEDS[state.settings.speed] ?? 1, source: state.settings.source });
  }, [state.settings.speed, state.settings.source]);

  useEffect(() => {
    const root = document.documentElement;
    const th = state.settings.theme;
    if (th === 'light' || th === 'dark') root.dataset.theme = th;
    else delete root.dataset.theme;
  }, [state.settings.theme]);

  const api = useMemo(
    () => ({
      state,
      commit,
      storageBlocked,
      updateSettings: (patch) => commit((s) => ({ state: { ...s, settings: { ...s.settings, ...patch } } })),
      replaceState: (raw) => commit((cur) => ({ state: { ...migrate(raw), device: cur.device } })),
      resetAll: () => commit(() => ({ state: { ...emptyState(), settings: { ...ref.current.settings } } })),
    }),
    [state, commit, storageBlocked],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
