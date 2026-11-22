import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Check, X, Eye } from 'lucide-react';
import { PageHeading, EmptyState, Button, ProgressBar, TargetText, Bidi, Spinner, Ring } from '../components/ui.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { loadItems } from '../data/content.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { useDerived } from '../features/progress/selectors.js';
import { applyReview, dueItems, finishReviewSession } from '../features/progress/engine.js';
import { shuffle } from '../utils/random.js';

export default function Review() {
  const { t, i18n } = useTranslation();
  const ui = i18n.language;
  const { state, commit } = useProgress();
  const d = useDerived();
  const [session, setSession] = useState(null); // { cards, i, correct, xp, shown }
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setLoading(true); setFailed(false);
    try {
      const ids = shuffle(dueItems(state, d.pool, d.today).session);
      const map = await loadItems(ids);
      const cards = ids.map((id) => map.get(id)).filter(Boolean);
      setSession({ cards, i: 0, correct: 0, xp: 0, shown: false, done: false });
    } catch { setFailed(true); }
    setLoading(false);
  };

  // Keyboard for a review card: Space/Enter reveals; then 1 = "didn't know", 2 = "knew".
  const live = useRef({});
  live.current = { session, answer: null };
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input,textarea,select,button,a')) return;
      const { session: ses } = live.current;
      if (!ses || ses.done) return;
      if (!ses.shown && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); document.querySelector('[data-testid="reveal"]')?.click(); }
      else if (ses.shown && e.key === '1') document.querySelector('[data-testid="didnt-know"]')?.click();
      else if (ses.shown && e.key === '2') document.querySelector('[data-testid="knew"]')?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <Spinner label={t('app.loading')} />;

  if (session && !session.done) {
    const { item, lesson } = session.cards[session.i];
    const track = lesson.track;
    const answer = (ok) => {
      const r = commit((s) => applyReview(s, item.id, ok));
      const last = session.i === session.cards.length - 1;
      const next = { ...session, correct: session.correct + (ok ? 1 : 0), xp: session.xp + r.xp, shown: false, i: last ? session.i : session.i + 1, done: last };
      if (last) commit((s) => ({ state: finishReviewSession(s) }));
      setSession(next);
    };
    return (
      <div className="page narrow">
        <PageHeading title={t('review.title')} />
        <section className="card review-card" data-testid="review-card">
          <div className="ex-head">
            <span className="muted">{t('review.sessionOf', { n: session.i + 1, total: session.cards.length })}</span>
            <ProgressBar value={session.i} max={session.cards.length} />
          </div>
          <p className="ex-type">{t('review.question')}</p>
          <div className="word-main">
            <TargetText track={track} as="div" className="word-target">{item.target}</TargetText>
            <SpeakButton text={item.target} track={track} variant="pill" label={t('lesson.listenWord')} />
          </div>
          {!session.shown ? (
            <Button size="lg" icon={<Eye size={20} aria-hidden="true" />} onClick={() => setSession({ ...session, shown: true })} data-testid="reveal">{t('review.reveal')}</Button>
          ) : (
            <>
              <dl className="meaning-block">
                <dt>{t('lesson.meaning')}</dt><dd className="meaning"><Bidi lang={ui}>{item.tr[ui]}</Bidi></dd>
                <dt>{t('lesson.pronunciation')}</dt><dd><Bidi lang="en">{item.translit}</Bidi></dd>
              </dl>
              <div className="example-block">
                <TargetText track={track} as="p" className="example-target">{item.example.target}</TargetText>
                <p className="muted"><Bidi lang={ui}>{item.example.tr[ui]}</Bidi></p>
              </div>
              <div className="ex-actions">
                <Button variant="secondary" icon={<X size={18} aria-hidden="true" />} onClick={() => answer(false)} data-testid="didnt-know">{t('review.didNot')}</Button>
                <Button icon={<Check size={18} aria-hidden="true" />} onClick={() => answer(true)} data-testid="knew">{t('review.knew')}</Button>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  if (session?.done) {
    const total = session.cards.length;
    return (
      <div className="page narrow">
        <section className="card result-hero" data-testid="review-result">
          <Ring value={Math.round((session.correct / total) * 100)} size={110} stroke={11} label={`${session.correct}/${total}`}><b>{session.correct}/{total}</b></Ring>
          <h2>{t('review.resultTitle')}</h2>
          <p>{t('review.resultText', { correct: session.correct, total })}</p>
          {session.xp > 0 && <p className="notice-soft">{t('review.xpNote', { xp: session.xp })}</p>}
          <div className="result-actions">
            <Button onClick={() => { setSession(null); }}>{t('common.done')}</Button>
            {d.dueCount > 0 && <Button variant="secondary" onClick={start}>{t('review.nextSession')}</Button>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <PageHeading title={t('review.title')} subtitle={t('review.subtitle')} />
      {failed && <p className="notice-soft" role="alert">{t('errors.loadFailed')}</p>}
      {d.dueCount === 0 ? (
        <EmptyState icon={<Brain size={44} />} title={t('review.nothingTitle')} text={t('review.nothingText')} action={<Button to="/learn">{t('home.startLearning')}</Button>} />
      ) : (
        <section className="card center-card">
          <Brain size={44} aria-hidden="true" className="accent" />
          <div className="kv kv-row">
            <div><dt>{t('review.dueNow')}</dt><dd>{d.due.overdue}</dd></div>
            <div><dt>{t('review.newCards')}</dt><dd>{d.due.fresh}</dd></div>
          </div>
          <p className="muted">{t('review.stepDesc')}</p>
          <p className="muted small" data-testid="learned-line">{t('review.learnedLine', { learned: d.learnedCount, mastered: d.mastered })}</p>
          <Button size="lg" onClick={start} data-testid="start-review">{t('review.start')}</Button>
        </section>
      )}
    </div>
  );
}
