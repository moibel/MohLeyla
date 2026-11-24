import { useEffect, useState, useSyncExternalStore } from 'react';
import { audio } from './audioService.js';
import { audioKey, normalizeSpeech } from './hash.js';

export const useAudioState = () => useSyncExternalStore(audio.subscribe, audio.getState, audio.getState);
export const speechKey = (text, lang) => `${lang}:${String(text).normalize('NFC').replace(/\s+/g, ' ').trim()}`;

/** Does a recording in exactly this language exist for this text? (false until the clip list has loaded) */
export function useHasClip(text, lang) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let alive = true;
    setHas(false);
    if (text) audio.loadManifest().then((clips) => { if (alive) setHas(!!clips?.[lang]?.has(audioKey(normalizeSpeech(text), lang))); });
    return () => { alive = false; };
  }, [text, lang]);
  return has;
}
