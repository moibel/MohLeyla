import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeading, EmptyState } from '../components/ui.jsx';
import LessonCard from '../components/LessonCard.jsx';
import { TRACKS, TRACK_META, lessonsOfTrack } from '../data/content.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { nextLessonOf } from '../features/progress/selectors.js';

export default function Courses() {
  const { t } = useTranslation();
  const { state, updateSettings } = useProgress();
  const [params, setParams] = useSearchParams();
  const param = params.get('track');
  const track = TRACKS.includes(param) ? param : state.settings.lastTrack && TRACKS.includes(state.settings.lastTrack) ? state.settings.lastTrack : 'ar';
  const list = lessonsOfTrack(track);
  const next = nextLessonOf(state, track);
  const groups = ['beginner', 'elementary', 'intermediate'].map((lv) => ({ lv, items: list.filter((l) => l.level === lv) })).filter((g) => g.items.length);

  return (
    <div className="page">
      <PageHeading title={t('courses.title')} subtitle={t('courses.subtitle')} />
      <div className="filters" role="tablist" aria-label={t('courses.title')}>
        {TRACKS.map((k) => (
          <button key={k} role="tab" aria-selected={track === k} className={`filter ${track === k ? 'on' : ''}`} style={{ '--tile': TRACK_META[k].color }}
            onClick={() => { setParams({ track: k }, { replace: true }); updateSettings({ lastTrack: k }); }} data-testid={`track-${k}`}>
            <span className="filter-glyph" aria-hidden="true" lang={k === 'ar' || k === 'sa' ? 'ar' : 'en'}>{TRACK_META[k].glyph}</span>
            {t(`tracks.${k}.short`)}
          </button>
        ))}
      </div>
      <p className="track-desc">{t(`tracks.${track}.desc`)}</p>
      {!groups.length && <EmptyState icon="📚" title={t('courses.noLessons')} />}
      {groups.map((g) => (
        <section key={g.lv} aria-label={t('courses.levelHeading', { level: t(`levels.${g.lv}`) })}>
          <h2 className="level-head">{t('courses.levelHeading', { level: t(`levels.${g.lv}`) })}</h2>
          <div className="lesson-grid">
            {g.items.map((m) => (
              <LessonCard key={m.id} meta={m} index={m.order} total={list.length} completed={!!state.completed[m.id]} best={state.completed[m.id]?.best} recommended={next?.id === m.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
