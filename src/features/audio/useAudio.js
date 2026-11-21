import { useSyncExternalStore } from 'react';
import { audio } from './audioService.js';

export const useAudioState = () => useSyncExternalStore(audio.subscribe, audio.getState, audio.getState);
export const speechKey = (text, lang) => `${lang}:${String(text).normalize('NFC').replace(/\s+/g, ' ').trim()}`;
