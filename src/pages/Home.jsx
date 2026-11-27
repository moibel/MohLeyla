import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Flame, Target, Brain, Sparkles } from 'lucide-react';
import { Button, Ring, ProgressBar, Logo } from '../components/ui.jsx';
import LessonCard from '../components/LessonCard.jsx';
import { TRACK_META, trackHtmlLang, isBeta } from '../data/content.js';
import { visibleLessonsOfTrack, useAvailability } from '../data/availability.js';
import { orderedTracks, defaultTrack } from '../data/trackOrder.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { nextLessonOf, useDerived } from '../features/progress/selectors.js';
import { useSync } from '../features/sync/useSync.js';
import { displayName } from '../features/sync/profile.js';
import { planOrder, startLessonFor } from '../features/welcome/plan.js';
import AnnouncementCards from '../features/announcements/AnnouncementCards.jsx';

export default function Home() {
  const { t, i18n } = useTranslation();
  const { state } = useProgress();
  const d = useDerived();
  const sy = useSync();
  useAvailability();
  const who = sy.profile ? displayName(sy.profile) : '';
  const rtl = i18n.dir() === 'rtl';
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const goal = state.settings.goal;
  const hasStarted = state.xp > 0 || d.completedCount > 0;
  const plan = sy.profile?.learning || null;
  const tracks = planOrder(orderedTracks(i18n.language), plan); // the languages chosen in the set-up come first
  const mine = tracks.filter((k) => plan?.tracks.includes(k));
  const suggest = (k) => (plan ? startLessonFor(state, k, plan.levels[k]) : nextLessonOf(state, k));
  const focusTrack = state.settings.lastTrack || mine[0] || defaultTrack(i18n.language);
  const next = (tracks.includes(focusTrack) && suggest(focusTrack)) || tracks.map(suggest).find(Boolean);
  const pct = Math.min(100, Math.round((d.todayXp / goal) * 100));

  return (
    <div className="page home">
      <AnnouncementCards compact />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow" data-testid="greeting"><Sparkles size={15} aria-hidden="true" /><span>{who ? <>{t('home.hi')} <bdi>{who}</bdi>!</> : t('home.welcome')}</span></span>
          <h1 id="hero-title">{t('home.heroTitleA')} <em>{t('home.heroTitleB')}</em></h1>
          <p>{t('home.heroText')}</p>
          <div className="hero-actions">
            <Button variant="light" size="lg" to={next ? `/lesson/${next.id}` : '/learn'} iconEnd={<Arrow size={20} aria-hidden="true" />}>
              {hasStarted ? t('home.continueLearning') : t('home.startLearning')}
            </Button>
          </div>
          {next && hasStarted && <p className="hero-next">{t('home.continueFrom', { lesson: next.title[i18n.language] })}</p>}
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-mark"><Logo compact size={150} /></div>
          <span className="bubble b1" lang="ar" dir="rtl">مَرْحَبًا</span>
          <span className="bubble b2" lang="en">Hello</span>
          <span className="bubble b3" lang="id">Halo</span>
          <span className="bubble b4" lang="ar" dir="rtl">هَلا</span>
        </div>
      </section>

      <section className="stat-row" aria-label={t('home.stats')}>
        <div className="card stat-card">
          <Ring value={pct} size={84} stroke={9} label={t('home.goalProgress', { xp: d.todayXp, goal })}>
            <Target size={22} aria-hidden="true" />
          </Ring>
          <div>
            <h2 className="h-sm">{t('home.todayGoal')}</h2>
            <p className="muted">{d.todayXp >= goal ? t('home.goalReached') : t('home.goalProgress', { xp: d.todayXp, goal })}</p>
          </div>
        </div>
        <div className="card stat-card">
          <span className="stat-badge warm"><Flame size={30} aria-hidden="true" /></span>
          <div>
            <h2 className="h-sm">{t('home.streak')}</h2>
            <p className="big-num">{t('common.days', { count: d.streak })}</p>
          </div>
        </div>
        <div className="card stat-card">
          <span className="stat-badge cool"><Brain size={30} aria-hidden="true" /></span>
          <div>
            <h2 className="h-sm">{t('home.reviewTitle')}</h2>
            <p className="muted">{d.dueCount > 0 ? t('home.reviewDue', { count: d.dueCount }) : t('home.reviewNone')}</p>
            {d.dueCount > 0 && <Link className="link-strong" to="/review">{t('home.reviewCta')}</Link>}
          </div>
        </div>
      </section>

      <section aria-labelledby="tracks-h">
        <div className="section-head">
          <h2 id="tracks-h">{t('home.chooseTrack')}</h2>
          <p className="muted">{t('home.chooseTrackSub')}</p>
        </div>
        <div className="track-grid">
          {tracks.map((k) => {
            const list = visibleLessonsOfTrack(k);
            const done = list.filter((l) => state.completed[l.id]).length;
            return (
              <Link key={k} to={`/learn?track=${k}`} className="track-card" style={{ '--tile': TRACK_META[k].color }} onClick={() => undefined}>
                <span className="track-glyph" aria-hidden="true" lang={trackHtmlLang(k)}>{TRACK_META[k].glyph}</span>
                <h3>{t(`tracks.${k}.name`)}{isBeta(k) && <span className="beta-chip" data-testid={`beta-${k}`}>{t('tracks.betaChip')}</span>}</h3>
                <p>{t(`tracks.${k}.desc`)}</p>
                <ProgressBar value={done} max={list.length || 1} label={t(`tracks.${k}.name`)} />
                <span className="track-foot">{t('home.trackProgress', { done, total: list.length })}<span className="go"><Arrow size={18} aria-hidden="true" /></span></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="start-h">
        <div className="section-head">
          <div>
            <h2 id="start-h">{t('home.startHere')}</h2>
            <p className="muted">{t('home.startHereSub')}</p>
          </div>
          <Link className="link-strong" to="/learn">{t('common.seeAll')}</Link>
        </div>
        <div className="lesson-grid">
          {(mine.length ? mine : tracks).map(suggest).filter(Boolean).map((m) => (
            <LessonCard key={m.id} meta={m} completed={false} recommended={m.id === next?.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
