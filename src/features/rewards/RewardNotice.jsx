import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { play } from '../announcements/sfx.js';
import { useProgress } from '../../app/ProgressContext.jsx';
import { Gift } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { useRewards, markSeen } from './store.js';
import { describe } from './format.js';

/** Tells the learner once about rewards the admin gave them since they last looked. */
export default function RewardNotice() {
  const { t } = useTranslation();
  const rw = useRewards();
  const { state } = useProgress();
  const fresh = rw.unseen.length;
  useEffect(() => { if (fresh && state.settings.sfx !== 'off') play('reward'); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rw.unseen.length) return null;
  return (
    <div className="toast toast-reward" role="status" data-testid="reward-notice">
      <Gift size={22} aria-hidden="true" />
      <div>
        <strong>{t('rewards.newTitle')}</strong>
        <ul>{rw.unseen.slice(0, 5).map((r) => <li key={r.id}><bdi>{describe(t, r)}</bdi>{r.reason ? <span className="muted"> · <bdi>{r.reason}</bdi></span> : null}</li>)}</ul>
        <Button size="sm" onClick={markSeen} data-testid="reward-dismiss">{t('rewards.great')}</Button>
      </div>
    </div>
  );
}
