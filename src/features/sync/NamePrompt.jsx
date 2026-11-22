import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';
import { MAX_NAME } from './profile.js';

/** Asked once, right after the first sign-in, when the account has no name yet (email sign-ins; Google supplies one). */
export default function NamePrompt() {
  const { t } = useTranslation();
  const s = useSync();
  const ref = useRef(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const needed = !!s.userId && !!s.profile && !s.profile.name && !s.pendingChoice && !sync.nameAsked();

  useEffect(() => {
    const d = ref.current;
    if (needed && d && !d.open) d.showModal();
    if (!needed && d?.open) d.close();
  }, [needed]);
  if (!s.configured) return null;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await sync.updateName(name);
    setBusy(false);
  };
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="np-t" onCancel={(e) => { e.preventDefault(); sync.skipNamePrompt(); }} data-testid="name-prompt">
      <h2 id="np-t">{t('profile.promptTitle')}</h2>
      <p>{t('profile.promptText')}</p>
      <form className="stack-sm" onSubmit={save}>
        <label className="field">
          <span>{t('profile.nameLabel')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="given-name" autoFocus data-testid="np-input" />
        </label>
        {s.error === 'nameFailed' || s.error === 'network' ? <p className="err-text" role="alert">{t(`account.errors.${s.error === 'network' ? 'network' : 'nameFailed'}`)}</p> : null}
        <div className="btn-row">
          <Button type="submit" disabled={busy || !name.trim()} data-testid="np-save">{t('common.save')}</Button>
          <Button variant="ghost" onClick={() => sync.skipNamePrompt()} data-testid="np-skip">{t('profile.promptSkip')}</Button>
        </div>
      </form>
    </dialog>
  );
}
