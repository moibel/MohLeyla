import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { loadLesson, lessonMeta, lessonsOfTrack, TRACK_META } from '../data/content.js';
import { Spinner, EmptyState, Button, Chip, Flip } from '../components/ui.jsx';
import { Overview, LearnCards, Result } from '../features/lessons/Stages.jsx';
import ExerciseRunner from '../features/quizzes/ExerciseRunner.jsx';
import { buildExercises } from '../features/quizzes/generate.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { applyLessonResult } from '../features/progress/engine.js';

const STEPS = ['overview', 'learn', 'practice', 'result'];

export default function LessonPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const ui = i18n.language;
  const { commit, updateSettings } = useProgress();
  const [lesson, setLesson] = useState(null);
  const [status, setStatus] = useState('loading');
  const [stage, setStage] = useState('overview');
  const [exercises, setExercises] = useState([]);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const meta = lessonMeta(id);

  useEffect(() => {
    let alive = true;
    setStatus('loading'); setStage('overview'); setResult(null);
    if (!meta) { setStatus('missing'); return undefined; }
    loadLesson(id).then((l) => { if (!alive) return; if (l) { setLesson(l); setStatus('ok'); updateSettings({ lastTrack: l.track }); } else setStatus('missing'); }).catch(() => alive && setStatus('error'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const startPractice = useCallback(() => {
    setExercises(buildExercises(lesson, ui));
    setStage('practice');
  }, [lesson, ui]);

  const nextLesson = useMemo(() => {
    if (!meta) return null;
    const list = lessonsOfTrack(meta.track);
    return list.find((l) => l.order > meta.order) || null;
  }, [meta]);

  const finish = (summary) => {
    const r = commit((s) => applyLessonResult(s, { lessonId: lesson.id, itemIds: lesson.items.map((i) => i.id), correct: summary.correct, total: summary.total, firstTryCorrect: summary.firstTryCorrect }));
    setResult({ ...summary, xp: r.xp, firstTime: r.firstTime, perfect: r.perfect });
    setStage('result');
    window.scrollTo(0, 0);
  };

  if (status === 'loading') return <Spinner label={t('app.loadingLesson')} />;
  if (status === 'missing') return <EmptyState icon="🔎" title={t('lesson.notFound')} action={<Button to="/learn">{t('lesson.allLessons')}</Button>} />;
  if (status === 'error') return <EmptyState icon="⚠️" title={t('errors.loadFailed')} action={<Button onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>} />;

  const itemsById = Object.fromEntries(lesson.items.map((i) => [i.id, i]));
  const stepIdx = STEPS.indexOf(stage);
  const stepLabels = { overview: t('lesson.stepOverview'), learn: t('lesson.stepLearn'), practice: t('lesson.stepPractice'), result: t('lesson.stepResult') };

  return (
    <div className="page lesson-page">
      <Link to={`/learn?track=${lesson.track}`} className="back-link"><Flip><ArrowLeft size={18} /></Flip> {t('lesson.allLessons')}</Link>
      <header className="lesson-head">
        <span className="lesson-icon big" style={{ '--tile': TRACK_META[lesson.track].color }} aria-hidden="true">{lesson.icon}</span>
        <div>
          <div className="chip-row"><Chip tone="brand">{t(`tracks.${lesson.track}.short`)}</Chip><Chip>{t(`levels.${lesson.level}`)}</Chip></div>
          <h1>{lesson.title[ui]}</h1>
          <p className="muted">{lesson.description[ui]}</p>
        </div>
      </header>
      <ol className="steps" aria-label={t('lesson.steps')}>
        {STEPS.map((s, i) => (
          <li key={s} className={i === stepIdx ? 'now' : i < stepIdx ? 'past' : ''} aria-current={i === stepIdx ? 'step' : undefined}>
            <span className="step-dot">{i + 1}</span><span className="step-name">{stepLabels[s]}</span>
          </li>
        ))}
      </ol>
      {stage === 'overview' && <Overview lesson={lesson} ui={ui} onStart={() => { setStage('learn'); window.scrollTo(0, 0); }} />}
      {stage === 'learn' && <LearnCards lesson={lesson} ui={ui} onDone={startPractice} />}
      {stage === 'practice' && <ExerciseRunner key={exercises[0]?.id} lesson={lesson} exercises={exercises} ui={ui} onFinish={finish} />}
      {stage === 'result' && result && <Result lesson={lesson} ui={ui} result={result} nextLesson={nextLesson} itemsById={itemsById} onRepeat={() => { setStage('learn'); setResult(null); window.scrollTo(0, 0); }} />}
    </div>
  );
}
