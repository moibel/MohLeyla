import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';
import { answerCall, endCall } from '../classes/api.js';
import { openCall, dismissIncoming } from './useCalls.js';
import { play, stopWaiting } from '../announcements/sfx.js';
import { useProgress } from '../../app/ProgressContext.jsx';

/** A call is ringing: answer or decline. The ring repeats every two seconds while it rings (unless sound effects are off in Settings). */
export default function IncomingCall({ call }) {
  const { t } = useTranslation();
  const { state } = useProgress();
  const dlg = useRef(null);
  const sound = state.settings.sfx !== 'off';
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    if (!sound) return undefined;
    play('ring');
    const id = setInterval(() => play('ring'), 2000);
    return () => { clearInterval(id); stopWaiting(); };
  }, [call.call_id, sound]);

  const accept = async () => {
    try { await answerCall(call.call_id); openCall({ callId: call.call_id, media: call.media, isCaller: false, name: call.caller_name, otherId: call.caller_id, conversationId: call.conversation_id }); }
    catch { dismissIncoming(call.call_id); }
  };
  const decline = async () => { dismissIncoming(call.call_id); await endCall(call.call_id).catch(() => {}); };
  const Icon = call.media === 'video' ? Video : Phone;
  return (
    <dialog ref={dlg} className="incoming-call" aria-labelledby="inc-t" onCancel={(e) => { e.preventDefault(); decline(); }} data-testid="incoming-call">
      <Avatar profile={{ name: call.caller_name, email: call.caller_id }} size={88} />
      <h2 id="inc-t" className="call-name"><bdi>{call.caller_name}</bdi></h2>
      <p className="call-status"><Icon size={18} aria-hidden="true" /> {t(call.media === 'video' ? 'calls.incomingVideo' : 'calls.incomingVoice')}</p>
      <div className="call-controls">
        <button type="button" className="call-btn hang" onClick={decline} aria-label={t('calls.decline')} data-testid="call-decline"><PhoneOff size={26} aria-hidden="true" /></button>
        <button type="button" className="call-btn accept" onClick={accept} aria-label={t('calls.accept')} data-testid="call-accept"><Icon size={26} aria-hidden="true" /></button>
      </div>
      <Button variant="ghost" onClick={decline}>{t('calls.decline')}</Button>
    </dialog>
  );
}
