import '../i18n/pages.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search, Gift } from 'lucide-react';
import AdminContent from '../features/availability/AdminContent.jsx';
import AdminRewards from '../features/rewards/AdminRewards.jsx';
import AdminChats from '../features/chat/AdminChats.jsx';
import AdminReports from '../features/chat/AdminReports.jsx';
import MessageButton from '../features/chat/MessageButton.jsx';
import AdminAnnouncements from '../features/announcements/AdminAnnouncements.jsx';
import { PageHeading, Button, Chip } from '../components/ui.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { adminListUsers, adminSetRole, adminSetSuspended } from '../features/classes/api.js';
import { useSync } from '../features/sync/useSync.js';
import { LANG_META } from '../i18n/index.js';

const ROLES = ['student', 'teacher', 'admin'];
const TABS = ['users', 'chats', 'reports', 'content', 'news', 'rewards'];

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
  const [giveTo, setGiveTo] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'users';
  const setTab = (k) => setParams(k === 'users' ? {} : { tab: k }, { replace: true });
  useEffect(() => { document.getElementById(`admin-tab-${tab}`)?.scrollIntoView?.({ inline: 'center', block: 'nearest' }); }, [tab]); // keep the open tab visible in the scrolling tab strip
  const onTabKey = (e) => {
    const i = TABS.indexOf(tab);
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key] * (document.dir === 'rtl' ? -1 : 1);
    if (!dir) return;
    e.preventDefault();
    const k = TABS[(i + dir + TABS.length) % TABS.length];
    setTab(k);
    requestAnimationFrame(() => document.getElementById(`admin-tab-${k}`)?.focus());
  };

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
      <div className="admin-tabs" role="tablist" aria-label={t('admin.title')} onKeyDown={onTabKey}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" id={`admin-tab-${k}`} aria-selected={tab === k} aria-controls="admin-panel" tabIndex={tab === k ? 0 : -1}
            className={`admin-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)} data-testid={`admin-tab-${k}`}>{t(`admin.tabs.${k}`)}</button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="admin-panel" data-testid={`admin-panel-${tab}`}>
        {tab === 'users' && (
          <>
            <dl className="admin-stats" data-testid="admin-stats">
              {[['total', stats.total], ['students', stats.student], ['teachers', stats.teacher], ['admins', stats.admin], ['active', stats.active]].map(([k, n]) => (
                <div key={k} className="stat-tile-lite"><dt>{t(`admin.stats.${k}`)}</dt><dd>{users ? n : '–'}</dd></div>
              ))}
            </dl>
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
            <div className="card table-scroll admin-users-card">
              {users === null && <p className="muted" role="status">{t('app.loading')}</p>}
              {users && (
                <>
                  <p className="muted small" role="status">{t('admin.count', { shown: shown.length, total: users.length })}</p>
                  <table className="data-table">
                    <thead><tr>
                      <th scope="col">{t('admin.colUser')}</th><th scope="col">{t('admin.colRole')}</th><th scope="col">{t('admin.colMethod')}</th>
                      <th scope="col">{t('admin.colSignIn')}</th><th scope="col">{t('teach.colXp')}</th><th scope="col">{t('teach.colLessons')}</th><th scope="col"><span className="sr-only">{t('rewards.admin.giveTo')}</span></th><th scope="col"><span className="sr-only">{t('chat.messageUser')}</span></th>
                    </tr></thead>
                    <tbody>
                      {shown.map((u) => (
                        <tr key={u.user_id} data-testid="user-row">
                          <th scope="row"><bdi>{u.display_name || u.email}</bdi>{u.display_name && <small className="muted" dir="ltr"><br />{u.email}</small>}{u.user_id === me.userId && <Chip tone="brand">{t('admin.you')}</Chip>}
                            {u.suspended && <><Chip>{t('safety.admin.suspended')}</Chip> <Button variant="ghost" size="sm" onClick={async () => { try { await adminSetSuspended(u.user_id, false); await load(); } catch { setMsg({ ok: false, text: t('safety.admin.failed') }); } }} data-testid="unsuspend">{t('safety.admin.unsuspend')}</Button></>}</th>
                          <td>
                            <label><span className="sr-only">{t('admin.colRole')}: {u.display_name || u.email}</span>
                              <select value={u.role} onChange={(e) => { setPending({ user: u, role: e.target.value }); dlg.current?.showModal(); }} data-testid="role-select" className="role-select">
                                {ROLES.map((r) => <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>)}
                              </select></label>
                          </td>
                          <td>{(u.providers || '').split(',').filter(Boolean).map((p) => t(`admin.provider.${p}`, { defaultValue: p })).join(' + ') || '—'}</td>
                          <td>{fmt(u.last_sign_in_at)}</td><td>{u.xp ?? 0}</td><td>{u.lessons_done ?? 0}</td>
                          <td><button type="button" className="icon-btn" aria-label={`${t('rewards.admin.giveTo')}: ${u.display_name || u.email}`} title={t('rewards.admin.giveTo')} onClick={() => { setGiveTo(u.email); setTab('rewards'); }} data-testid="give-reward"><Gift size={20} aria-hidden="true" /></button></td>
                          <td>{u.user_id !== me.userId && <MessageButton userId={u.user_id} name={u.display_name || u.email} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}
        {tab === 'chats' && <AdminChats />}
        {tab === 'reports' && <AdminReports />}
        {tab === 'content' && <AdminContent />}
        {tab === 'news' && <AdminAnnouncements />}
        {tab === 'rewards' && <AdminRewards email={giveTo} />}
      </div>
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
