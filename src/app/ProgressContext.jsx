import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadState, saveState } from '../features/progress/storage.js';
import { emptyState, migrate } from '../features/progress/engine.js';
import { audio } from '../features/audio/audioService.js';
import { SPEEDS } from '../features/audio/audioService.js';

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
  }, [state]);

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
      replaceState: (raw) => commit(() => ({ state: migrate(raw) })),
      resetAll: () => commit(() => ({ state: { ...emptyState(), settings: { ...ref.current.settings } } })),
    }),
    [state, commit, storageBlocked],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
