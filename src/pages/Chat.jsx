import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Send, ShieldCheck, MessageCircle } from 'lucide-react';
import { PageHeading, Button, Chip, EmptyState, Flip } from '../components/ui.jsx';
import Avatar from '../components/Avatar.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { myChats, chatMessages, sendMessage, markChatRead } from '../features/classes/api.js';
import { refreshChatUnread } from '../features/chat/unread.js';
import { LANG_META } from '../i18n/index.js';

const MAX = 1000;
const useVisibleInterval = (fn, ms, deps) => {
  useEffect(() => {
    fn();
    const id = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
    const wake = () => fn();
    window.addEventListener('focus', wake);
    return () => { clearInterval(id); window.removeEventListener('focus', wake); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

function PrivacyNote() {
  const { t } = useTranslation();
  return <p className="chat-privacy" data-testid="chat-privacy"><ShieldCheck size={16} aria-hidden="true" /> {t('chat.privacy')}</p>;
}

function ChatList() {
  const { t, i18n } = useTranslation();
  const [chats, setChats] = useState(null);
  const [error, setError] = useState(false);
  useVisibleInterval(async () => {
    try { setChats(await myChats()); setError(false); } catch { setError(true); setChats((c) => c || []); }
  }, 15000, []);
  const time = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  return (
    <div className="page narrow" data-testid="chat-list-page">
      <PageHeading title={t('chat.title')} subtitle={t('chat.subtitle')} />
      <PrivacyNote />
      {error && <p className="err-text" role="alert">{t('chat.loadFailed')}</p>}
      {chats === null && <p className="muted">{t('app.loading')}</p>}
      {chats && chats.length === 0 && <EmptyState icon={<MessageCircle size={44} />} title={t('chat.emptyTitle')} text={t('chat.emptyText')} />}
      {chats && chats.length > 0 && (
        <ul className="chat-list">
          {chats.map((c) => (
            <li key={c.conversation_id}>
              <Link to={`/chat/${c.conversation_id}`} className={`chat-row ${c.unread > 0 ? 'unread' : ''}`} data-testid="chat-row">
                <Avatar profile={{ name: c.other_name, email: c.other_id }} size={44} />
                <span className="chat-row-main">
                  <span className="chat-row-top"><strong><bdi>{c.other_name}</bdi></strong><Chip>{t(`admin.roles.${c.other_role}`)}</Chip></span>
                  <span className="chat-preview muted"><bdi>{c.last_body ? `${c.last_is_mine ? `${t('chat.you')}: ` : ''}${c.last_body}` : t('chat.noMessages')}</bdi></span>
                </span>
                <span className="chat-row-side"><small className="muted">{time(c.last_at)}</small>{c.unread > 0 && <span className="count-badge" data-testid="chat-unread" aria-label={t('chat.unreadCount', { count: c.unread })}>{c.unread}</span>}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thread({ id }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState(null);
  const [other, setOther] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);
  const nearBottom = useRef(true);
  const listRef = useRef(null);
  const Arrow = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;

  const load = useCallback(async () => {
    try {
      const rows = await chatMessages(id);
      setMsgs(rows);
      if (rows.some((m) => !m.mine)) { await markChatRead(id); refreshChatUnread(); }
      setErr((e) => (e === 'load' ? null : e));
    } catch (e) { if (e.code === 'notAllowed') navigate('/chat', { replace: true }); else { setMsgs((m) => m || []); setErr('load'); } }
  }, [id, navigate]);
  useVisibleInterval(load, 4000, [id]);
  useEffect(() => { myChats().then((cs) => setOther(cs.find((c) => c.conversation_id === id) || null)).catch(() => {}); }, [id]);
  useEffect(() => { if (nearBottom.current) endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const onScroll = () => { const el = listRef.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    try { await sendMessage(id, body); setText(''); nearBottom.current = true; await load(); }
    catch (ex) { setErr(ex.code === 'slowDown' ? 'slowDown' : ex.code === 'network' ? 'network' : 'send'); }
    setBusy(false);
  };
  const time = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { timeStyle: 'short' }).format(new Date(d));
  const day = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d));

  return (
    <div className="page narrow chat-page" data-testid="chat-thread-page">
      <Link to="/chat" className="back-link"><Flip><Arrow size={18} /></Flip> {t('chat.title')}</Link>
      <header className="chat-head">
        {other && <Avatar profile={{ name: other.other_name, email: other.other_id }} size={44} />}
        <div><h1 className="chat-name"><bdi>{other?.other_name || '…'}</bdi></h1>{other && <Chip>{t(`admin.roles.${other.other_role}`)}</Chip>}</div>
      </header>
      <PrivacyNote />
      <div className="chat-scroll card" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label={t('chat.messages')} data-testid="chat-log">
        {msgs === null && <p className="muted">{t('app.loading')}</p>}
        {msgs && msgs.length === 0 && <p className="muted center">{t('chat.noMessages')}</p>}
        {msgs && msgs.map((m, i) => (
          <div key={m.id}>
            {(i === 0 || day(msgs[i - 1].created_at) !== day(m.created_at)) && <p className="chat-day">{day(m.created_at)}</p>}
            <div className={`bubble-msg ${m.mine ? 'mine' : 'theirs'} ${m.removed ? 'removed' : ''}`} data-testid="chat-msg">
              <p className="bubble-text">{m.removed ? <em>{t('chat.removed')}</em> : <bdi>{m.body}</bdi>}</p>
              <small className="bubble-time">{time(m.created_at)}</small>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-input">{t('chat.write')}</label>
        <textarea id="chat-input" rows={2} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.write')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} data-testid="chat-input" />
        <Button type="submit" disabled={busy || !text.trim()} icon={<Send size={18} aria-hidden="true" />} data-testid="chat-send">{t('chat.send')}</Button>
      </form>
      <p className="note-small"><span data-testid="chat-count">{text.length}/{MAX}</span> · {t('chat.enterHint')}</p>
      {err && <p className="err-text" role="alert" data-testid="chat-error">{t(`chat.errors.${err}`)}</p>}
    </div>
  );
}

export default function Chat() {
  const { t } = useTranslation();
  const { id } = useParams();
  return <RequireAccount title={t('chat.title')}>{id ? <Thread key={id} id={id} /> : <ChatList />}</RequireAccount>;
}
