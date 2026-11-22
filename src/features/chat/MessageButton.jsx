import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { startChat } from '../classes/api.js';

/** Opens (or starts) the private chat with this person. Allowed by the database only for admins (anyone) and teachers (their own students). */
export default function MessageButton({ userId, name, testId = 'message-user' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true); setFailed(false);
    try { navigate(`/chat/${await startChat(userId)}`); } catch { setFailed(true); }
    setBusy(false);
  };
  return (
    <>
      <button type="button" className="icon-btn" onClick={go} disabled={busy} aria-label={`${t('chat.messageUser')}: ${name}`} title={t('chat.messageUser')} data-testid={testId}><MessageCircle size={20} aria-hidden="true" /></button>
      {failed && <span className="err-text small" role="alert">{t('chat.errors.start')}</span>}
    </>
  );
}
