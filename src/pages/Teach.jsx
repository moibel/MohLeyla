import '../i18n/pages.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Trash2, ChevronDown, ChevronUp, UserMinus } from 'lucide-react';
import { PageHeading, Button, EmptyState } from '../components/ui.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import MessageButton from '../features/chat/MessageButton.jsx';
import { createClass, teacherClasses, classRoster, deleteClass, removeMember, liveStreak, rotateClassCode, classBans, unbanStudent } from '../features/classes/api.js';
import { localDay } from '../utils/dates.js';
import { LANG_META } from '../i18n/index.js';

/** Teacher view: classes with join codes, and each student's progress SUMMARY (never raw answers or recordings). */
function TeachInner() {
  const { t, i18n } = useTranslation();
  const [classes, setClasses] = useState(null);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(null);
  const [roster, setRoster] = useState(null);
  const [bans, setBans] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null); // { kind: 'remove' | 'delete', ... }
  const dlg = useRef(null);
  const today = localDay();
  const err = (e) => setMsg({ ok: false, text: t(`classes.errors.${e.code}`) });

  const load = useCallback(async () => {
    try { setClasses(await teacherClasses()); } catch (e) { setClasses([]); err(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadRoster = async (id) => {
    setOpen(id); setRoster(null); setBans([]);
    classBans(id).then((r) => setBans(r || [])).catch(() => {}); // needs the latest database update
    try { setRoster(await classRoster(id)); } catch (e) { setRoster([]); err(e); }
  };
  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { const c = await createClass(name); setName(''); await load(); setMsg({ ok: true, text: t('teach.created', { name: c.name, code: c.code }) }); }
    catch (e2) { err(e2); }
    setBusy(false);
  };
  const newCode = async (classId) => {
    setMsg(null);
    try { const code = await rotateClassCode(classId); await load(); setMsg({ ok: true, text: t('safety.teacher.newCodeDone', { code }) }); } catch (e) { err(e); }
  };
  const allowBack = async (classId, studentId) => {
    try { await unbanStudent(classId, studentId); setBans((b) => b.filter((x) => x.student_id !== studentId)); } catch (e) { err(e); }
  };
  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); setMsg({ ok: true, text: t('teach.copied', { code }) }); } catch { setMsg({ ok: false, text: t('teach.copyFailed') }); }
  };
  const confirm = async () => {
    const tg = target;
    dlg.current?.close();
    try {
      if (tg.kind === 'remove') { await removeMember(tg.classId, tg.student.student_id); await loadRoster(tg.classId); }
      else { await deleteClass(tg.classId); setOpen(null); setRoster(null); }
      await load();
    } catch (e) { err(e); }
  };
  const fmt = (d) => (d ? new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)) : t('teach.never'));

  return (
    <div className="page" data-testid="teach-page">
      <PageHeading title={t('teach.title')} subtitle={t('teach.subtitle')} />
      <section className="card stack-sm">
        <h2 className="h-sm">{t('teach.createTitle')}</h2>
        <form className="stack-sm" onSubmit={create}>
          <label className="field"><span>{t('teach.nameLabel')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} data-testid="class-name" /></label>
          <div className="btn-row"><Button type="submit" icon={<Plus size={18} aria-hidden="true" />} disabled={busy || !name.trim()} data-testid="class-create">{t('teach.create')}</Button></div>
        </form>
        {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="teach-msg">{msg.text}</p>}
      </section>

      {classes && classes.length === 0 && <EmptyState icon="🏫" title={t('teach.none')} text={t('teach.noneText')} />}
      {(classes || []).map((c) => (
        <section className="card stack-sm" key={c.class_id} data-testid="class-card">
          <div className="row-between">
            <div>
              <h2 className="h-sm" style={{ margin: 0 }}><bdi>{c.class_name}</bdi></h2>
              <p className="muted small">{t('teach.students', { n: Number(c.member_count) })}</p>
            </div>
            <div className="code-chip" dir="ltr"><span className="sr-only">{t('teach.codeLabel')}: </span><code data-testid="class-code">{c.code}</code>
              <button type="button" className="icon-btn" aria-label={t('teach.copy')} onClick={() => copy(c.code)}><Copy size={18} aria-hidden="true" /></button></div>
          </div>
          <div className="btn-row">
            <Button variant="secondary" size="sm" icon={open === c.class_id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              onClick={() => (open === c.class_id ? (setOpen(null), setRoster(null)) : loadRoster(c.class_id))} data-testid="view-students">{open === c.class_id ? t('teach.hide') : t('teach.view')}</Button>
            <Button variant="ghost" size="sm" onClick={() => newCode(c.class_id)} data-testid="new-code">{t('safety.teacher.newCode')}</Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => { setTarget({ kind: 'delete', classId: c.class_id, name: c.class_name }); dlg.current?.showModal(); }} data-testid="delete-class">{t('teach.deleteClass')}</Button>
          </div>
          {open === c.class_id && (
            <div className="table-scroll" data-testid="roster">
              {roster === null && <p className="muted">{t('app.loading')}</p>}
              {roster && roster.length === 0 && <p className="muted" dir="auto">{t('teach.empty', { code: c.code })}</p>}
              {roster && roster.length > 0 && (() => {
                const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
                const active = roster.filter((r) => r.last_active && r.last_active >= weekAgo).length;
                const avg = Math.round(roster.reduce((a, r) => a + (r.xp || 0), 0) / roster.length);
                return <p className="roster-summary" data-testid="roster-summary">{t('teach.summary', { active, n: roster.length, xp: avg })}</p>;
              })()}
              {roster && roster.length > 0 && (
                <table className="data-table">
                  <thead><tr>
                    <th scope="col">{t('teach.colStudent')}</th><th scope="col">{t('teach.colXp')}</th><th scope="col">{t('teach.colLessons')}</th>
                    <th scope="col">{t('teach.colStreak')}</th><th scope="col">{t('teach.colAccuracy')}</th><th scope="col">{t('teach.colActive')}</th><th scope="col"><span className="sr-only">{t('chat.messageUser')}</span></th><th scope="col"><span className="sr-only">{t('teach.remove')}</span></th>
                  </tr></thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.student_id} data-testid="student-row">
                        <th scope="row"><bdi>{s.display_name || s.email}</bdi>{s.display_name && <small className="muted" dir="ltr"><br />{s.email}</small>}</th>
                        <td>{s.xp ?? 0}</td><td>{s.lessons_done ?? 0}</td>
                        <td>{liveStreak(s.streak, s.streak_last, today)}</td>
                        <td>{s.accuracy == null ? '—' : `${s.accuracy}%`}</td>
                        <td>{fmt(s.last_active)}</td>
                        <td><MessageButton userId={s.student_id} name={s.display_name || s.email} testId="message-student" /></td>
                        <td><button type="button" className="icon-btn" aria-label={`${t('teach.remove')}: ${s.display_name || s.email}`} onClick={() => { setTarget({ kind: 'remove', classId: c.class_id, student: s }); dlg.current?.showModal(); }} data-testid="remove-student"><UserMinus size={18} aria-hidden="true" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {bans.length > 0 && (
                <div data-testid="class-bans"><h3 className="h-xs">{t('safety.teacher.removed')}</h3>
                  <ul className="transcript">{bans.map((b) => <li key={b.student_id}><bdi>{b.display_name || b.email}</bdi> <Button variant="ghost" size="sm" onClick={() => allowBack(c.class_id, b.student_id)}>{t('safety.teacher.allow')}</Button></li>)}</ul>
                </div>
              )}
              <p className="note-small">{t('teach.privacy')}</p>
            </div>
          )}
        </section>
      ))}

      <dialog ref={dlg} className="dialog" aria-labelledby="tc-t" data-testid="teach-confirm">
        <h2 id="tc-t">{target?.kind === 'delete' ? t('teach.deleteTitle') : t('teach.removeTitle')}</h2>
        <p>{target?.kind === 'delete' ? t('teach.deleteText', { name: target.name }) : t('teach.removeText', { name: target?.student?.display_name || target?.student?.email || '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={confirm} data-testid="teach-confirm-yes">{target?.kind === 'delete' ? t('teach.deleteClass') : t('teach.remove')}</Button>
        </div>
      </dialog>
    </div>
  );
}

export default function Teach() {
  const { t } = useTranslation();
  return <RequireAccount title={t('teach.title')} roles={['teacher', 'admin']}><TeachInner /></RequireAccount>;
}
