import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Trash2 } from 'lucide-react';
import { Button, Chip } from '../../components/ui.jsx';
import { adminListChats, adminChatMessages, adminRemoveMessage, adminExpiredFiles } from '../classes/api.js';
import ChatFile from './ChatFile.jsx';
import { removeFiles } from './files.js';
import { LANG_META } from '../../i18n/index.js';

/** Admin: read every conversation (read-only) and remove a message. Admins cannot write inside other people's chats. */
export default function AdminChats() {
  const { t, i18n } = useTranslation();
  const [chats, setChats] = useState(null);
  const [open, setOpen] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const dlg = useRef(null);
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

  const loadList = useCallback(async () => {
    try { setChats(await adminListChats()); } catch (e) { setChats([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  useEffect(() => { loadList(); }, [loadList]);
  // Files older than 90 days can no longer be read; delete them for good whenever an admin opens this tab.
  useEffect(() => { adminExpiredFiles().then((rows) => (rows.length ? removeFiles(rows.map((r) => r.name)).then(() => setMsg({ ok: true, text: t('chat.admin.cleaned', { count: rows.length }) })) : null)).catch(() => {}); }, [t]);
  const loadMsgs = useCallback(async (c) => {
    try { setMsgs(await adminChatMessages(c.conversation_id)); } catch (e) { setMsgs([]); setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
  }, [t]);
  const read = (c) => { setOpen(c); setMsgs(null); setMsg(null); loadMsgs(c); };
  const remove = async () => {
    const p = pending;
    dlg.current?.close();
    try {
      await adminRemoveMessage(p.id);
      if (p.file_path) await removeFiles([p.file_path]).catch(() => {}); // the file goes too
      setMsg({ ok: true, text: t('chat.admin.removedMsg') }); } catch (e) { setMsg({ ok: false, text: t(`classes.errors.${e.code}`) }); }
    await loadMsgs(open); await loadList();
  };

  return (
    <section className="card stack-sm" aria-labelledby="ac-h" data-testid="admin-chats">
      <h2 id="ac-h" className="h-md"><Eye size={20} aria-hidden="true" /> {t('chat.admin.title')}</h2>
      <p className="muted">{t('chat.admin.subtitle')}</p>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="chats-msg">{msg.text}</p>}
      {chats === null && <p className="muted">{t('app.loading')}</p>}
      {chats && chats.length === 0 && <p className="muted">{t('chat.admin.empty')}</p>}
      {chats && chats.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th scope="col">{t('chat.admin.colPeople')}</th><th scope="col">{t('chat.admin.colCount')}</th><th scope="col">{t('chat.admin.colLast')}</th><th scope="col"><span className="sr-only">{t('chat.admin.read')}</span></th></tr></thead>
            <tbody>
              {chats.map((c) => (
                <tr key={c.conversation_id} data-testid="admin-chat-row" className={open?.conversation_id === c.conversation_id ? 'is-open' : ''}>
                  <th scope="row"><bdi>{c.a_name}</bdi> ↔ <bdi>{c.b_name}</bdi><small className="muted" dir="ltr"><br />{c.a_email} · {c.b_email}</small></th>
                  <td>{Number(c.message_count)}</td>
                  <td>{fmt(c.last_at)}</td>
                  <td><Button variant="secondary" size="sm" onClick={() => read(c)} data-testid="admin-chat-read">{t('chat.admin.read')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="admin-transcript" data-testid="admin-transcript" role="region" aria-label={t('chat.admin.transcript', { a: open.a_name, b: open.b_name })}>
          <h3 className="h-xs"><bdi>{open.a_name}</bdi> ↔ <bdi>{open.b_name}</bdi> <Chip>{t('chat.admin.readOnly')}</Chip></h3>
          {msgs === null && <p className="muted">{t('app.loading')}</p>}
          {msgs && msgs.length === 0 && <p className="muted">{t('chat.noMessages')}</p>}
          <ul className="transcript">
            {(msgs || []).map((m) => (
              <li key={m.id} className={m.removed ? 'removed' : ''} data-testid="admin-msg-row">
                <span className="muted small">{fmt(m.created_at)} · <bdi>{m.sender_name}</bdi></span>
                {m.kind && m.kind !== 'text' && !m.removed && <ChatFile m={m} />}
                <p><bdi>{m.body}</bdi>{m.removed && <Chip>{t('chat.admin.wasRemoved')}</Chip>}</p>
                {!m.removed && <Button variant="ghost" size="sm" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => { setPending(m); dlg.current?.showModal(); }} data-testid="admin-msg-remove">{t('chat.admin.remove')}</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dialog ref={dlg} className="dialog" aria-labelledby="ac-t" data-testid="chat-remove-confirm">
        <h2 id="ac-t">{t('chat.admin.removeTitle')}</h2>
        <p>{t('chat.admin.removeText')}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button onClick={remove} data-testid="chat-remove-yes">{t('common.confirm')}</Button>
        </div>
      </dialog>
    </section>
  );
}
