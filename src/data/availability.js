// Which learning paths and lessons the admin has hidden. The list comes from the database (public.content_switches); a copy is kept
// on the device so a hidden lesson stays hidden offline and there is no flash of content that was switched off.
// Hiding never deletes anything: progress for hidden lessons is kept, it just is not offered.
import { useSyncExternalStore } from 'react';
import { lessonsOfTrack, lessonMeta } from './content.js';

const KEY = 'mohleyla-switch-v1';
let disabled = { tracks: new Set(), lessons: new Set() };
let version = 0;
const subs = new Set();

function parse(rows) {
  const d = { tracks: new Set(), lessons: new Set() };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && r.kind === 'track' && typeof r.key === 'string') d.tracks.add(r.key);
    else if (r && r.kind === 'lesson' && typeof r.key === 'string') d.lessons.add(r.key);
  }
  return d;
}
/** Replace the hidden list (from the database or the device copy). Pass `persist: false` for the device copy. */
export function setDisabled(rows, { persist = true } = {}) {
  disabled = parse(rows);
  version++;
  if (persist) { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* storage unavailable */ } }
  subs.forEach((f) => f());
}
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(saved)) { disabled = parse(saved); } } catch { /* no saved copy */ }

export const isLessonHidden = (id) => disabled.lessons.has(id);
export const isTrackHidden = (track) => disabled.tracks.has(track);
export const isLessonVisible = (id) => { const m = lessonMeta(id); return !!m && !disabled.tracks.has(m.track) && !disabled.lessons.has(id); };
export const visibleLessonsOfTrack = (track) => (disabled.tracks.has(track) ? [] : lessonsOfTrack(track).filter((l) => !disabled.lessons.has(l.id)));
/** A path is offered while it is not hidden and has at least one visible lesson. */
export const isTrackVisible = (track) => visibleLessonsOfTrack(track).length > 0;

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
/** Call in any component that lists lessons or paths so it redraws when the hidden list changes. */
export const useAvailability = () => useSyncExternalStore(subscribe, () => version, () => version);
