import { TRACKS } from './content.js';

/**
 * Which learning paths come first for a given interface language.
 * An Arabic-speaking learner is most likely here to learn another language, so English and Indonesian come first;
 * everyone else is most likely here for Arabic, so the Arabic paths come first. Nothing is hidden, only ordered.
 */
export function trackOrder(uiLang) {
  return uiLang === 'ar' ? ['en', 'id', 'ar', 'sa'] : ['ar', 'sa', 'en', 'id'];
}
export const defaultTrack = (uiLang) => trackOrder(uiLang)[0];
export const orderedTracks = (uiLang) => trackOrder(uiLang).filter((k) => TRACKS.includes(k));
