// The learner's set-up answers: which languages, at what level, and which version of the terms they accepted (13+).
// Stored in the account's user metadata, so it follows the person to every device. Used only to personalise; never for permissions.
import { visibleLessonsOfTrack } from '../../data/availability.js';
import { TRACKS } from '../../data/content.js';

export const TERMS_VERSION = '2026-11-27';
export const LEVEL_CHOICES = ['beginner', 'elementary', 'intermediate']; // the same three levels the lessons are marked with
export const GOALS = [30, 50, 100];

/** Metadata is editable by its owner and may be old or damaged: keep only values the app understands. Returns null when incomplete. */
export function cleanPlan(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.terms !== 'string' || raw.adult13 !== true) return null;
  const tracks = [...new Set(Array.isArray(raw.tracks) ? raw.tracks : [])].filter((k) => TRACKS.includes(k));
  if (!tracks.length) return null;
  const levels = Object.fromEntries(tracks.map((k) => [k, LEVEL_CHOICES.includes(raw.levels?.[k]) ? raw.levels[k] : 'beginner']));
  return { terms: raw.terms.slice(0, 20), adult13: true, tracks, levels };
}

/** Does this person still have to go through the set-up (never done, or the terms changed since)? */
export const needsSetup = (profile) => profile?.learning?.terms !== TERMS_VERSION;

/** Chosen languages first, the others after them (nothing is hidden). */
export const planOrder = (tracks, plan) => {
  const mine = (plan?.tracks || []).filter((k) => tracks.includes(k));
  return [...mine, ...tracks.filter((k) => !mine.includes(k))];
};

/** The lesson to suggest in a path: a learner who has not started it yet begins at their level; afterwards, the first unfinished lesson. */
export function startLessonFor(state, track, level) {
  const list = visibleLessonsOfTrack(track);
  const open = list.filter((l) => !state.completed[l.id]);
  if (level && level !== 'beginner' && open.length === list.length) {
    const from = LEVEL_CHOICES.indexOf(level);
    const atLevel = open.find((l) => LEVEL_CHOICES.indexOf(l.level) >= from);
    if (atLevel) return atLevel;
  }
  // after starting at a higher level, carry on after the furthest finished lesson before going back to the earlier ones
  const last = list.reduce((n, l, i) => (state.completed[l.id] ? i : n), -1);
  return list.slice(last + 1).find((l) => !state.completed[l.id]) || open[0] || null;
}
