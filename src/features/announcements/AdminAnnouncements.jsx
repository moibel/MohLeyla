import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import { Button, Chip } from '../../components/ui.jsx';
import { adminCreateAnnouncement, adminListAnnouncements, adminArchiveAnnouncement, adminClasses } from '../classes/api.js';
import { LANG_META, UI_LANGS } from '../../i18n/index.js';
import { pick } from './store.js';
import AnnouncementDialog from './AnnouncementDialog.jsx';
import { useProgress } from '../../app/ProgressContext.jsx';

const PERSON = '__person';
const blank = () => Object.fromEntries(UI_LANGS.map((l) => [l, { title: '', body: '' }]));

/** Admin: post a message to everyone or to one class, in one to three languages, and archive old ones. */
export default function AdminAnnouncements() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState(blank);
  const [classId, setClassId] = useState('');
  const [expires, setExpires] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [style, setStyle] = useState('info');
  const [preview, setPreview] = useState(null);
  const { state } = useProgress();
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const dlg = useRef(null);

  const load = useCallback(async () => {
    try { setRows(await adminListAnnouncements()); } catch (e) { setRows([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  useEffect(() => { load(); adminClasses().then(setClasses).catch(() => {}); }, [load]);

  const set = (lang, field, v) => setText((cur) => ({ ...cur, [lang]: { ...cur[lang], [field]: v } }));
  const submit = async (e) => {
    e.preventDefault();
    const title = {}; const body = {};
    let mismatch = false;
    for (const l of UI_LANGS) {
      const ti = text[l].title.trim(); const bo = text[l].body.trim();
      if (ti && bo) { title[l] = ti; body[l] = bo; } else if (ti || bo) mismatch = true;
    }
    if (mismatch || !Object.keys(title).length) { setMsg({ ok: false, text: t('news.admin.needBoth') }); return; }
    const toPerson = classId === PERSON;
    setBusy(true); setMsg(null);
    try {
      const end = expires ? new Date(`${expires}T23:59:59`).toISOString() : null;
      await adminCreateAnnouncement({ title, body, classId: toPerson ? null : classId || null, expires: end, userEmail: toPerson ? personEmail.trim() : null, style });
      setMsg({ ok: true, text: t('news.admin.posted') });
      setText(blank()); setExpires(''); setPersonEmail(''); setStyle('info');
      await load();
    } catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
    setBusy(false);
  };
  const openPreview = () => {
    const lang = UI_LANGS.includes(i18n.language) && (text[i18n.language].title.trim() || text[i18n.language].body.trim()) ? i18n.language : UI_LANGS.find((l) => text[l].title.trim() || text[l].body.trim());
    if (!lang || !text[lang].title.trim() || !text[lang].body.trim()) { setMsg({ ok: false, text: t('news.admin.previewEmpty') }); return; }
    setMsg(null);
    setPreview({ id: `preview-${Date.now()}`, style, audience: classId === PERSON ? 'user' : 'all', title: text[lang].title.trim(), body: text[lang].body.trim() });
  };
  const archive = async () => {
    const p = pending;
    dlg.current?.close();
    try { await adminArchiveAnnouncement(p.id); setMsg({ ok: true, text: t('news.admin.archivedMsg') }); } catch (err) { setMsg({ ok: false, text: t(`classes.errors.${err.code}`) }); }
    await load();
  };
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d));
  const status = (a) => (a.archived_at ? 'archived' : a.expires_at && new Date(a.expires_at) <= new Date() ? 'expired' : 'live');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="card stack-sm" aria-labelledby="an-h" data-testid="admin-news">
      <h2 id="an-h" className="h-md"><Megaphone size={20} aria-hidden="true" /> {t('news.admin.title')}</h2>
      <p className="muted">{t('news.admin.subtitle')}</p>
      <form className="stack-sm" onSubmit={submit}>
        <div className="reward-form">
          <label className="field"><span>{t('news.admin.audience')}</span>
            <select className="role-select" value={classId} onChange={(e) => setClassId(e.target.value)} data-testid="news-audience">
              <option value="">{t('news.admin.everyone')}</option>
              <option value={PERSON}>{t('news.admin.person')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{t('news.admin.onlyClass', { name: c.name })}</option>)}
            </select></label>
          {classId === PERSON && (
            <label className="field wide"><span>{t('news.admin.personEmail')}</span>
              <input type="email" required dir="ltr" autoComplete="off" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} data-testid="news-person-email" />
              <small className="muted">{t('news.admin.personHelp')}</small></label>
          )}
          <label className="field wide"><span>{t('news.admin.styleLabel')}</span>
            <select className="role-select" value={style} onChange={(e) => setStyle(e.target.value)} data-testid="news-style">
              {['info', 'celebrate', 'alert'].map((k) => <option key={k} value={k}>{t(`news.admin.styles.${k}`)}</option>)}
            </select></label>
          <label className="field"><span>{t('news.admin.expires')}</span>
            <input type="date" min={today} value={expires} onChange={(e) => setExpires(e.target.value)} data-testid="news-expires" /></label>
        </div>
        {UI_LANGS.map((l) => (
          <fieldset key={l} className="news-lang">
            <legend>{LANG_META[l].label}</legend>
            <label className="field"><span>{t('news.admin.titleLabel')}</span>
              <input lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} maxLength={80} value={text[l].title} onChange={(e) => set(l, 'title', e.target.value)} data-testid={`news-title-${l}`} /></label>
            <label className="field"><span>{t('news.admin.bodyLabel')}</span>
              <textarea lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} rows={3} maxLength={600} value={text[l].body} onChange={(e) => set(l, 'body', e.target.value)} data-testid={`news-body-${l}`} /></label>
          </fieldset>
        ))}
        <p className="note-small">{t('news.admin.langNote')}</p>
        <div className="btn-row">
          <Button type="submit" disabled={busy} data-testid="news-post">{t('news.admin.post')}</Button>
          <Button type="button" variant="secondary" onClick={openPreview} data-testid="news-preview">{t('news.admin.preview')}</Button>
        </div>
      </form>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="news-msg">{msg.text}</p>}
      <h3 className="h-xs">{t('news.admin.history')}</h3>
      {rows === null && <p className="muted">{t('app.loading')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('news.admin.empty')}</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr>
              <th scope="col">{t('news.admin.colMessage')}</th><th scope="col">{t('news.admin.audience')}</th><th scope="col">{t('news.admin.colDate')}</th>
              <th scope="col">{t('news.admin.colStatus')}</th><th scope="col"><span className="sr-only">{t('news.admin.archive')}</span></th>
            </tr></thead>
            <tbody>
              {rows.map((a) => {
                const st = status(a);
                return (
                  <tr key={a.id} data-testid="news-row" className={st === 'live' ? '' : 'is-revoked'}>
                    <th scope="row"><bdi>{pick(a.title, i18n.language)}</bdi></th>
                    <td>{a.audience === 'user' ? <bdi dir="ltr">{t('news.admin.toPerson', { email: a.user_email })}</bdi> : a.class_name ? t('news.admin.onlyClass', { name: a.class_name }) : t('news.admin.everyone')}{a.style && a.style !== 'info' ? <><br /><Chip tone={a.style === 'alert' ? 'warn' : 'brand'}>{t(`news.admin.styles.${a.style}`).split(' (')[0]}</Chip></> : null}</td>
                    <td>{fmt(a.created_at)}</td>
                    <td><Chip tone={st === 'live' ? 'success' : undefined}>{t(`news.admin.status.${st}`)}</Chip></td>
                    <td>{st === 'live' && <Button variant="ghost" size="sm" onClick={() => { setPending(a); dlg.current?.showModal(); }} data-testid="news-archive">{t('news.admin.archive')}</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && <AnnouncementDialog item={preview} title={preview.title} body={preview.body} soundOn={state.settings.sfx !== 'off'} onClose={() => setPreview(null)} />}
      <dialog ref={dlg} className="dialog" aria-labelledby="an-t" data-testid="news-confirm">
        <h2 id="an-t">{t('news.admin.archiveTitle')}</h2>
        <p>{t('news.admin.archiveText', { title: pending ? pick(pending.title, i18n.language) : '' })}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button onClick={archive} data-testid="news-confirm-yes">{t('common.confirm')}</Button>
        </div>
      </dialog>
    </section>
  );
}
