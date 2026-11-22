import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from 'lucide-react';
import { Button, Chip } from '../../components/ui.jsx';
import { adminGrantReward, adminListRewards, adminRevokeReward } from '../classes/api.js';
import { LANG_META } from '../../i18n/index.js';
import { describe } from './format.js';

/** Admin: give stars / bonus XP / a badge to any email address, and see or take back what was given. */
export default function AdminRewards({ email: presetEmail = '' }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState(presetEmail);
  const [kind, setKind] = useState('star');
  const [amount, setAmount] = useState(5);
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState(null);
  const dlg = useRef(null);
  const emailRef = useRef(null);

  useEffect(() => { if (presetEmail) { setEmail(presetEmail); emailRef.current?.focus(); } }, [presetEmail]);
  const load = useCallback(async () => {
    try { setRows(await adminListRewards()); } catch (e) { setRows([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = { kind, amount: kind === 'badge' ? 1 : Number(amount), label: kind === 'badge' ? label : '' };
    try {
      await adminGrantReward({ email: email.trim(), kind, amount: r.amount, label: r.label, reason });
      setMsg({ ok: true, text: t('rewards.admin.given', { what: describe(t, r), email: email.trim().toLowerCase() }) });
      setReason(''); setLabel('');
      await load();
    } catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
    setBusy(false);
  };
  const revoke = async () => {
    const p = pending;
    dlg.current?.close();
    try { await adminRevokeReward(p.id); setMsg({ ok: true, text: t('rewards.admin.revokedMsg') }); } catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
    await load();
  };
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d));

  return (
    <section className="card stack-sm" aria-labelledby="rw-h" data-testid="admin-rewards">
      <h2 id="rw-h" className="h-md"><Gift size={20} aria-hidden="true" /> {t('rewards.admin.title')}</h2>
      <p className="muted">{t('rewards.admin.subtitle')}</p>
      <form className="reward-form" onSubmit={submit}>
        <label className="field wide"><span>{t('rewards.admin.email')}</span>
          <input ref={emailRef} type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" data-testid="reward-email" /></label>
        <label className="field"><span>{t('rewards.admin.kind')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} data-testid="reward-kind" className="role-select">
            {['star', 'xp', 'badge'].map((k) => <option key={k} value={k}>{t(`rewards.kinds.${k}`)}</option>)}
          </select></label>
        {kind === 'badge' ? (
          <label className="field"><span>{t('rewards.admin.badgeName')}</span>
            <input required maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} data-testid="reward-label" /></label>
        ) : (
          <label className="field"><span>{t('rewards.admin.amount')}</span>
            <input type="number" required min={1} max={kind === 'xp' ? 10000 : 1000} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="reward-amount" /></label>
        )}
        <label className="field wide"><span>{t('rewards.admin.reason')}</span>
          <input maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="reward-reason" /></label>
        <div className="wide"><Button type="submit" disabled={busy} data-testid="reward-give">{t('rewards.admin.give')}</Button></div>
      </form>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="reward-msg">{msg.text}</p>}
      <h3 className="h-xs">{t('rewards.admin.history')}</h3>
      {rows === null && <p className="muted">{t('app.loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('rewards.admin.empty')}</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr>
              <th scope="col">{t('rewards.admin.colWhen')}</th><th scope="col">{t('rewards.admin.colTo')}</th><th scope="col">{t('rewards.admin.colReward')}</th>
              <th scope="col">{t('rewards.admin.colReason')}</th><th scope="col"><span className="sr-only">{t('rewards.admin.revoke')}</span></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="reward-row" className={r.revoked_at ? 'is-revoked' : ''}>
                  <td>{fmt(r.created_at)}</td>
                  <th scope="row"><bdi dir="ltr">{r.email}</bdi>{r.display_name && <small className="muted"><br /><bdi>{r.display_name}</bdi></small>}</th>
                  <td><bdi>{describe(t, r)}</bdi></td>
                  <td><bdi>{r.reason || '—'}</bdi></td>
                  <td>{r.revoked_at ? <Chip>{t('rewards.admin.revoked')}</Chip> : <Button variant="ghost" size="sm" onClick={() => { setPending(r); dlg.current?.showModal(); }} data-testid="reward-revoke">{t('rewards.admin.revoke')}</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog ref={dlg} className="dialog" aria-labelledby="rw-t" data-testid="reward-confirm">
        <h2 id="rw-t">{t('rewards.admin.confirmTitle')}</h2>
        <p>{t('rewards.admin.confirmText', { what: pending ? describe(t, pending) : '', email: pending?.email || '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button onClick={revoke} data-testid="reward-confirm-yes">{t('common.confirm')}</Button>
        </div>
      </dialog>
    </section>
  );
}
