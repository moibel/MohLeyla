import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Send, ShieldCheck, MessageCircle, Mic, ImagePlus, Square, X, Trash2 } from 'lucide-react';
import { PageHeading, Button, Chip, EmptyState, Flip } from '../components/ui.jsx';
import Avatar from '../components/Avatar.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { myChats, chatMessages, sendMessage, markChatRead, sendAttachment } from '../features/classes/api.js';
import ChatFile, { fmtDuration } from '../features/chat/ChatFile.jsx';
import { uploadChatFile, shrinkImage, audioFormat, MAX_VOICE_MS, FileError } from '../features/chat/files.js';
import { Recorder } from '../features/speaking/recorder.js';
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
  // today: just the time; otherwise the date
  const time = (d) => { const x = new Date(d); const same = x.toDateString() === new Date().toDateString(); return new Intl.DateTimeFormat(LANG_META[i18n.language].locale, same ? { timeStyle: 'short' } : { dateStyle: 'medium' }).format(x); };
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
                  <span className="chat-preview muted"><bdi>{c.last_kind === 'voice' || c.last_kind === 'image' ? `${c.last_is_mine ? `${t('chat.you')}: ` : ''}${t(c.last_kind === 'voice' ? 'chat.voiceNote' : 'chat.photo')}${c.last_body ? ` · ${c.last_body}` : ''}` : c.last_body ? `${c.last_is_mine ? `${t('chat.you')}: ` : ''}${c.last_body}` : t('chat.noMessages')}</bdi></span>
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
  const [pending, setPending] = useState(null); // an attachment ready to send: { kind, blob, mime, ext, url, durationMs }
  const [recording, setRecording] = useState(null); // { startedAt }
  const [secs, setSecs] = useState(0);
  const recRef = useRef(null);
  const fileRef = useRef(null);
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
  const clearPending = () => { if (pending?.url) URL.revokeObjectURL(pending.url); setPending(null); };
  useEffect(() => () => { recRef.current?.cancel(); }, []);
  useEffect(() => { if (!recording) return undefined; const iv = setInterval(() => setSecs(Math.floor((Date.now() - recording.startedAt) / 1000)), 250); return () => clearInterval(iv); }, [recording]);
  const failWith = (ex) => setErr(ex.code === 'slowDown' ? 'slowDown' : ex.code === 'network' ? 'network' : ex.code === 'tooBig' ? 'tooBig' : ex.code === 'badType' ? 'badType' : ex.code === 'denied' ? 'micDenied' : ex.code === 'noMic' ? 'noMic' : ex.code === 'unsupported' ? 'micUnsupported' : ex.code === 'tooShort' ? 'tooShort' : ex.code === 'upload' ? 'upload' : 'send');

  const startRecording = async () => {
    setErr(null);
    if (pending) clearPending();
    const rec = new Recorder({ maxMs: MAX_VOICE_MS });
    recRef.current = rec;
    rec.onAutoStop = () => stopRecording();
    try { await rec.start(); setSecs(0); setRecording({ startedAt: Date.now() }); } catch (ex) { recRef.current = null; failWith(ex); }
  };
  const stopRecording = async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setRecording(null);
    try {
      const out = await rec.stop();
      const fmt = audioFormat(out.blob.type);
      if (!fmt) { URL.revokeObjectURL(out.url); throw new FileError('badType'); }
      setPending({ kind: 'voice', blob: out.blob, mime: fmt.mime, ext: fmt.ext, url: out.url, durationMs: out.durationMs });
    } catch (ex) { failWith(ex); }
  };
  const cancelRecording = () => { recRef.current?.cancel(); recRef.current = null; setRecording(null); };
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);
    try {
      const out = await shrinkImage(file);
      if (pending) clearPending();
      setPending({ kind: 'image', blob: out.blob, mime: out.mime, ext: out.ext, url: URL.createObjectURL(out.blob) });
    } catch (ex) { failWith(ex); }
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !pending) || busy) return;
    setBusy(true); setErr(null);
    try {
      if (pending) {
        const path = await uploadChatFile(id, pending.blob, pending);
        await sendAttachment({ conv: id, kind: pending.kind, path, mime: pending.mime, size: pending.blob.size, durationMs: pending.durationMs, caption: body });
        clearPending();
      } else {
        await sendMessage(id, body);
      }
      setText(''); nearBottom.current = true; await load();
    } catch (ex) { failWith(ex); }
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
              {!m.removed && m.kind && m.kind !== 'text' && <ChatFile m={m} />}
              {(m.removed || m.body) && <p className="bubble-text">{m.removed ? <em>{t('chat.removed')}</em> : <bdi>{m.body}</bdi>}</p>}
              <small className="bubble-time">{time(m.created_at)}</small>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {recording && (
        <div className="rec-bar" role="status" data-testid="rec-bar">
          <span className="rec-dot" aria-hidden="true" /> <strong>{t('chat.recording')}</strong> <span data-testid="rec-time">{fmtDuration(secs * 1000)}</span>
          <span className="rec-actions">
            <Button variant="ghost" size="sm" onClick={cancelRecording} icon={<X size={16} aria-hidden="true" />} data-testid="rec-cancel">{t('common.cancel')}</Button>
            <Button size="sm" onClick={stopRecording} icon={<Square size={14} aria-hidden="true" />} data-testid="rec-stop">{t('chat.stopRecording')}</Button>
          </span>
        </div>
      )}
      {pending && (
        <div className="pending-file" data-testid="pending-file">
          {pending.kind === 'image' ? <img src={pending.url} alt={t('chat.photo')} /> : <><Mic size={18} aria-hidden="true" /><audio controls src={pending.url} aria-label={t('chat.voiceNote')} /><small className="muted">{fmtDuration(pending.durationMs)}</small></>}
          <button type="button" className="icon-btn" onClick={clearPending} aria-label={t('chat.discardFile')} data-testid="pending-discard"><Trash2 size={18} aria-hidden="true" /></button>
        </div>
      )}
      <form className="chat-form" onSubmit={send}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={pickPhoto} data-testid="photo-input" aria-label={t('chat.attachPhoto')} />
        <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} disabled={busy || !!recording} aria-label={t('chat.attachPhoto')} title={t('chat.attachPhoto')} data-testid="attach-photo"><ImagePlus size={22} aria-hidden="true" /></button>
        <button type="button" className="icon-btn" onClick={startRecording} disabled={busy || !!recording} aria-label={t('chat.recordVoice')} title={t('chat.recordVoice')} data-testid="record-voice"><Mic size={22} aria-hidden="true" /></button>
        <label className="sr-only" htmlFor="chat-input">{t('chat.write')}</label>
        <textarea id="chat-input" rows={2} maxLength={pending ? 200 : MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={pending ? t('chat.captionPlaceholder') : t('chat.write')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} data-testid="chat-input" />
        <Button type="submit" disabled={busy || !!recording || (!text.trim() && !pending)} icon={<Send size={18} aria-hidden="true" />} data-testid="chat-send">{t('chat.send')}</Button>
      </form>
      <p className="note-small"><span data-testid="chat-count">{text.length}/{pending ? 200 : MAX}</span> · {t('chat.enterHint')} · {t('chat.attachNote')}</p>
      {err && <p className="err-text" role="alert" data-testid="chat-error">{t(`chat.errors.${err}`)}</p>}
    </div>
  );
}

export default function Chat() {
  const { t } = useTranslation();
  const { id } = useParams();
  return <RequireAccount title={t('chat.title')}>{id ? <Thread key={id} id={id} /> : <ChatList />}</RequireAccount>;
}
