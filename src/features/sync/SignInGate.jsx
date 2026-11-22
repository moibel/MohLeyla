import { useTranslation } from 'react-i18next';
import { Logo, Spinner } from '../../components/ui.jsx';
import { LangSwitcher } from '../../app/Layout.jsx';
import SignInForm from './SignInForm.jsx';
import SyncDialogs from './SyncDialogs.jsx';
import { useSync } from './useSync.js';
import { REQUIRE_SIGN_IN } from '../../services/supabaseClient.js';

/** When the build sets VITE_REQUIRE_SIGN_IN=true, nothing in the app is shown until the learner has signed in. */
export function SignInGate() {
  const { t } = useTranslation();
  return (
    <main className="gate" id="main" data-testid="gate">
      <div className="gate-lang"><LangSwitcher /></div>
      <section className="card gate-card">
        <Logo size={56} />
        <h1>{t('gate.title')}</h1>
        <p>{t('gate.text')}</p>
        <SignInForm />
        <p className="note-small">{t('gate.firstTime')}</p>
        <p className="note-small">{t('account.privacy')}</p>
      </section>
      <p className="gate-credit">{t('app.madeBy')} <bdi>{t('app.creator')}</bdi></p>
      <SyncDialogs />
    </main>
  );
}

export default function Gate({ children }) {
  const { t } = useTranslation();
  const s = useSync();
  if (!REQUIRE_SIGN_IN) return children;
  if (s.restoring) return <div className="gate" data-testid="gate-restoring"><Spinner label={t('gate.checking')} /></div>;
  if (!s.userId) return <SignInGate />;
  return children;
}
