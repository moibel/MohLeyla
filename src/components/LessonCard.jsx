import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Chip } from './ui.jsx';
import { TRACK_META } from '../data/content.js';

export default function LessonCard({ meta, completed, best, recommended, index, total }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  return (
    <Link to={`/lesson/${meta.id}`} className={`lesson-card ${completed ? 'is-done' : ''} ${recommended ? 'is-next' : ''}`} data-testid={`lesson-${meta.id}`}>
      <div className="lesson-card-top">
        <span className="lesson-icon" style={{ '--tile': TRACK_META[meta.track].color }} aria-hidden="true">{meta.icon}</span>
        {completed ? (
          <Chip tone="success" icon={<CheckCircle2 size={14} aria-hidden="true" />}>{t('courses.completed')}</Chip>
        ) : recommended ? (
          <Chip tone="brand">{t('courses.recommended')}</Chip>
        ) : (
          <Chip>{t(`levels.${meta.level}`)}</Chip>
        )}
      </div>
      <h3>{meta.title[i18n.language]}</h3>
      <div className="lesson-card-foot">
        <span className="muted">
          {index ? t('courses.pathOf', { n: index, total }) + ' · ' : ''}
          {t('courses.wordsInLesson', { count: meta.items.length })}
          {completed && best ? ` · ${t('courses.bestScore', { score: best })}` : ''}
        </span>
        <span className="go" aria-hidden="true"><Arrow size={18} /></span>
      </div>
    </Link>
  );
}
