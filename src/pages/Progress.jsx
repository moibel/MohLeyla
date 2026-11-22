import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sprout, Rocket, Medal, Mic, Sparkles, Flame, Brain, BookMarked, Star, Languages, Trophy, Lock } from 'lucide-react';
import { PageHeading, Ring, ProgressBar, Button } from '../components/ui.jsx';
import { TRACKS, TRACK_META, lessonsOfTrack } from '../data/content.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { useDerived } from '../features/progress/selectors.js';
import { ACHIEVEMENTS } from '../features/progress/engine.js';
import { addDays } from '../utils/dates.js';

const ICONS = { Mic, Sprout, Rocket, Medal, Sparkles, Flame, Brain, BookMarked, Star, Languages, Trophy };

export default function Progress() {
  const { t, i18n } = useTranslation();
  const { state } = useProgress();
  const d = useDerived();
  const pct = d.totalLessons ? Math.round((d.completedCount / d.totalLessons) * 100) : 0;
  const goal = state.settings.goal;
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(d.today, i - 6);
    return { day, xp: state.days[day]?.xp || 0 };
  });
  const max = Math.max(goal, ...week.map((w) => w.xp));
  const fmt = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : i18n.language, { weekday: 'short' });
  const reminder = d.dueCount > 0 ? t('progress.reminderDue', { count: d.dueCount }) : d.streak === 0 ? t('progress.reminderStreak') : t('progress.reminderNone');

  return (
    <div className="page">
      <PageHeading title={t('progress.title')} subtitle={t('progress.subtitle')} />
      <section className="progress-hero card-brand" aria-label={t('progress.overall')}>
        <Ring value={pct} size={120} stroke={12} label={`${t('progress.overall')} ${pct}%`}><b className="ring-num">{pct}%</b></Ring>
        <div>
          <h2>{t('progress.overall')}</h2>
          <p>{d.completedCount} / {d.totalLessons} · {t('progress.lessonsDone')}</p>
          <p><b>{state.xp}</b> {t('progress.xpTotal')}</p>
          <Button variant="light" to="/learn">{t('progress.continue')}</Button>
        </div>
      </section>
      <section className="stat-grid" aria-label={t('home.stats')}>
        {[
          [t('progress.accuracy'), d.accuracy === null ? '—' : `${d.accuracy}%`],
          [t('progress.wordsLearned'), d.learnedCount],
          [t('progress.wordsMastered'), d.mastered],
          [t('progress.streakCurrent'), t('common.days', { count: d.streak })],
          [t('progress.streakBest'), t('common.days', { count: state.streak.best })],
        ].map(([label, value]) => (
          <div className="card stat-tile" key={label}><span className="muted">{label}</span><b>{value}</b></div>
        ))}
      </section>
      <section className="card" aria-labelledby="week-h">
        <h2 id="week-h" className="h-sm">{t('progress.last7')} · {t('progress.dailyGoal')}: {t('settings.goalXp', { xp: goal })}</h2>
        <div className="week" role="list">
          {week.map((w) => (
            <div key={w.day} role="listitem" className="week-col" aria-label={`${fmt.format(new Date(w.day + 'T12:00:00'))}: ${w.xp} ${t('common.xp')}`}>
              <div className="week-bar"><span className={w.xp >= goal ? 'hit' : ''} style={{ blockSize: `${Math.max(w.xp ? 8 : 0, (w.xp / max) * 100)}%` }} /></div>
              <small>{fmt.format(new Date(w.day + 'T12:00:00'))}</small>
              <small className="muted">{w.xp || '–'}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="card" aria-labelledby="bylang-h">
        <h2 id="bylang-h" className="h-sm">{t('progress.byLanguage')}</h2>
        <div className="by-lang">
          {TRACKS.map((k) => {
            const list = lessonsOfTrack(k);
            const done = list.filter((l) => state.completed[l.id]).length;
            return (
              <div key={k} className="by-lang-row">
                <span className="track-glyph sm" style={{ '--tile': TRACK_META[k].color }} aria-hidden="true" lang={k === 'ar' || k === 'sa' ? 'ar' : 'en'}>{TRACK_META[k].glyph}</span>
                <div>
                  <div className="row-between"><strong>{t(`tracks.${k}.name`)}</strong><span className="muted">{done}/{list.length}</span></div>
                  <ProgressBar value={done} max={list.length || 1} label={t(`tracks.${k}.name`)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="card" aria-labelledby="rem-h">
        <h2 id="rem-h" className="h-sm">{t('progress.reminders')}</h2>
        <p>{reminder}</p>
        {d.dueCount > 0 && <Link className="link-strong" to="/review">{t('home.reviewCta')}</Link>}
      </section>
      <section aria-labelledby="ach-h">
        <h2 id="ach-h" className="h-md">{t('progress.achievements')} <span className="muted">{d.unlocked.length}/{ACHIEVEMENTS.length}</span></h2>
        <ul className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const on = d.unlocked.includes(a.id);
            const Icon = on ? ICONS[a.icon] || Trophy : Lock;
            return (
              <li key={a.id} className={`card ach ${on ? 'on' : 'off'}`}>
                <span className="ach-icon" aria-hidden="true"><Icon size={26} /></span>
                <div>
                  <strong>{t(`achievements.${a.id}.name`)}</strong>
                  <p className="muted small">{t(`achievements.${a.id}.desc`)}</p>
                  <span className="sr-only">{on ? t('progress.unlocked') : t('progress.locked')}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
