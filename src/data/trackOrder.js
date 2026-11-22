import { TRACKS } from './content.js';
import { isTrackVisible } from './availability.js';

/**
 * Which learning paths come first for a given interface language.
 * An Arabic-speaking learner is most likely here to learn another language, so English and Indonesian come first;
 * everyone else is most likely here for Arabic, so the Arabic paths come first. Nothing is hidden, only ordered.
 */
export function trackOrder(uiLang) {
  return uiLang === 'ar' ? ['en', 'id', 'ar', 'sa'] : ['ar', 'sa', 'en', 'id'];
}
export const defaultTrack = (uiLang) => orderedTracks(uiLang)[0] || trackOrder(uiLang)[0];
/** The paths to offer, in order: only the ones the admin has not hidden. */
export const orderedTracks = (uiLang) => trackOrder(uiLang).filter((k) => TRACKS.includes(k) && isTrackVisible(k));
