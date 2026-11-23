import { Volume2, Square, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../features/audio/audioService.js';
import { speechKey, useAudioState } from '../features/audio/useAudio.js';
import { speechLang } from '../data/content.js';

/**
 * Speaker button. `track` is the lesson track (ar | sa | en | id) so Saudi text is labelled honestly.
 * Clicking while playing stops playback; repeated clicks never overlap clips.
 */
export default function SpeakButton({ text, track, label, variant = 'icon', className = '' }) {
  const { t } = useTranslation();
  const lang = speechLang(track);
  const st = useAudioState();
  const active = st.key === speechKey(text, lang);
  const status = active ? st.status : 'idle';
  const aria = status === 'playing' || status === 'loading' ? t('audio.stop') : label || t('audio.play');
  const Icon = status === 'loading' ? Loader2 : status === 'playing' ? Square : Volume2;
  return (
    <button
      type="button"
      className={`speak speak-${variant} ${status !== 'idle' ? 'is-active' : ''} ${className}`}
      aria-label={aria}
      aria-pressed={status === 'playing'}
      data-status={status}
      onClick={() => audio.play({ text, lang, track })}
    >
      <Icon size={variant === 'pill' ? 18 : 20} className={status === 'loading' ? 'spin' : ''} aria-hidden="true" />
      {variant === 'pill' && <span>{label || t('audio.play')}</span>}
    </button>
  );
}
