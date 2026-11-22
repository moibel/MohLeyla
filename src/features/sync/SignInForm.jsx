import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, KeyRound } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';
import { GOOGLE_SIGN_IN } from '../../services/supabaseClient.js';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);

/** Email -> one-time code (or link) sign-in. Shared by the Settings card and the required-sign-in screen. */
export default function SignInForm() {
  const { t } = useTranslation();
  const s = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { return await fn(); } finally { setBusy(false); } };

  return (
    <div className="stack-sm">
      {GOOGLE_SIGN_IN && !s.codeSentTo && (
        <>
          <Button variant="secondary" size="lg" icon={<GoogleG />} disabled={busy} onClick={() => run(() => sync.signInWithGoogle())} data-testid="acc-google">{t('account.google')}</Button>
          <p className="or-divider" aria-hidden="true"><span>{t('account.orEmail')}</span></p>
        </>
      )}
      {!s.codeSentTo ? (
        <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); run(() => sync.sendCode(email)); }}>
          <label className="field">
            <span>{t('account.email')}</span>
            <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" data-testid="acc-email" />
          </label>
          <Button type="submit" icon={<Mail size={18} aria-hidden="true" />} disabled={busy || !email} data-testid="acc-send">{t('account.sendCode')}</Button>
        </form>
      ) : (
        <div className="stack-sm" data-testid="acc-sent">
          <p role="status">{t('account.linkSent', { email: s.codeSentTo })}</p>
          <p className="note-small">{t('account.linkHelp')}</p>
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); run(() => sync.verifyCode(s.codeSentTo, code)); }}>
            <label className="field">
              <span>{t('account.code')}</span>
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12} required value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" data-testid="acc-code" />
            </label>
            <Button type="submit" icon={<KeyRound size={18} aria-hidden="true" />} disabled={busy || code.replace(/\s/g, '').length < 6} data-testid="acc-verify">{t('account.verify')}</Button>
          </form>
          <div className="btn-row">
            <Button variant="secondary" icon={<Mail size={18} aria-hidden="true" />} disabled={busy} onClick={() => run(() => sync.sendCode(s.codeSentTo))} data-testid="acc-resend">{t('account.resend')}</Button>
            <Button variant="ghost" onClick={() => { sync.set({ codeSentTo: null, error: null }); setCode(''); }}>{t('account.changeEmail')}</Button>
          </div>
        </div>
      )}
      {s.error && <p className="err-text" role="alert" data-testid="acc-error">{t(`account.errors.${s.error}`)}</p>}
    </div>
  );
}
