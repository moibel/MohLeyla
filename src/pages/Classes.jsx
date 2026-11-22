import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, LogOut } from 'lucide-react';
import { PageHeading, Button, EmptyState } from '../components/ui.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { joinClass, myMemberships, removeMember } from '../features/classes/api.js';
import { useSync } from '../features/sync/useSync.js';
import { LANG_META } from '../i18n/index.js';

/** Student view: join a teacher's class with its code, see and leave classes. */
function ClassesInner() {
  const { t, i18n } = useTranslation();
  const s = useSync();
  const [code, setCode] = useState('');
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const dlg = useRef(null);

  const load = useCallback(async () => {
    try { setList(await myMemberships()); } catch (e) { setList([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const join = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const c = await joinClass(code);
      setMsg({ ok: true, text: t('classes.joined', { name: c?.class_name || '' }) });
      setCode('');
      await load();
    } catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
    setBusy(false);
  };
  const leave = async () => {
    const c = leaving;
    dlg.current?.close();
    try { await removeMember(c.class_id, s.userId); setMsg({ ok: true, text: t('classes.left', { name: c.class_name }) }); await load(); }
    catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
  };
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d));

  return (
    <div className="page narrow" data-testid="classes-page">
      <PageHeading title={t('classes.title')} subtitle={t('classes.intro')} />
      <section className="card stack-sm">
        <form className="stack-sm" onSubmit={join}>
          <label className="field">
            <span>{t('classes.codeLabel')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoComplete="off" autoCapitalize="characters" dir="ltr" className="code-input" data-testid="join-code" />
          </label>
          <Button type="submit" icon={<Users size={18} aria-hidden="true" />} disabled={busy || code.trim().length < 4} data-testid="join-submit">{t('classes.join')}</Button>
        </form>
        <p className="note-small">{t('classes.consent')}</p>
        {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="classes-msg">{msg.text}</p>}
      </section>
      <section className="stack-sm" aria-label={t('classes.mine')}>
        <h2 className="h-md">{t('classes.mine')}</h2>
        {list && list.length === 0 && <EmptyState icon={<Users size={44} />} title={t('classes.none')} />}
        {(list || []).map((c) => (
          <div className="card row-between" key={c.class_id} data-testid="membership">
            <div>
              <strong>{c.class_name}</strong>
              <p className="muted small">{t('classes.teacher', { name: c.teacher_name })} · {t('classes.since', { date: fmt(c.joined_at) })}</p>
            </div>
            <Button variant="ghost" size="sm" icon={<LogOut size={16} aria-hidden="true" />} onClick={() => { setLeaving(c); dlg.current?.showModal(); }} data-testid="leave">{t('classes.leave')}</Button>
          </div>
        ))}
      </section>
      <dialog ref={dlg} className="dialog" aria-labelledby="leave-t">
        <h2 id="leave-t">{t('classes.leaveTitle')}</h2>
        <p>{t('classes.leaveText', { name: leaving?.class_name || '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={leave} data-testid="leave-confirm">{t('classes.leave')}</Button>
        </div>
      </dialog>
    </div>
  );
}

export default function Classes() {
  const { t } = useTranslation();
  return <RequireAccount title={t('classes.title')}><ClassesInner /></RequireAccount>;
}
