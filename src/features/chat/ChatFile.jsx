import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Image as ImageIcon, Clock, X } from 'lucide-react';
import { fileUrl } from './files.js';

export const fmtDuration = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** A voice note (audio player) or a photo (thumbnail that opens full size) inside a chat bubble. Files are fetched with a short-lived private link. */
export default function ChatFile({ m }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const dlg = useRef(null);

  useEffect(() => {
    let alive = true;
    setUrl(null); setFailed(false);
    if (m.file_path && !m.expired) fileUrl(m.file_path).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [m.file_path, m.expired]);

  if (m.expired) return <p className="file-note" data-testid="file-expired"><Clock size={16} aria-hidden="true" /> {t('chat.fileExpired')}</p>;
  if (failed) return <p className="file-note" data-testid="file-failed">{t('chat.fileFailed')}</p>;
  if (m.kind === 'voice') {
    return (
      <div className="voice-note" data-testid="voice-note">
        <Mic size={18} aria-hidden="true" />
        {url ? <audio controls preload="metadata" src={url} aria-label={t('chat.voiceNote')} data-testid="voice-audio" /> : <span className="muted small">{t('app.loading')}</span>}
        <small className="muted">{fmtDuration(m.duration_ms)}</small>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="photo-btn" onClick={() => dlg.current?.showModal()} aria-label={t('chat.openPhoto')} data-testid="photo-open">
        {url ? <img src={url} alt={t('chat.photo')} loading="lazy" data-testid="photo-img" /> : <span className="photo-ph"><ImageIcon size={28} aria-hidden="true" /></span>}
      </button>
      <dialog ref={dlg} className="photo-dialog" aria-label={t('chat.photo')} onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
        {url && <img src={url} alt={t('chat.photo')} />}
        <button type="button" className="icon-btn photo-close" onClick={() => dlg.current?.close()} aria-label={t('common.close')}><X size={22} aria-hidden="true" /></button>
      </dialog>
    </>
  );
}
