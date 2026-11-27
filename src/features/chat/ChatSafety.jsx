import '../../i18n/pages.js';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, Ban, CircleCheck } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import { reportChat, blockChat, unblockChat } from '../classes/api.js';

export const REPORT_REASONS = ['harassment', 'sexual', 'hate', 'violence', 'spam', 'other'];
export const SUPPORT_EMAIL = 'mohleyla.support@gmail.com';

/** Report and block for one chat (required by both app stores). `ref.current.report(message)` opens the report for one message. */
const ChatSafety = forwardRef(function ChatSafety({ conv, other, onChanged }, ref) {
  const { t } = useTranslation();
  const reportDlg = useRef(null);
  const blockDlg = useRef(null);
  const [message, setMessage] = useState(null);
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { ok, text }

  const openReport = (m) => { setMessage(m || null); setReason('harassment'); setDetails(''); setNote(null); reportDlg.current?.showModal(); };
  useImperativeHandle(ref, () => ({ report: openReport }));
  const fail = (e) => setNote({ ok: false, text: t(`classes.errors.${e.code || 'failed'}`) });

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await reportChat({ conv, message: message?.id, reason, details: details.trim() }); reportDlg.current?.close(); setNote({ ok: true, text: t('safety.sent') }); }
    catch (ex) { reportDlg.current?.close(); fail(ex); }
    setBusy(false);
  };
  const toggleBlock = async (block) => {
    blockDlg.current?.close();
    setBusy(true); setNote(null);
    try { await (block ? blockChat(conv) : unblockChat(conv)); await onChanged(); } catch (ex) { fail(ex); }
    setBusy(false);
  };

  return (
    <div className="chat-safety">
      <div className="btn-row">
        <Button variant="ghost" size="sm" icon={<Flag size={16} aria-hidden="true" />} onClick={() => openReport(null)} data-testid="chat-report">{t('safety.report')}</Button>
        {other?.blocked_by_me
          ? <Button variant="secondary" size="sm" icon={<CircleCheck size={16} aria-hidden="true" />} disabled={busy} onClick={() => toggleBlock(false)} data-testid="chat-unblock">{t('safety.unblock')}</Button>
          : <Button variant="ghost" size="sm" icon={<Ban size={16} aria-hidden="true" />} disabled={busy} onClick={() => blockDlg.current?.showModal()} data-testid="chat-block">{t('safety.block')}</Button>}
      </div>
      {other?.blocked && <p className="note-small" role="status" data-testid="chat-blocked">{t(other.blocked_by_me ? 'safety.youBlocked' : 'safety.isBlocked')}</p>}
      {note && <p className={note.ok ? 'ok-text' : 'err-text'} role={note.ok ? 'status' : 'alert'} data-testid="safety-note">{note.text}</p>}
      <dialog ref={reportDlg} className="dialog" aria-labelledby="rp-t" data-testid="report-dialog">
        <h2 id="rp-t">{t(message ? 'safety.reportMessage' : 'safety.reportTitle')}</h2>
        <p>{t('safety.reportText')}</p>
        {message?.body && <blockquote className="muted"><bdi>{message.body}</bdi></blockquote>}
        <form className="stack-sm" onSubmit={send}>
          <label className="field"><span>{t('safety.reason')}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} data-testid="report-reason">{REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`safety.reasons.${r}`)}</option>)}</select></label>
          <label className="field"><span>{t('safety.details')}</span>
            <textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} data-testid="report-details" /></label>
          <p className="note-small">{t('safety.urgent')} <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">{SUPPORT_EMAIL}</a></p>
          <div className="btn-row">
            <Button variant="ghost" onClick={() => reportDlg.current?.close()}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy} data-testid="report-send">{t('safety.send')}</Button>
          </div>
        </form>
      </dialog>
      <dialog ref={blockDlg} className="dialog" aria-labelledby="bl-t" data-testid="block-dialog">
        <h2 id="bl-t">{t('safety.blockTitle')}</h2>
        <p>{t('safety.blockText')}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => blockDlg.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => toggleBlock(true)} data-testid="block-yes">{t('safety.block')}</Button>
        </div>
      </dialog>
    </div>
  );
});
export default ChatSafety;
