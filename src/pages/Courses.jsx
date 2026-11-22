import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { PageHeading, EmptyState, ProgressBar, Button, Flip } from '../components/ui.jsx';
import LessonCard from '../components/LessonCard.jsx';
import { TRACK_META } from '../data/content.js';
import { visibleLessonsOfTrack, useAvailability } from '../data/availability.js';
import { orderedTracks, defaultTrack } from '../data/trackOrder.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { nextLessonOf } from '../features/progress/selectors.js';

export default function Courses() {
  const { t, i18n } = useTranslation();
  useAvailability();
  const { state, updateSettings } = useProgress();
  const [params, setParams] = useSearchParams();
  const param = params.get('track');
  const offered = orderedTracks(i18n.language);
  const track = offered.includes(param) ? param : offered.includes(state.settings.lastTrack) ? state.settings.lastTrack : defaultTrack(i18n.language);
  const list = visibleLessonsOfTrack(track);
  const next = nextLessonOf(state, track);
  const groups = ['beginner', 'elementary', 'intermediate'].map((lv) => ({ lv, items: list.filter((l) => l.level === lv) })).filter((g) => g.items.length);

  const doneCount = list.filter((l) => state.completed[l.id]).length;
  const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
  return (
    <div className="page">
      <PageHeading title={t('courses.title')} subtitle={t('courses.subtitle')} />
      <div className="filters" role="tablist" aria-label={t('courses.title')}>
        {orderedTracks(i18n.language).map((k) => (
          <button key={k} role="tab" aria-selected={track === k} className={`filter ${track === k ? 'on' : ''}`} style={{ '--tile': TRACK_META[k].color }}
            onClick={() => { setParams({ track: k }, { replace: true }); updateSettings({ lastTrack: k }); }} data-testid={`track-${k}`}>
            <span className="filter-glyph" aria-hidden="true" lang={k === 'ar' || k === 'sa' ? 'ar' : 'en'}>{TRACK_META[k].glyph}</span>
            {t(`tracks.${k}.short`)}
          </button>
        ))}
      </div>
      <p className="track-desc">{t(`tracks.${track}.desc`)}</p>
      {list.length > 0 && (
        <section className="card track-summary" aria-label={t('courses.trackProgress', { done: doneCount, total: list.length })} data-testid="track-summary" style={{ '--tile': TRACK_META[track].color }}>
          <div className="track-summary-text">
            <strong data-testid="track-progress">{t('courses.trackProgress', { done: doneCount, total: list.length })}</strong>
            <ProgressBar value={doneCount} max={list.length} label={t('courses.trackProgress', { done: doneCount, total: list.length })} />
          </div>
          {next && <Button to={`/lesson/${next.id}`} iconEnd={<Flip><ArrowRight size={18} /></Flip>} data-testid="continue-track">{t('courses.continueTrack', { lesson: next.title[i18n.language] })}</Button>}
        </section>
      )}
      {!groups.length && <EmptyState icon="📚" title={t('courses.noLessons')} />}
      {groups.map((g) => (
        <section key={g.lv} aria-label={t('courses.levelHeading', { level: t(`levels.${g.lv}`) })}>
          <h2 className="level-head">{t('courses.levelHeading', { level: t(`levels.${g.lv}`) })} <span className="level-progress muted">{t('courses.levelProgress', { done: g.items.filter((l) => state.completed[l.id]).length, total: g.items.length })}</span></h2>
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
