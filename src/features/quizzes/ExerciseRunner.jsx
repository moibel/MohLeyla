import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { Button, ProgressBar, Bidi, TargetText } from '../../components/ui.jsx';
import SpeakButton from '../../components/SpeakButton.jsx';
import { trackLang } from '../../data/content.js';
import { evaluate } from './generate.js';
import { shuffle } from '../../utils/random.js';

const langOf = (kind, track, ui) => (kind === 'target' ? trackLang(track) : ui);

function Text({ kind, track, ui, children, className = '' }) {
  return <Bidi lang={langOf(kind, track, ui)} className={`${kind === 'target' ? 'target-text' : ''} ${className}`}>{children}</Bidi>;
}

function ChoiceExercise({ ex, track, ui, onAnswer, locked, picked }) {
  const { t } = useTranslation();
  const prompt = ex.prompt.lang ? t(ex.prompt.key, { text: ex.stimulus?.text, lang: t(`audio.voiceLang.${trackLang(track)}`) }) : t(ex.prompt.key, { text: ex.stimulus?.text, ...(ex.prompt.params || {}) });
  const generic = t(`quiz.types.${ex.type === 'defineSame' ? 'translate' : ex.type}`, { lang: t(`audio.voiceLang.${trackLang(track)}`), defaultValue: '' });
  return (
    <div className="ex-body">
      <p className="ex-type">{ex.type === 'listening' ? t('quiz.types.listening') : generic || prompt}</p>
      {ex.type === 'conversation' && (
        <div className="dialogue" aria-label={ex.context}>
          <p className="muted">{ex.context}</p>
          {ex.turns.map((turn, i) => (
            <div key={i} className={`turn ${turn.who === 'A' ? 'a' : 'b'} ${i === ex.gap ? 'gap' : ''}`}>
              <span className="who">{turn.who}</span>
              <div className="bubble-line">
                {i === ex.gap ? <span className="blank-chip" aria-label="…">…</span> : (
                  <>
                    <TargetText track={track}>{turn.text}</TargetText>
                    <small className="muted">{turn.tr}</small>
                  </>
                )}
              </div>
              {turn.audio && <SpeakButton text={turn.audio} track={track} />}
            </div>
          ))}
        </div>
      )}
      {ex.stimulus && ex.type !== 'conversation' && (
        <div className="stimulus">
          {ex.stimulus.audioOnly ? (
            <SpeakButton text={ex.stimulus.audio} track={track} variant="pill" label={t('quiz.playAudio')} className="big-speak" />
          ) : (
            <>
              <p className={`stimulus-text ${ex.stimulus.lang === 'target' ? 'is-target' : ''}`}>
                {ex.stimulus.blank
                  ? ex.stimulus.text.split('___').map((part, i, arr) => (
                    <span key={i}>
                      <Text kind="target" track={track} ui={ui}>{part}</Text>
                      {i < arr.length - 1 && <span className="blank" aria-label="blank">&nbsp;</span>}
                    </span>
                  ))
                  : <Text kind={ex.stimulus.lang} track={track} ui={ui}>{ex.stimulus.text}</Text>}
              </p>
              {ex.stimulus.audio && <SpeakButton text={ex.stimulus.audio} track={track} />}
              {ex.stimulus.hint && <p className="muted hint-line"><Bidi lang={ui}>{ex.stimulus.hint}</Bidi></p>}
            </>
          )}
        </div>
      )}
      <div className="options" role="group" aria-label={t('quiz.pickAnswer')}>
        {ex.choices.map((c, i) => {
          const isAns = locked && c.id === ex.answerId;
          const isWrong = locked && picked === c.id && c.id !== ex.answerId;
          return (
            <button key={c.id} type="button" disabled={locked} data-testid={c.id === ex.answerId ? 'opt-correct' : 'opt'}
              className={`option ${isAns ? 'correct' : ''} ${isWrong ? 'wrong' : ''} ${picked === c.id ? 'picked' : ''}`}
              onClick={() => onAnswer(c.id)} aria-pressed={picked === c.id}>
              <span className="opt-key" aria-hidden="true">{i + 1}</span>
              <Text kind={c.lang} track={track} ui={ui} className="opt-text">{c.text}</Text>
              {isAns && <><Check size={20} aria-hidden="true" /><span className="sr-only">{t('a11y.correctMark')}</span></>}
              {isWrong && <><X size={20} aria-hidden="true" /><span className="sr-only">{t('a11y.wrongMark')}</span></>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchExercise({ ex, track, ui, onAnswer, locked }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(null);
  const [done, setDone] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState(null);
  const byId = useMemo(() => Object.fromEntries(ex.pairs.map((p) => [p.id, p])), [ex]);
  const tryPair = (l, r) => {
    if (l === r) {
      const nd = [...done, l];
      setDone(nd);
      setLeft(null);
      if (nd.length === ex.pairs.length) onAnswer({ mistakes });
    } else {
      setMistakes((m) => m + 1);
      setFlash(r);
      setLeft(null);
      setTimeout(() => setFlash(null), 500);
    }
  };
  return (
    <div className="ex-body">
      <p className="ex-type">{t('quiz.types.match')}</p>
      <p className="muted">{t('quiz.matchHelp')}</p>
      <div className="match-grid">
        <div className="match-col">
          {ex.leftOrder.map((id) => (
            <button key={id} type="button" disabled={locked || done.includes(id)} aria-pressed={left === id}
              className={`option match-item ${left === id ? 'picked' : ''} ${done.includes(id) ? 'matched' : ''}`} onClick={() => setLeft(id)} data-testid="match-left" data-pair={id}>
              <Text kind="target" track={track} ui={ui}>{byId[id].left.text}</Text>
              {done.includes(id) && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="match-col">
          {ex.rightOrder.map((id) => (
            <button key={id} type="button" disabled={locked || done.includes(id) || left === null}
              className={`option match-item ${done.includes(id) ? 'matched' : ''} ${flash === id ? 'shake wrong' : ''}`} onClick={() => tryPair(left, id)} data-testid="match-right" data-pair={id}>
              <Text kind="ui" track={track} ui={ui}>{byId[id].right.text}</Text>
              {done.includes(id) && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">{done.length > 0 ? `${t('quiz.matched')}: ${done.length}/${ex.pairs.length}` : ''}</p>
    </div>
  );
}

function ArrangeExercise({ ex, track, ui, onAnswer, locked }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState([]);
  const used = new Set(chosen.map((c) => c.id));
  const dir = trackLang(track) === 'ar' ? 'rtl' : 'ltr';
  return (
    <div className="ex-body">
      <p className="ex-type">{t('quiz.types.arrange')}</p>
      <p className="stimulus-text"><Bidi lang={ui}>{t(ex.prompt.key, ex.prompt.params)}</Bidi></p>
      <p className="muted">{t('quiz.tapWords')}</p>
      <div className="answer-line" dir={dir} lang={trackLang(track)} aria-label={t('quiz.yourSentence')} data-testid="answer-line">
        {chosen.map((c) => (
          <button key={c.id} type="button" className="tile placed" disabled={locked} onClick={() => setChosen(chosen.filter((x) => x.id !== c.id))} aria-label={`${t('quiz.removeWord')}: ${c.text}`}>{c.text}</button>
        ))}
        {!chosen.length && <span className="placeholder-line">&nbsp;</span>}
      </div>
      <div className="word-bank" dir={dir} lang={trackLang(track)} aria-label={t('quiz.wordBank')}>
        {ex.bank.map((b) => (
          <button key={b.id} type="button" className="tile" disabled={locked || used.has(b.id)} onClick={() => setChosen([...chosen, b])} data-testid="tile">{b.text}</button>
        ))}
      </div>
      <div className="ex-actions">
        <Button variant="ghost" size="sm" icon={<RotateCcw size={16} aria-hidden="true" />} disabled={locked || !chosen.length} onClick={() => setChosen([])}>{t('quiz.resetAnswer')}</Button>
        <Button disabled={locked || chosen.length !== ex.tokens.length} onClick={() => onAnswer(chosen.map((c) => c.text))} data-testid="check">{t('quiz.check')}</Button>
      </div>
    </div>
  );
}

/**
 * Runs a list of exercises. Questions answered wrong come back once at the end ("second chance").
 * Accuracy/XP use first-attempt results only; `onFinish` gets the summary.
 */
export default function ExerciseRunner({ lesson, exercises, ui, onFinish }) {
  const { t } = useTranslation();
  const track = lesson.track;
  const [queue, setQueue] = useState(exercises);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [resp, setResp] = useState(undefined);
  const [result, setResult] = useState(null);
  const firstTry = useRef(new Map()); // exerciseId -> boolean
  const finalOk = useRef(new Map());
  const missed = useRef(new Set());
  const feedbackRef = useRef(null);
  const ex = queue[index];
  const total = exercises.length;

  useEffect(() => {
    if (!result) return;
    feedbackRef.current?.focus({ preventScroll: true });
    feedbackRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);

  const answer = (r) => {
    if (result) return;
    const { correct } = evaluate(ex, r);
    setResp(r);
    if (round === 0) firstTry.current.set(ex.id, correct);
    if (correct) finalOk.current.set(ex.id, true);
    else if (ex.itemId) missed.current.add(ex.itemId);
    else if (ex.itemIds) ex.itemIds.forEach((i) => missed.current.add(i));
    setResult({ correct });
  };

  const next = () => {
    const last = index === queue.length - 1;
    if (!last) { setIndex(index + 1); }
    else {
      const failed = queue.filter((q) => !finalOk.current.get(q.id));
      if (round === 0 && failed.length) {
        setQueue(shuffle(failed)); setRound(1); setIndex(0);
      } else {
        const firstTryCorrect = [...firstTry.current.values()].filter(Boolean).length;
        const correct = exercises.filter((q) => finalOk.current.get(q.id)).length;
        onFinish({ total, correct, firstTryCorrect, missedItemIds: [...missed.current] });
        return;
      }
    }
    setResp(undefined); setResult(null);
  };

  const praise = useMemo(() => {
    const list = t('quiz.praise', { returnObjects: true });
    return Array.isArray(list) ? list[index % list.length] : t('quiz.correct');
  }, [t, index]);

  if (!ex) return null;
  const common = { ex, track, ui, locked: !!result, onAnswer: answer };
  const explainText = ex.explain.text || t(ex.explain.key, ex.explain.params);
  const position = round === 0 ? index + 1 : index + 1;
  const barValue = round === 0 ? index + (result ? 1 : 0) : total - queue.length + index + (result ? 1 : 0);

  return (
    <section className="card exercise" aria-live="off">
      <div className="ex-head">
        <span className="muted">{round === 1 ? t('lesson.retryRound') : t('lesson.questionOf', { n: position, total: round === 0 ? total : queue.length })}</span>
        <ProgressBar value={barValue} max={total} label={t('lesson.questionOf', { n: position, total })} />
      </div>
      {round === 1 && index === 0 && !result && <p className="notice-soft">{t('lesson.retryRoundHelp')}</p>}
      {ex.type === 'match' ? <MatchExercise key={ex.id} {...common} /> : ex.type === 'arrange' ? <ArrangeExercise key={ex.id} {...common} /> : <ChoiceExercise key={ex.id} {...common} picked={resp} />}
      {result && (
        <div ref={feedbackRef} tabIndex={-1} className={`feedback ${result.correct ? 'good' : 'bad'}`} role="status" data-testid="feedback">
          <div className="feedback-title">
            {result.correct ? <Check size={22} aria-hidden="true" /> : <X size={22} aria-hidden="true" />}
            <strong>{result.correct ? praise : t('quiz.incorrect')}</strong>
          </div>
          {!result.correct && ex.type === 'arrange' && <p><Bidi lang={ui}>{explainText}</Bidi></p>}
          {(result.correct || ex.type !== 'arrange') && <p><Bidi lang={ui}>{explainText}</Bidi></p>}
          {!result.correct && ex.type !== 'match' && ex.type !== 'arrange' && (
            <p>{t('quiz.correctAnswer', { answer: ex.choices.find((c) => c.id === ex.answerId)?.text })}</p>
          )}
          {!result.correct && round === 0 && <p className="muted">{t('quiz.comesBack')}</p>}
          <div className="feedback-actions">
            {ex.explain.audio && <SpeakButton text={ex.explain.audio} track={track} variant="pill" label={t('lesson.listenWord')} />}
            <Button onClick={next} iconEnd={<ArrowRightIcon />} data-testid="continue">{t('common.continue')}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ArrowRightIcon() {
  return <span className="rtl-flip" aria-hidden="true"><ArrowRight size={18} /></span>;
}
