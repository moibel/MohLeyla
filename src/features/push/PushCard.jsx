import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { isNativeApp } from '../../utils/platform.js';
import { useSync } from '../sync/useSync.js';

/** Settings card: turn notifications on or off for THIS phone. Only in the iOS / Android app, and only when signed in. */
export default function PushCard() {
  const { t } = useTranslation();
  const s = useSync();
  const [svc, setSvc] = useState(null);
  const [on, setOn] = useState(false);
  const [state, setState] = useState('idle'); // idle | busy | denied | error
  useEffect(() => {
    if (!isNativeApp()) return;
    import('./pushService.js').then(async ({ getPushService }) => { const p = await getPushService(); setSvc(p); setOn(p.isOn()); });
  }, []);
  if (!isNativeApp() || !s.userId || !svc) return null;

  const toggle = async (next) => {
    setState('busy');
    if (!next) { await svc.disable(); setOn(false); setState('idle'); return; }
    const r = await svc.enable();
    setOn(r === 'enabled');
    setState(r === 'enabled' ? 'idle' : r === 'denied' ? 'denied' : 'error');
  };

  return (
    <section className="card stack-sm" data-testid="push-card">
      <h2 className="h-sm"><Bell size={18} aria-hidden="true" /> {t('push.title')}</h2>
      <p className="muted small">{t('push.text')}</p>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={on} disabled={state === 'busy'} onChange={(e) => toggle(e.target.checked)} data-testid="push-toggle" />
        <span>{t('push.toggle')}</span>
      </label>
      {state === 'denied' && <p className="err-text" role="alert" data-testid="push-denied">{t('push.denied')}</p>}
      {state === 'error' && <p className="err-text" role="alert" data-testid="push-error">{t('push.error')}</p>}
      <p className="note-small">{t('push.privacy')}</p>
    </section>
  );
}
