/** "video:ended:3" -> "Video call · 3 min", "audio:missed" -> "Missed voice call" (translated). */
export function callText(t, body) {
  const [media, status, mins] = String(body || '').split(':');
  if (!['audio', 'video'].includes(media) || !['ended', 'missed', 'declined'].includes(status)) return t('calls.callGeneric');
  return t(`calls.line.${media}.${status}`, { n: Number(mins) || 1 });
}
