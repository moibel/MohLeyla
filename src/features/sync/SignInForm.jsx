import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, KeyRound } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';
import { GOOGLE_SIGN_IN, APPLE_SIGN_IN_WEB, isSyncConfigured } from '../../services/supabaseClient.js';
import { nativePlatform } from '../../utils/platform.js';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);

const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.37 1.43c0 1.14-.46 2.2-1.2 3-.8.86-2.1 1.52-3.16 1.43-.13-1.1.42-2.25 1.15-3 .82-.86 2.2-1.5 3.2-1.43zM20.5 17.2c-.55 1.27-.82 1.84-1.52 2.96-.98 1.57-2.37 3.53-4.08 3.54-1.52.02-1.9-1-3.97-.99-2.06.01-2.49 1.01-4.01.99-1.71-.02-3.02-1.79-4-3.36C-.15 15.9-.43 10.77 1.27 8.17c1.2-1.84 3.1-2.92 4.88-2.92 1.81 0 2.95 1 4.45 1 1.45 0 2.34-1 4.44-1 1.58 0 3.26.86 4.46 2.35-3.92 2.15-3.29 7.76.0 9.6z" />
  </svg>
);

/** Email -> one-time code (or link) sign-in. Shared by the Settings card and the required-sign-in screen. */
export default function SignInForm() {
  const { t } = useTranslation();
  const s = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [withPassword, setWithPassword] = useState(false); // only for the app stores' reviewers
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // seconds before "send again": stops repeated taps from sending many emails
  useEffect(() => {
    if (!wait) return undefined;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  const send = async (address) => { if (await run(() => sync.sendCode(address))) setWait(60); };
  const run = async (fn) => { setBusy(true); try { return await fn(); } finally { setBusy(false); } };

  const showApple = !withPassword && !s.codeSentTo && isSyncConfigured() && (nativePlatform() === 'ios' || APPLE_SIGN_IN_WEB);
  const switchMode = (on) => { setWithPassword(on); setPassword(''); sync.set({ error: null }); };
  return (
    <div className="stack-sm">
      {showApple && (
        <Button variant="secondary" size="lg" icon={<AppleLogo />} disabled={busy} onClick={() => run(() => sync.signInWithApple())} data-testid="acc-apple">{t('account.apple')}</Button>
      )}
      {!withPassword && (GOOGLE_SIGN_IN || showApple) && !s.codeSentTo && (
        <>
          {GOOGLE_SIGN_IN && <Button variant="secondary" size="lg" icon={<GoogleG />} disabled={busy} onClick={() => run(() => sync.signInWithGoogle())} data-testid="acc-google">{t('account.google')}</Button>}
          <p className="or-divider" aria-hidden="true"><span>{t('account.orEmail')}</span></p>
        </>
      )}
      {withPassword ? (
        <form className="stack-sm" data-testid="acc-pw-form" onSubmit={async (e) => { e.preventDefault(); if (await run(() => sync.signInWithPassword(email, password))) setPassword(''); }}>
          <p className="note-small">{t('account.passwordHelp')}</p>
          <label className="field">
            <span>{t('account.email')}</span>
            <input type="email" inputMode="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" data-testid="acc-pw-email" />
          </label>
          <label className="field">
            <span>{t('account.password')}</span>
            <input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" data-testid="acc-pw-password" />
          </label>
          <Button type="submit" icon={<KeyRound size={18} aria-hidden="true" />} disabled={busy || !email || !password} data-testid="acc-pw-submit">{t('account.passwordSubmit')}</Button>
          <Button variant="ghost" onClick={() => switchMode(false)} data-testid="acc-pw-back">{t('account.passwordBack')}</Button>
        </form>
      ) : !s.codeSentTo ? (
        <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); send(email); }}>
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
            <Button variant="secondary" icon={<Mail size={18} aria-hidden="true" />} disabled={busy || wait > 0} onClick={() => send(s.codeSentTo)} data-testid="acc-resend">{wait > 0 ? `${t('account.resend')} (${wait})` : t('account.resend')}</Button>
            <Button variant="ghost" onClick={() => { sync.set({ codeSentTo: null, error: null }); setCode(''); }}>{t('account.changeEmail')}</Button>
          </div>
        </div>
      )}
      {!withPassword && !s.codeSentTo && <Button variant="ghost" size="sm" onClick={() => switchMode(true)} data-testid="acc-pw-toggle">{t('account.passwordToggle')}</Button>}
      {s.error && <p className="err-text" role="alert" data-testid="acc-error">{t(`account.errors.${s.error}`)}</p>}
    </div>
  );
}
