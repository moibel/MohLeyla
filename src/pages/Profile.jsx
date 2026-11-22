import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as Cog, Flame, Star, GraduationCap, BookMarked, Target } from 'lucide-react';
import { PageHeading, Button } from '../components/ui.jsx';
import Avatar from '../components/Avatar.jsx';
import SignInForm from '../features/sync/SignInForm.jsx';
import { sync } from '../features/sync/index.js';
import { useSync } from '../features/sync/useSync.js';
import { displayName, MAX_NAME } from '../features/sync/profile.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { useDerived } from '../features/progress/selectors.js';
import { LANG_META } from '../i18n/index.js';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const s = useSync();
  const { state } = useProgress();
  const d = useDerived();
  const [name, setName] = useState(s.profile?.name || '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(s.profile?.name || ''); }, [s.profile?.name]);

  if (!s.userId || !s.profile) {
    return (
      <div className="page narrow">
        <PageHeading title={t('profile.title')} />
        <section className="card stack-sm" data-testid="profile-signed-out">
          <p>{s.configured ? t('profile.signInToCreate') : t('profile.notAvailable')}</p>
          {s.configured && <SignInForm />}
        </section>
      </div>
    );
  }

  const shown = displayName(s.profile);
  const since = s.profile.createdAt ? new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'long' }).format(new Date(s.profile.createdAt)) : null;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setSaved(false);
    const ok = await sync.updateName(name);
    setBusy(false);
    setSaved(!!ok);
  };

  return (
    <div className="page narrow" data-testid="profile">
      <PageHeading title={t('profile.title')} />
      <section className="card profile-card">
        <Avatar profile={s.profile} size={88} />
        <div className="profile-id">
          <h2 data-testid="profile-name"><bdi>{shown}</bdi></h2>
          <p className="muted" dir="ltr">{s.profile.email}</p>
          {since && <p className="muted small">{t('profile.memberSince', { date: since })}</p>}
        </div>
      </section>
      <section className="card stack-sm">
        <h2 className="h-sm">{t('profile.editName')}</h2>
        <form className="stack-sm" onSubmit={save}>
          <label className="field">
            <span>{t('profile.nameLabel')}</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={MAX_NAME} autoComplete="given-name" data-testid="profile-input" />
          </label>
          <div className="btn-row">
            <Button type="submit" disabled={busy || !name.trim() || name.trim() === s.profile.name} data-testid="profile-save">{t('common.save')}</Button>
          </div>
          {saved && <p className="ok-text" role="status" data-testid="profile-saved">{t('profile.saved')}</p>}
          {!saved && (s.error === 'nameFailed' || s.error === 'network') && <p className="err-text" role="alert">{t(`account.errors.${s.error}`)}</p>}
        </form>
        <p className="note-small">{t('profile.nameNote')}</p>
      </section>
      <section className="stat-grid" aria-label={t('profile.stats')}>
        {[
          [Star, t('progress.xpTotal'), state.xp],
          [Flame, t('progress.streakCurrent'), t('common.days', { count: d.streak })],
          [GraduationCap, t('progress.lessonsDone'), d.completedCount],
          [BookMarked, t('progress.wordsLearned'), d.learnedCount],
          [Target, t('progress.accuracy'), d.accuracy === null ? '—' : `${d.accuracy}%`],
        ].map(([Icon, label, value]) => (
          <div className="card stat-tile" key={label}><span className="muted"><Icon size={16} aria-hidden="true" /> {label}</span><b>{value}</b></div>
        ))}
      </section>
      <div className="btn-row">
        <Button variant="secondary" to="/settings" icon={<Cog size={18} aria-hidden="true" />}>{t('nav.settings')}</Button>
        <Link className="link-strong" to="/progress">{t('nav.progress')}</Link>
      </div>
    </div>
  );
}
