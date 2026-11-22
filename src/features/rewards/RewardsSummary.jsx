import { useTranslation } from 'react-i18next';
import { Star, Zap, Award } from 'lucide-react';
import { useRewards } from './store.js';

/** Stars, bonus XP and badges the admin gave this learner (shown on the profile page). */
export default function RewardsSummary() {
  const { t } = useTranslation();
  const rw = useRewards();
  const empty = !rw.list.length;
  return (
    <section className="card stack-sm" aria-labelledby="rewards-h" data-testid="rewards-summary">
      <h2 id="rewards-h" className="h-sm"><Award size={20} aria-hidden="true" /> {t('rewards.title')}</h2>
      {empty ? <p className="muted">{t('rewards.none')}</p> : (
        <>
          <dl className="reward-totals">
            <div><dt><Star size={16} aria-hidden="true" /> {t('rewards.stars')}</dt><dd data-testid="reward-stars">{rw.stars}</dd></div>
            <div><dt><Zap size={16} aria-hidden="true" /> {t('rewards.bonusXp')}</dt><dd data-testid="reward-xp">{rw.bonusXp}</dd></div>
          </dl>
          {rw.badges.length > 0 && (
            <>
              <h3 className="h-xs">{t('rewards.badges')}</h3>
              <ul className="badge-list">{rw.badges.map((b) => <li key={b.id} className="badge-chip" data-testid="reward-badge"><Award size={16} aria-hidden="true" /><bdi>{b.label}</bdi>{b.reason ? <small className="muted"><bdi>{b.reason}</bdi></small> : null}</li>)}</ul>
            </>
          )}
          <p className="note-small">{t('rewards.fromAdmin')}. {t('rewards.note')}</p>
        </>
      )}
    </section>
  );
}
