import { useMemo } from 'react';
import { useProgress } from '../../app/ProgressContext.jsx';
import { allLessonMeta, lessonMeta, lessonsOfTrack, TRACKS } from '../../data/content.js';
import { visibleLessonsOfTrack, isLessonVisible, useAvailability } from '../../data/availability.js';
import { accuracy, achievementContext, dueItems, learnedItems, liveStreak, reviewPool, unlockedAchievements, isMastered } from './engine.js';
import { localDay } from '../../utils/dates.js';

export const lessonItems = (id) => lessonMeta(id)?.items || [];
export const lessonsByTrack = Object.fromEntries(TRACKS.map((t) => [t, lessonsOfTrack(t).map((l) => l.id)]));

/** First lesson in path order that is not yet completed, for a track. */
export function nextLessonOf(state, track) {
  const list = visibleLessonsOfTrack(track);
  return list.find((l) => !state.completed[l.id]) || null;
}

export function useDerived() {
  const { state } = useProgress();
  const today = localDay();
  const availability = useAvailability(); // lessons the admin hid are left out of the counts
  return useMemo(() => {
    const pool = reviewPool(state, lessonItems);
    const due = dueItems(state, pool, today);
    const learned = learnedItems(state, lessonItems);
    const ctx = achievementContext(state, { lessonsByTrack, lessonItems });
    const mastered = Object.entries(state.srs).filter(([, e]) => isMastered(e)).length;
    const todayXp = state.days[today]?.xp || 0;
    const shown = allLessonMeta.filter((l) => isLessonVisible(l.id));
    const completedCount = shown.filter((l) => state.completed[l.id]).length;
    return {
      today,
      pool,
      due,
      dueCount: due.overdue + due.fresh,
      learnedCount: learned.size,
      mastered,
      todayXp,
      streak: liveStreak(state, today),
      accuracy: accuracy(state),
      unlocked: unlockedAchievements(state, ctx),
      completedCount,
      totalLessons: shown.length,
    };
  }, [state, today, availability]);
}
