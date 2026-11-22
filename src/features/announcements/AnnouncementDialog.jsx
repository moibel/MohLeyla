import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PartyPopper, TriangleAlert, Megaphone, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { play, stopWaiting } from './sfx.js';

const ICON = { celebrate: PartyPopper, alert: TriangleAlert, info: Megaphone };
const COLORS = ['#FFC83D', '#0FB5A6', '#FF6B6B', '#7C5CFF', '#4DA3FF', '#FF9F43'];

/** Deterministic pseudo-random pieces (from the message id) so the same message always bursts the same way. */
function pieces(seed, n = 28) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  return Array.from({ length: n }, (_, i) => ({ i, x: Math.round(rnd() * 100), d: Math.round(rnd() * 600), s: 6 + Math.round(rnd() * 8), r: Math.round(rnd() * 360), c: COLORS[i % COLORS.length], round: rnd() > 0.5 }));
}

/**
 * The announcement as a pop-up: a headline card with a burst of confetti (celebration), a pulsing warning (important) or a soft glow,
 * plus a short sound. Used for messages meant for one person, for celebration / important ones, and for the admin's preview.
 * Motion is skipped when the device asks for reduced motion; sound follows the learner's "Sound effects" setting.
 */
export default function AnnouncementDialog({ item, title, body, soundOn, onSoundOff, onClose }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const style = item.style || 'info';
  const Icon = ICON[style] || Megaphone;
  const bits = useMemo(() => (style === 'celebrate' ? pieces(item.id || 'preview') : []), [style, item.id]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    if (soundOn) play(style);
    return () => { stopWaiting(); if (d && d.open) d.close(); };
    // play once per message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <dialog ref={ref} className={`announce announce-${style}`} aria-labelledby="ann-title" aria-describedby="ann-body" onCancel={(e) => { e.preventDefault(); onClose(); }} data-testid="announce" data-style={style}>
      {bits.length > 0 && (
        <div className="confetti-burst" aria-hidden="true">
          {bits.map((b) => <span key={b.i} className={b.round ? 'round' : ''} style={{ '--x': `${b.x}%`, '--d': `${b.d}ms`, '--s': `${b.s}px`, '--r': `${b.r}deg`, '--c': b.c }} />)}
        </div>
      )}
      <div className="announce-head">
        <span className="announce-badge" aria-hidden="true"><Icon size={34} /></span>
        {item.audience === 'user' && <span className="announce-tag" data-testid="announce-personal">{t('news.personal')}</span>}
      </div>
      <h2 id="ann-title" className="announce-title"><bdi>{title}</bdi></h2>
      <p id="ann-body" className="announce-body"><bdi>{body}</bdi></p>
      <div className="announce-actions">
        <Button size="lg" onClick={onClose} data-testid="announce-ok">{t('news.gotIt')}</Button>
        {soundOn && onSoundOff && <button type="button" className="link-btn" onClick={onSoundOff} data-testid="announce-mute"><VolumeX size={16} aria-hidden="true" /> {t('news.soundOff')}</button>}
        {!soundOn && <span className="muted small"><Volume2 size={14} aria-hidden="true" /> {t('news.soundIsOff')}</span>}
      </div>
    </dialog>
  );
}
