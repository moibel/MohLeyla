import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, KeyRound } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';

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
