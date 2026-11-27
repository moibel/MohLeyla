import { useTranslation } from 'react-i18next';
import './register.js';
import { Button } from '../../components/ui.jsx';
import { sync } from '../sync/index.js';
import { useSync } from '../sync/useSync.js';
import { REQUIRE_SIGN_IN } from '../../services/supabaseClient.js';

/** Settings card to change the languages and levels chosen in the set-up. */
export default function PlanSection() {
  const { t } = useTranslation();
  const s = useSync();
  if (!REQUIRE_SIGN_IN || !s.userId) return null;
  const plan = s.profile?.learning;
  return (
    <section className="card stack-sm" data-testid="plan-section">
      <h2>{t('welcome.planTitle')}</h2>
      <p className="muted">{t('welcome.planText')}</p>
      {plan && <p>{plan.tracks.map((k) => `${t(`tracks.${k}.short`)}: ${t(`welcome.${plan.levels[k]}`)}`).join(' · ')}</p>}
      <div className="btn-row"><Button variant="secondary" onClick={() => sync.set({ editPlan: true })} data-testid="plan-edit">{t('welcome.planButton')}</Button></div>
    </section>
  );
}
