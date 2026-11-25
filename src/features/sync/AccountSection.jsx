import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, CloudOff, RefreshCw, LogOut, Trash2, Check, UserX } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';
import SignInForm from './SignInForm.jsx';
import { LANG_META } from '../../i18n/index.js';
import { REQUIRE_SIGN_IN } from '../../services/supabaseClient.js';
import LegalLinks from '../../components/LegalLinks.jsx';

export default function AccountSection() {
  const { t, i18n } = useTranslation();
  const s = useSync();
  const deleteRef = useRef(null);
  const unsyncedRef = useRef(null);
  const accountRef = useRef(null);
  const [deleted, setDeleted] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [sure, setSure] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const closeAccountDialog = () => { accountRef.current?.close(); setSure(false); };
  const deleteAccount = async () => {
    setDeleting(true);
    sync.set({ error: null });
    const ok = await sync.deleteAccount({ clearDevice: REQUIRE_SIGN_IN });
    setDeleting(false);
    if (ok) { closeAccountDialog(); setAccountDeleted(true); }
  };

  if (!s.configured) {
    return (
      <section className="card stack-sm" data-testid="account-unconfigured">
        <h2 className="h-sm"><CloudOff size={20} aria-hidden="true" /> {t('account.title')}</h2>
        <p className="muted small">{t('account.notConfigured')}</p>
      </section>
    );
  }

  const signedIn = !!s.userId;
  const time = s.lastSyncedAt ? new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { timeStyle: 'short', dateStyle: 'short' }).format(s.lastSyncedAt) : null;
  const signOut = async () => {
    if (!REQUIRE_SIGN_IN) return sync.signOut();
    const r = await sync.signOutAndClear(); // shared devices: save to the cloud, then remove progress from this device
    if (!r.ok) unsyncedRef.current?.showModal();
  };

  return (
    <section className="card stack-sm" aria-labelledby="acc-h" data-testid="account">
      <h2 id="acc-h" className="h-sm"><Cloud size={20} aria-hidden="true" /> {t('account.title')}</h2>
      {!signedIn && (<><p className="muted small">{t('account.intro')}</p><SignInForm /></>)}
      {signedIn && (
        <>
          <p><strong dir="ltr">{s.email}</strong></p>
          <p className="muted small" role="status" data-testid="sync-status">
            {s.status === 'synced' ? <Check size={14} aria-hidden="true" /> : null} {t(`account.status.${s.status}`)}{time && s.status === 'synced' ? ` · ${t('account.lastSynced', { time })}` : ''}
          </p>
          <div className="btn-row">
            <Button variant="secondary" icon={<RefreshCw size={18} aria-hidden="true" />} disabled={s.status === 'syncing'} onClick={() => sync.syncNow()} data-testid="acc-sync">{t('account.syncNow')}</Button>
            <Button variant="ghost" icon={<LogOut size={18} aria-hidden="true" />} onClick={signOut} data-testid="acc-signout">{t('account.signOut')}</Button>
            <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => deleteRef.current?.showModal()}>{t('account.deleteCloud')}</Button>
          </div>
          <div className="btn-row">
            <Button variant="danger" icon={<UserX size={18} aria-hidden="true" />} onClick={() => { sync.set({ error: null }); accountRef.current?.showModal(); }} data-testid="acc-delete-account">{t('account.deleteAccount')}</Button>
          </div>
          <p className="note-small">{REQUIRE_SIGN_IN ? t('account.signOutNoteShared') : t('account.signOutNote')}</p>
          <LegalLinks />
          {deleted && <p className="ok-text" role="status">{t('account.deleted')}</p>}
        </>
      )}
      {accountDeleted && !signedIn && <p className="ok-text" role="status" data-testid="acc-account-deleted">{t('account.accountDeleted')}</p>}
      {signedIn && s.error && <p className="err-text" role="alert" data-testid="acc-error">{t(`account.errors.${s.error}`)}</p>}
      <p className="note-small">{t('account.privacy')}</p>

      <dialog ref={deleteRef} className="dialog" aria-labelledby="del-t">
        <h2 id="del-t">{t('account.deleteTitle')}</h2>
        <p>{t('account.deleteText')}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => deleteRef.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { const ok = await sync.deleteCloudData(); deleteRef.current?.close(); if (ok) { await (REQUIRE_SIGN_IN ? sync.signOutAndClear({ force: true }) : sync.signOut()); setDeleted(true); } }} data-testid="acc-delete-confirm">{t('account.deleteCloud')}</Button>
        </div>
      </dialog>
      <dialog ref={accountRef} className="dialog" aria-labelledby="delacc-t" data-testid="acc-delete-account-dialog" onClose={() => setSure(false)}>
        <h2 id="delacc-t">{t('account.deleteAccountTitle')}</h2>
        <p>{t('account.deleteAccountIntro')}</p>
        <ul>
          {t('account.deleteAccountList', { returnObjects: true }).map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="note-small">{REQUIRE_SIGN_IN ? t('account.deleteAccountDeviceShared') : t('account.deleteAccountDevice')}</p>
        <label className="switch-row">
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} data-testid="acc-delete-account-check" />
          <span>{t('account.deleteAccountCheck')}</span>
        </label>
        {s.error && accountRef.current?.open && <p className="err-text" role="alert" data-testid="acc-delete-account-error">{t(`account.errors.${s.error}`)}</p>}
        <div className="btn-row">
          <Button variant="ghost" onClick={closeAccountDialog} disabled={deleting}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={!sure || deleting} onClick={deleteAccount} data-testid="acc-delete-account-confirm">{deleting ? t('account.deleteAccountBusy') : t('account.deleteAccountConfirm')}</Button>
        </div>
      </dialog>
      <dialog ref={unsyncedRef} className="dialog" aria-labelledby="uns-t" data-testid="acc-unsynced">
        <h2 id="uns-t">{t('account.unsyncedTitle')}</h2>
        <p>{t('account.unsyncedText')}</p>
        <div className="btn-row">
          <Button onClick={() => unsyncedRef.current?.close()} data-testid="unsynced-cancel">{t('account.unsyncedStay')}</Button>
          <Button variant="danger" onClick={async () => { unsyncedRef.current?.close(); await sync.signOutAndClear({ force: true }); }} data-testid="unsynced-force">{t('account.unsyncedForce')}</Button>
        </div>
      </dialog>
    </section>
  );
}
