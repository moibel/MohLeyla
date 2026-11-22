import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { PageHeading, Button, Chip } from '../components/ui.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { adminListUsers, adminSetRole } from '../features/classes/api.js';
import { useSync } from '../features/sync/useSync.js';
import { LANG_META } from '../i18n/index.js';

const ROLES = ['student', 'teacher', 'admin'];

/** Admin view: every user, their sign-in method, activity summary and role. Role changes are checked by the database. */
function AdminInner() {
  const { t, i18n } = useTranslation();
  const me = useSync();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const dlg = useRef(null);

  const load = useCallback(async () => {
    try { setUsers(await adminListUsers()); } catch (e) { setUsers([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (users || []).filter((u) => (roleFilter === 'all' || u.role === roleFilter) && (!n || [u.email, u.display_name].some((s) => (s || '').toLowerCase().includes(n))));
  }, [users, q, roleFilter]);
  const stats = useMemo(() => {
    const us = users || [];
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    return { total: us.length, student: us.filter((u) => u.role === 'student').length, teacher: us.filter((u) => u.role === 'teacher').length, admin: us.filter((u) => u.role === 'admin').length, active: us.filter((u) => u.last_sign_in_at && u.last_sign_in_at >= weekAgo).length };
  }, [users]);

  const apply = async () => {
    const p = pending;
    dlg.current?.close();
    try { await adminSetRole(p.user.user_id, p.role); setMsg({ ok: true, text: t('admin.saved', { name: p.user.display_name || p.user.email, role: t(`admin.roles.${p.role}`) }) }); await load(); }
    catch (e) { setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); await load(); }
  };
  const fmt = (d) => (d ? new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)) : '—');

  return (
    <div className="page" data-testid="admin-page">
      <PageHeading title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {users && users.length > 0 && (
        <dl className="admin-stats" data-testid="admin-stats">
          {[['total', stats.total], ['students', stats.student], ['teachers', stats.teacher], ['admins', stats.admin], ['active', stats.active]].map(([k, n]) => (
            <div key={k} className="stat-tile-lite"><dt>{t(`admin.stats.${k}`)}</dt><dd>{n}</dd></div>
          ))}
        </dl>
      )}
      <div className="toolbar">
        <label className="searchbox"><Search size={20} aria-hidden="true" /><span className="sr-only">{t('common.search')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.search')} data-testid="admin-search" /></label>
        <label><span className="sr-only">{t('admin.colRole')}</span>
          <select className="role-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} data-testid="role-filter">
            <option value="all">{t('admin.filterAll')}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>)}
          </select></label>
      </div>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="admin-msg">{msg.text}</p>}
      {users === null && <p className="muted">{t('app.loading')}</p>}
      {users && (
        <div className="card table-scroll">
          <p className="muted small" role="status">{t('admin.count', { count: shown.length, total: users.length })}</p>
          <table className="data-table">
            <thead><tr>
              <th scope="col">{t('admin.colUser')}</th><th scope="col">{t('admin.colRole')}</th><th scope="col">{t('admin.colMethod')}</th>
              <th scope="col">{t('admin.colSignIn')}</th><th scope="col">{t('teach.colXp')}</th><th scope="col">{t('teach.colLessons')}</th>
            </tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.user_id} data-testid="user-row">
                  <th scope="row"><bdi>{u.display_name || u.email}</bdi>{u.display_name && <small className="muted" dir="ltr"><br />{u.email}</small>}{u.user_id === me.userId && <Chip tone="brand">{t('admin.you')}</Chip>}</th>
                  <td>
                    <label><span className="sr-only">{t('admin.colRole')}: {u.display_name || u.email}</span>
                      <select value={u.role} onChange={(e) => { setPending({ user: u, role: e.target.value }); dlg.current?.showModal(); }} data-testid="role-select" className="role-select">
                        {ROLES.map((r) => <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>)}
                      </select></label>
                  </td>
                  <td>{(u.providers || '').split(',').filter(Boolean).map((p) => t(`admin.provider.${p}`, { defaultValue: p })).join(' + ') || '—'}</td>
                  <td>{fmt(u.last_sign_in_at)}</td><td>{u.xp ?? 0}</td><td>{u.lessons_done ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog ref={dlg} className="dialog" aria-labelledby="ad-t" data-testid="admin-confirm">
        <h2 id="ad-t">{t('admin.changeTitle')}</h2>
        <p>{t('admin.changeText', { name: pending?.user.display_name || pending?.user.email || '', role: pending ? t(`admin.roles.${pending.role}`) : '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => { dlg.current?.close(); load(); }}>{t('common.cancel')}</Button>
          <Button onClick={apply} data-testid="admin-confirm-yes">{t('common.confirm')}</Button>
        </div>
      </dialog>
    </div>
  );
}

export default function Admin() {
  const { t } = useTranslation();
  return <RequireAccount title={t('admin.title')} roles={['admin']}><AdminInner /></RequireAccount>;
}
