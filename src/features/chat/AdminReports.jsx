import '../../i18n/pages.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { Button, Chip } from '../../components/ui.jsx';
import { adminListReports, adminResolveReport, adminSetSuspended } from '../classes/api.js';
import { LANG_META } from '../../i18n/index.js';

/** Admin: the queue of reports from chats; resolve or dismiss, and suspend the reported account. */
export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [target, setTarget] = useState(null);
  const dlg = useRef(null);
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  const load = useCallback(async () => {
    try { setRows(await adminListReports()); } catch { setRows([]); setMsg({ ok: false, text: t('safety.admin.failed') }); }
  }, [t]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: t('safety.admin.done') }); } catch { setMsg({ ok: false, text: t('safety.admin.failed') }); }
    await load();
  };

  return (
    <section className="card stack-sm" aria-labelledby="rq-h" data-testid="admin-reports">
      <h2 id="rq-h" className="h-md"><Flag size={20} aria-hidden="true" /> {t('safety.admin.title')}</h2>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {rows === null && <p className="muted">{t('app.loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('safety.admin.empty')}</p>}
      <ul className="transcript">
        {(rows || []).map((r) => (
          <li key={r.id} data-testid="report-row">
            <p><Chip tone={r.status === 'open' ? 'brand' : 'neutral'}>{t(`safety.admin.statuses.${r.status}`)}</Chip> <strong>{t(`safety.reasons.${r.reason}`)}</strong> <span className="muted small">{fmt(r.created_at)}</span></p>
            <p className="small">{t('safety.admin.by')}: <bdi>{r.reporter_name || r.reporter_email || '—'}</bdi> · {t('safety.admin.about')}: <bdi>{r.reported_name || r.reported_email || '—'}</bdi></p>
            {r.message_body && <p className="small">{t('safety.admin.said')}: <bdi>{r.message_body}</bdi></p>}
            {r.details && <p className="small muted"><bdi>{r.details}</bdi></p>}
            <div className="btn-row">
              {r.status === 'open' && <Button size="sm" onClick={() => act(() => adminResolveReport(r.id, 'resolved'))} data-testid="report-resolve">{t('safety.admin.resolve')}</Button>}
              {r.status === 'open' && <Button size="sm" variant="ghost" onClick={() => act(() => adminResolveReport(r.id, 'dismissed'))}>{t('safety.admin.dismiss')}</Button>}
              {r.reported_id && <Button size="sm" variant="secondary" onClick={() => { setTarget(r); dlg.current?.showModal(); }} data-testid="report-suspend">{t('safety.admin.suspend')}</Button>}
            </div>
          </li>
        ))}
      </ul>
      <dialog ref={dlg} className="dialog" aria-labelledby="su-t">
        <h2 id="su-t">{t('safety.admin.suspendTitle')}</h2>
        <p>{t('safety.admin.suspendText', { name: target?.reported_name || target?.reported_email || '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { dlg.current?.close(); act(() => adminSetSuspended(target.reported_id, true, target.reason)); }} data-testid="suspend-yes">{t('safety.admin.suspend')}</Button>
        </div>
      </dialog>
    </section>
  );
}
