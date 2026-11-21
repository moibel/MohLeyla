import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Bookmark, BookmarkCheck, Target, Lightbulb, Globe2, BookOpenText, Trophy, RotateCcw } from 'lucide-react';
import { Button, Bidi, TargetText, ProgressBar, Ring, Flip, Chip } from '../../components/ui.jsx';
import SpeakButton from '../../components/SpeakButton.jsx';
import { useProgress } from '../../app/ProgressContext.jsx';
import { toggleSaved } from '../progress/engine.js';

export function Overview({ lesson, ui, onStart }) {
  const { t } = useTranslation();
  const g = lesson.grammar;
  return (
    <div className="stack" data-testid="overview">
      <section className="card">
        <h2 className="h-sm"><Target size={20} aria-hidden="true" /> {t('lesson.objectives')}</h2>
        <ul className="check-list">
          {lesson.objectives.map((o, i) => <li key={i}>{o[ui]}</li>)}
        </ul>
      </section>
      <section className="card">
        <h2 className="h-sm"><BookOpenText size={20} aria-hidden="true" /> {t('lesson.intro')}</h2>
        <p>{lesson.intro[ui]}</p>
      </section>
      <section className="card">
        <h2 className="h-sm"><Globe2 size={20} aria-hidden="true" /> {t('lesson.realWorld')}</h2>
        <p>{lesson.culture[ui]}</p>
      </section>
      {g && (
        <section className="card tint">
          <h2 className="h-sm"><Lightbulb size={20} aria-hidden="true" /> {t('lesson.grammar')}: {g.title[ui]}</h2>
          <p>{g.body[ui]}</p>
        </section>
      )}
      <div className="sticky-cta">
        <Button size="lg" onClick={onStart} iconEnd={<Flip><ArrowRight size={20} /></Flip>} data-testid="start-learn">{t('lesson.startLearning')}</Button>
      </div>
    </div>
  );
}

