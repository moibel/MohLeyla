import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, CloudOff, RefreshCw, LogOut, Mail, KeyRound, Trash2, Check } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';
import { LANG_META } from '../../i18n/index.js';

export default function AccountSection() {
  const { t, i18n } = useTranslation();
  const s = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const choiceRef = useRef(null);
  const deleteRef = useRef(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const d = choiceRef.current;
    if (s.pendingChoice && d && !d.open) d.showModal();
    if (!s.pendingChoice && d?.open) d.close();
  }, [s.pendingChoice]);

  if (!s.configured) {
    return (
      <section className="card stack-sm" data-testid="account-unconfigured">
        <h2 className="h-sm"><CloudOff size={20} aria-hidden="true" /> {t('account.title')}</h2>
        <p className="muted small">{t('account.notConfigured')}</p>
      </section>
    );
  }

  const run = async (fn) => { setBusy(true); try { return await fn(); } finally { setBusy(false); } };
  const signedIn = !!s.userId;
  const time = s.lastSyncedAt ? new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { timeStyle: 'short', dateStyle: 'short' }).format(s.lastSyncedAt) : null;

  return (
    <section className="card stack-sm" aria-labelledby="acc-h" data-testid="account">
      <h2 id="acc-h" className="h-sm"><Cloud size={20} aria-hidden="true" /> {t('account.title')}</h2>
      {!signedIn && !s.codeSentTo && (
        <>
          <p className="muted small">{t('account.intro')}</p>
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); run(() => sync.sendCode(email)); }}>
            <label className="field">
              <span>{t('account.email')}</span>
              <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" data-testid="acc-email" />
            </label>
            <Button type="submit" icon={<Mail size={18} aria-hidden="true" />} disabled={busy || !email} data-testid="acc-send">{t('account.sendCode')}</Button>
          </form>
        </>
      )}
      {!signedIn && s.codeSentTo && (
        <div className="stack-sm" data-testid="acc-sent">
          <p role="status">{t('account.linkSent', { email: s.codeSentTo })}</p>
          <p className="note-small">{t('account.linkHelp')}</p>
          <details className="code-details">
            <summary data-testid="acc-use-code">{t('account.haveCode')}</summary>
            <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); run(() => sync.verifyCode(s.codeSentTo, code)); }}>
              <label className="field">
                <span>{t('account.code')}</span>
                <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12} required value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" data-testid="acc-code" />
              </label>
              <Button type="submit" icon={<KeyRound size={18} aria-hidden="true" />} disabled={busy || code.replace(/\s/g, '').length < 6} data-testid="acc-verify">{t('account.verify')}</Button>
            </form>
          </details>
          <div className="btn-row">
            <Button variant="secondary" icon={<Mail size={18} aria-hidden="true" />} disabled={busy} onClick={() => run(() => sync.sendCode(s.codeSentTo))} data-testid="acc-resend">{t('account.resend')}</Button>
            <Button variant="ghost" onClick={() => { sync.set({ codeSentTo: null, error: null }); setCode(''); }}>{t('account.changeEmail')}</Button>
          </div>
        </div>
      )}
      {signedIn && (
        <>
          <p><strong dir="ltr">{s.email}</strong></p>
          <p className="muted small" role="status" data-testid="sync-status">
            {s.status === 'synced' ? <Check size={14} aria-hidden="true" /> : null} {t(`account.status.${s.status}`)}{time && s.status === 'synced' ? ` · ${t('account.lastSynced', { time })}` : ''}
          </p>
          <div className="btn-row">
            <Button variant="secondary" icon={<RefreshCw size={18} aria-hidden="true" />} disabled={s.status === 'syncing'} onClick={() => sync.syncNow()} data-testid="acc-sync">{t('account.syncNow')}</Button>
            <Button variant="ghost" icon={<LogOut size={18} aria-hidden="true" />} onClick={() => sync.signOut()} data-testid="acc-signout">{t('account.signOut')}</Button>
            <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => deleteRef.current?.showModal()}>{t('account.deleteCloud')}</Button>
          </div>
          <p className="note-small">{t('account.signOutNote')}</p>
          {deleted && <p className="ok-text" role="status">{t('account.deleted')}</p>}
        </>
      )}
      {s.error && <p className="err-text" role="alert" data-testid="acc-error">{t(`account.errors.${s.error}`)}</p>}
      <p className="note-small">{t('account.privacy')}</p>

      <dialog ref={choiceRef} className="dialog" aria-labelledby="choice-t" onCancel={(e) => e.preventDefault()} data-testid="acc-choice">
        <h2 id="choice-t">{t('account.choiceTitle')}</h2>
        <p>{t('account.choiceText')}</p>
        <p className="note-small">{t('account.choiceTip')}</p>
        <div className="stack-sm">
          <Button onClick={() => sync.resolveChoice('merge')} data-testid="choice-merge">{t('account.choiceMerge')}</Button>
          <Button variant="secondary" onClick={() => sync.resolveChoice('replace')} data-testid="choice-replace">{t('account.choiceReplace')}</Button>
          <Button variant="ghost" onClick={() => sync.resolveChoice('cancel')} data-testid="choice-cancel">{t('account.choiceCancel')}</Button>
        </div>
      </dialog>
      <dialog ref={deleteRef} className="dialog" aria-labelledby="del-t">
        <h2 id="del-t">{t('account.deleteTitle')}</h2>
        <p>{t('account.deleteText')}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => deleteRef.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { const ok = await sync.deleteCloudData(); deleteRef.current?.close(); if (ok) { await sync.signOut(); setDeleted(true); } }} data-testid="acc-delete-confirm">{t('account.deleteCloud')}</Button>
        </div>
      </dialog>
    </section>
  );
}
