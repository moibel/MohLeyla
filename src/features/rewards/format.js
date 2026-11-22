/** One short line describing a reward, in the interface language: "Stars: +5", "Bonus XP: +250", "Badge: Challenge winner". */
export function describe(t, r) {
  if (r.kind === 'badge') return t('rewards.gotBadge', { label: r.label });
  return t(r.kind === 'xp' ? 'rewards.gotXp' : 'rewards.gotStars', { n: r.amount });
}