export function LearnCards({ lesson, ui, onDone }) {
  const { t } = useTranslation();
  const { state, commit } = useProgress();
  const [i, setI] = useState(0);
  const it = lesson.items[i];
  const saved = state.saved[it.id] !== undefined;
  const last = i === lesson.items.length - 1;
  const track = lesson.track;
  const isSa = track === 'sa';
  const showMsa = isSa && ui !== 'ar';
  return (
    <section className="card word-card" aria-live="polite" data-testid="word-card">
      <div className="word-top">
        <span className="muted">{t('lesson.cardOf', { n: i + 1, total: lesson.items.length })}</span>
        <button type="button" className={`icon-btn ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-label={saved ? t('lesson.unsaveWord') : t('lesson.saveWord')}
          onClick={() => commit((s) => ({ state: toggleSaved(s, it.id) }))} data-testid="save-word">
          {saved ? <BookmarkCheck size={24} aria-hidden="true" /> : <Bookmark size={24} aria-hidden="true" />}
        </button>
      </div>
      <ProgressBar value={i + 1} max={lesson.items.length} label={t('lesson.cardOf', { n: i + 1, total: lesson.items.length })} />
      <div className="word-main">
        <TargetText track={track} as="div" className="word-target">{it.target}</TargetText>
        <p className="translit"><span className="label">{t('lesson.pronunciation')}</span> <Bidi lang="en" className="translit-text">{it.translit}</Bidi></p>
        <div className="speak-row">
          <SpeakButton text={it.target} track={track} variant="pill" label={t('lesson.listenWord')} />
        </div>
        {isSa && <p className="note-small">{t('audio.saNote')}</p>}
      </div>
      <dl className="meaning-block">
        <dt>{t('lesson.meaning')}</dt>
        <dd className="meaning"><Bidi lang={ui}>{it.tr[ui]}</Bidi></dd>
        {showMsa && (<><dt>{t('lesson.msaEquivalent')}</dt><dd><Bidi lang="ar" className="target-text">{it.tr.ar}</Bidi></dd></>)}
        {it.hint && (<><dt>{t('lesson.tip')}</dt><dd><Bidi lang={ui}>{it.hint[ui]}</Bidi></dd></>)}
      </dl>
      <div className="example-block">
        <span className="label">{t('lesson.example')}</span>
        <TargetText track={track} as="p" className="example-target">{it.example.target}</TargetText>
        {it.example.translit && <p className="translit-sm"><Bidi lang="en">{it.example.translit}</Bidi></p>}
        <p className="muted"><Bidi lang={ui}>{it.example.tr[ui]}</Bidi></p>
        <SpeakButton text={it.example.target} track={track} variant="pill" label={t('lesson.listenExample')} />
      </div>
      <div className="ex-actions">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)} icon={<Flip><ArrowLeft size={18} /></Flip>}>{t('common.previous')}</Button>
        <Button onClick={() => (last ? onDone() : setI(i + 1))} iconEnd={<Flip><ArrowRight size={18} /></Flip>} data-testid="next-word">
          {last ? t('lesson.toPractice') : t('common.next')}
        </Button>
      </div>
    </section>
  );
}

export function Result({ lesson, ui, result, nextLesson, onRepeat, itemsById }) {
  const { t } = useTranslation();
  const missed = result.missedItemIds.map((id) => itemsById[id]).filter(Boolean);
  const pct = Math.round((result.firstTryCorrect / result.total) * 100);
  const advice = pct >= 85 ? 'reviewAdviceGood' : pct >= 60 ? 'reviewAdviceMid' : 'reviewAdviceLow';
  return (
    <div className="stack" data-testid="result">
      <section className="card result-hero">
        <div className="confetti" aria-hidden="true"><Trophy size={30} /></div>
        <h2>{t('lesson.complete')}</h2>
        <div className="result-grid">
          <Ring value={pct} size={110} stroke={11} label={`${t('lesson.accuracy')} ${pct}%`}><b>{pct}%</b></Ring>
          <dl className="kv">
            <div><dt>{t('lesson.score')}</dt><dd>{result.correct}/{result.total}</dd></div>
            <div><dt>{t('lesson.accuracy')}</dt><dd>{pct}%</dd></div>
            <div><dt>{t('lesson.xpEarned')}</dt><dd data-testid="xp-earned">+{result.xp}</dd></div>
          </dl>
        </div>
        {!result.firstTime && <p className="notice-soft">{t('lesson.xpAlready')}</p>}
        {result.firstTime && result.perfect && <p className="notice-soft">{t('lesson.xpPerfect')}</p>}
      </section>
      <section className="card">
        <h2 className="h-sm">{t('lesson.summary')}</h2>
        <p>{lesson.summary[ui]}</p>
        <h3 className="h-xs">{t('lesson.reviewAdvice')}</h3>
        <p className="muted">{t(`lesson.${advice}`)}</p>
        <p className="muted">{t('lesson.newWords')}: <b>{lesson.items.length}</b></p>
      </section>
      {missed.length > 0 && (
        <section className="card">
          <h2 className="h-sm">{t('lesson.missedWords')}</h2>
          <ul className="missed-list">
            {missed.map((it) => (
              <li key={it.id}>
                <TargetText track={lesson.track}>{it.target}</TargetText>
                <span className="muted"><Bidi lang={ui}>{it.tr[ui]}</Bidi></span>
                <SpeakButton text={it.target} track={lesson.track} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="result-actions">
        {nextLesson ? (
          <Button size="lg" to={`/lesson/${nextLesson.id}`} iconEnd={<Flip><ArrowRight size={20} /></Flip>} data-testid="next-lesson">{t('lesson.nextLesson')}: {nextLesson.title[ui]}</Button>
        ) : (
          <Chip tone="success">{t('lesson.pathComplete')}</Chip>
        )}
        <Button variant="secondary" onClick={onRepeat} icon={<RotateCcw size={18} aria-hidden="true" />}>{t('lesson.repeatLesson')}</Button>
        <Link className="link-strong" to={`/learn?track=${lesson.track}`}>{t('lesson.allLessons')}</Link>
      </div>
    </div>
  );
}
