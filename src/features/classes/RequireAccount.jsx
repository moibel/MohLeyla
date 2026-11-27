import '../../i18n/pages.js';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../components/ui.jsx';
import SignInForm from '../sync/SignInForm.jsx';
import { useSync } from '../sync/useSync.js';

/** Renders children only for a signed-in learner (and optionally a role); otherwise an explanation or the sign-in form. */
export default function RequireAccount({ title, roles, children }) {
  const { t } = useTranslation();
  const s = useSync();
  if (!s.configured) return <div className="page narrow"><PageHeading title={title} /><section className="card"><p>{t('classes.notConfigured')}</p></section></div>;
  if (!s.userId) {
    return (
      <div className="page narrow" data-testid="needs-signin">
        <PageHeading title={title} />
        <section className="card stack-sm"><p>{t('classes.signInFirst')}</p><SignInForm /></section>
      </div>
    );
  }
  if (roles && s.role && !roles.includes(s.role)) {
    return <div className="page narrow" data-testid="not-allowed"><PageHeading title={title} /><section className="card"><p>{t(roles.includes('teacher') ? 'teach.needRole' : 'admin.needRole')}</p></section></div>;
  }
  if (roles && !s.role) {
    return <div className="page narrow" data-testid="role-loading"><PageHeading title={title} /><section className="card"><p className="muted">{t('app.loading')}</p></section></div>;
  }
  return children;
}
