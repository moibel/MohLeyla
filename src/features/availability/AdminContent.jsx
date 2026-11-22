import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { TRACKS, lessonsOfTrack } from '../../data/content.js';
import { isLessonHidden, isTrackHidden, useAvailability } from '../../data/availability.js';
import { adminSetContentEnabled } from '../classes/api.js';
import { refreshAvailability } from './sync.js';

/** Admin: show or hide a whole learning path, or single lessons, for every learner. Progress is never deleted. */
export default function AdminContent() {
  const { t, i18n } = useTranslation();
  useAvailability();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const toggle = async (kind, key, label, enabled) => {
    setBusy(`${kind}:${key}`); setMsg(null);
    try {
      await adminSetContentEnabled(kind, key, enabled);
      await refreshAvailability(true);
      setMsg({ ok: true, text: t(enabled ? 'content.shownMsg' : 'content.hiddenMsg', { name: label }) });
    } catch (e) { setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
    setBusy('');
  };

  return (
    <section className="card stack-sm" aria-labelledby="ct-h" data-testid="admin-content">
      <h2 id="ct-h" className="h-md"><Eye size={20} aria-hidden="true" /> {t('content.title')}</h2>
      <p className="muted">{t('content.subtitle')}</p>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="content-msg">{msg.text}</p>}
      {TRACKS.map((k) => {
        const lessons = lessonsOfTrack(k);
        const trackOff = isTrackHidden(k);
        const hiddenCount = lessons.filter((l) => isLessonHidden(l.id)).length;
        const name = t(`tracks.${k}.name`);
        return (
          <details key={k} className="content-track" data-testid={`content-track-${k}`}>
            <summary>
              <span className="content-name">{name}</span>
              <span className="muted small">{trackOff ? t('content.pathHidden') : hiddenCount ? t('content.someHidden', { n: hiddenCount, total: lessons.length }) : t('content.allShown', { total: lessons.length })}</span>
            </summary>
            <label className="switch-row">
              <input type="checkbox" role="switch" checked={!trackOff} disabled={busy === `track:${k}`} onChange={(e) => toggle('track', k, name, e.target.checked)} data-testid={`track-switch-${k}`} />
              <span><strong>{t('content.showPath')}</strong><small className="muted"> {t('content.showPathHelp')}</small></span>
            </label>
            <ul className="content-lessons">
              {lessons.map((l) => {
                const title = l.title[i18n.language];
                return (
                  <li key={l.id}>
                    <label className="switch-row">
                      <input type="checkbox" role="switch" checked={!isLessonHidden(l.id)} disabled={trackOff || busy === `lesson:${l.id}`} onChange={(e) => toggle('lesson', l.id, title, e.target.checked)} data-testid={`lesson-switch-${l.id}`} aria-label={`${t('content.showLesson')}: ${title}`} />
                      <span><bdi lang={i18n.language}>{title}</bdi></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
