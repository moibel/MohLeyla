import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Bookmark, BookmarkCheck } from 'lucide-react';
import { PageHeading, EmptyState, Chip, TargetText, Bidi, Spinner, Button } from '../components/ui.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { loadItems, TRACKS } from '../data/content.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { toggleSaved, isMastered, isDifficult } from '../features/progress/engine.js';
import { diffDays, localDay } from '../utils/dates.js';

export default function Vocabulary() {
  const { t, i18n } = useTranslation();
  const ui = i18n.language;
  const { state, commit } = useProgress();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('all');
  const [status, setStatus] = useState('saved');
  const today = localDay();

  const ids = useMemo(() => [...new Set([...Object.keys(state.saved), ...Object.keys(state.srs)])], [state.saved, state.srs]);
  const idsKey = ids.join(',');
  useEffect(() => {
    let alive = true;
    if (!ids.length) { setRows([]); return undefined; }
    loadItems(ids).then((m) => alive && setRows([...m.values()])).catch(() => alive && setError(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const statusOf = (id) => {
    const e = state.srs[id];
    if (isMastered(e)) return 'mastered';
    if (isDifficult(e)) return 'difficult';
    return e && e.reps > 0 ? 'learning' : 'newWord';
  };
  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows
      .filter(({ item, lesson }) => {
        if (lang !== 'all' && lesson.track !== lang) return false;
        const e = state.srs[item.id];
        if (status === 'saved' && state.saved[item.id] === undefined) return false;
        if (status === 'difficult' && !isDifficult(e)) return false;
        if (status === 'mastered' && !isMastered(e)) return false;
        if (status === 'due' && !(e && e.due <= today)) return false;
        if (status === 'learning' && !(e && !isMastered(e))) return false;
        if (!needle) return true;
        return [item.target, item.translit, item.tr[ui], item.example.target].some((s) => s.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.lesson.track.localeCompare(b.lesson.track) || a.lesson.order - b.lesson.order);
  }, [rows, q, lang, status, state.srs, state.saved, today, ui]);

  const when = (id) => {
    const e = state.srs[id];
    if (!e) return null;
    const n = diffDays(today, e.due);
    return n <= 0 ? t('vocab.today') : n === 1 ? t('vocab.tomorrow') : t('vocab.inDays', { count: n });
  };

  return (
    <div className="page">
      <PageHeading title={t('vocab.title')} subtitle={t('vocab.subtitle')} />
      <div className="toolbar">
        <label className="searchbox">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">{t('common.search')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('vocab.search')} data-testid="vocab-search" />
        </label>
        <label className="select-wrap"><span className="sr-only">{t('vocab.language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('vocab.language')}>
            <option value="all">{t('common.all')}</option>
            {TRACKS.map((k) => <option key={k} value={k}>{t(`tracks.${k}.short`)}</option>)}
          </select>
        </label>
        <label className="select-wrap"><span className="sr-only">{t('vocab.status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('vocab.status')}>
            {['all', 'saved', 'difficult', 'due', 'learning', 'mastered'].map((s) => (
              <option key={s} value={s}>{t(`vocab.status${s[0].toUpperCase()}${s.slice(1)}`)}</option>
            ))}
          </select>
        </label>
      </div>
      {rows === null && !error && <Spinner label={t('app.loading')} />}
      {error && <p className="notice-soft" role="alert">{t('errors.loadFailed')}</p>}
      {rows && !filtered.length && (
        <EmptyState icon={<Bookmark size={44} />} title={ids.length && (q || lang !== 'all' || status !== 'saved') ? t('vocab.emptyFilter') : t('vocab.emptyTitle')}
          text={ids.length ? undefined : t('vocab.emptyText')} action={<Button to="/learn">{t('home.startLearning')}</Button>} />
      )}
      {rows && filtered.length > 0 && <p className="muted" role="status">{t('vocab.count', { count: filtered.length })}</p>}
      <ul className="vocab-grid">
        {filtered.map(({ item, lesson }) => {
          const saved = state.saved[item.id] !== undefined;
          const st = statusOf(item.id);
          return (
            <li key={item.id} className="card vocab-card" data-testid="vocab-card">
              <div className="vocab-top">
                <Chip tone="brand">{t(`tracks.${lesson.track}.short`)}</Chip>
                <Chip tone={st === 'mastered' ? 'success' : st === 'difficult' ? 'warn' : 'neutral'}>{t(`vocab.${st}`)}</Chip>
              </div>
              <TargetText track={lesson.track} as="h3" className="vocab-target">{item.target}</TargetText>
              <p className="translit-sm"><Bidi lang="en">{item.translit}</Bidi></p>
              <p><Bidi lang={ui}>{item.tr[ui]}</Bidi></p>
              <p className="muted small">{t('vocab.fromLesson', { lesson: lesson.title[ui] })}{when(item.id) ? ` · ${t('vocab.dueIn', { when: when(item.id) })}` : ''}</p>
              <div className="vocab-actions">
                <SpeakButton text={item.target} track={lesson.track} />
                <button type="button" className={`icon-btn ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-label={saved ? t('vocab.remove') : t('vocab.add')}
                  onClick={() => commit((s) => ({ state: toggleSaved(s, item.id) }))}>
                  {saved ? <BookmarkCheck size={22} aria-hidden="true" /> : <Bookmark size={22} aria-hidden="true" />}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
