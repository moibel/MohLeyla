import { describe, it, expect, beforeEach } from 'vitest';
import { setDisabled, isLessonVisible, isTrackVisible, visibleLessonsOfTrack } from '../data/availability.js';
import { lessonsOfTrack } from '../data/content.js';
import { orderedTracks, defaultTrack } from '../data/trackOrder.js';
import { nextLessonOf } from '../features/progress/selectors.js';
import { emptyState } from '../features/progress/engine.js';

const first = (track) => lessonsOfTrack(track)[0].id;
beforeEach(() => setDisabled([], { persist: false }));

describe('hidden lessons and paths', () => {
  it('shows everything when nothing is hidden', () => {
    expect(visibleLessonsOfTrack('ar')).toHaveLength(30);
    expect(orderedTracks('en')).toEqual(['ar', 'sa', 'eg', 'en', 'id', 'fr', 'es', 'de', 'tl', 'zh']);
  });
  it('a hidden lesson disappears from its path, is not visible, and is skipped as the next lesson', () => {
    const id = first('en');
    setDisabled([{ kind: 'lesson', key: id }], { persist: false });
    expect(isLessonVisible(id)).toBe(false);
    expect(visibleLessonsOfTrack('en').map((l) => l.id)).not.toContain(id);
    expect(visibleLessonsOfTrack('en')).toHaveLength(29);
    expect(nextLessonOf(emptyState('d'), 'en').id).not.toBe(id);
  });
  it('a hidden path disappears from the list, loses all its lessons, and the default path moves on', () => {
    setDisabled([{ kind: 'track', key: 'ar' }], { persist: false });
    expect(isTrackVisible('ar')).toBe(false);
    expect(orderedTracks('en')).toEqual(['sa', 'eg', 'en', 'id', 'fr', 'es', 'de', 'tl', 'zh']);
    expect(defaultTrack('en')).toBe('sa');
    expect(isLessonVisible(first('ar'))).toBe(false);
    expect(nextLessonOf(emptyState('d'), 'ar')).toBeNull();
  });
  it('a path whose lessons are all hidden is not offered either', () => {
    setDisabled(lessonsOfTrack('id').map((l) => ({ kind: 'lesson', key: l.id })), { persist: false });
    expect(orderedTracks('ar')).toEqual(['en', 'fr', 'es', 'de', 'tl', 'zh', 'ar', 'sa', 'eg']);
  });
  it('showing again restores everything, and odd rows are ignored', () => {
    setDisabled([{ kind: 'track', key: 'sa' }, { kind: 'weird', key: 'x' }, null, { kind: 'lesson' }], { persist: false });
    expect(orderedTracks('en')).toEqual(['ar', 'eg', 'en', 'id', 'fr', 'es', 'de', 'tl', 'zh']);
    setDisabled([], { persist: false });
    expect(orderedTracks('en')).toHaveLength(10);
  });
  it('an unknown lesson id is never visible', () => {
    expect(isLessonVisible('zz-99')).toBe(false);
  });
});
