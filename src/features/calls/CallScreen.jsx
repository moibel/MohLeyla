import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';
import { CallSession } from './webrtc.js';
import { closeCall } from './useCalls.js';
import { fmtDuration } from '../chat/ChatFile.jsx';

/** Full-screen voice or video call. Starts the connection when it opens and hangs up when it closes. */
export default function CallScreen({ call, factory }) {
  const { t } = useTranslation();
  const [st, setSt] = useState({ phase: 'starting', error: null, muted: false, cameraOff: false, local: null, remote: null, startedAt: null });
  const [now, setNow] = useState(Date.now());
  const session = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const dlg = useRef(null);

  useEffect(() => {
    const s = (factory || ((c, onChange) => new CallSession({ callId: c.callId, media: c.media, isCaller: c.isCaller, onChange })))(call, setSt);
    session.current = s;
    s.start();
    return () => { s.hangup?.(); };
    // one session per call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.callId]);
  useEffect(() => { const d = dlg.current; if (d && !d.open) d.showModal(); }, []);
  useEffect(() => { if (localRef.current && st.local) localRef.current.srcObject = st.local; }, [st.local]);
  useEffect(() => { if (remoteRef.current && st.remote) remoteRef.current.srcObject = st.remote; }, [st.remote]);
  useEffect(() => { if (st.phase !== 'connected') return undefined; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [st.phase]);
  useEffect(() => { if (st.phase === 'ended' || st.phase === 'failed') { const id = setTimeout(() => closeCall(), st.phase === 'failed' || st.error ? 4000 : 1200); return () => clearTimeout(id); } return undefined; }, [st.phase, st.error]);

  const video = call.media === 'video';
  const status = st.phase === 'failed' || (st.phase === 'ended' && st.error) ? t(`calls.errors.${st.error || 'connection'}`)
    : st.phase === 'ended' ? t('calls.ended')
    : st.phase === 'connected' ? fmtDuration(now - (st.startedAt || now))
    : st.phase === 'ringing' ? t('calls.calling') : t('calls.connecting');
  const finished = st.phase === 'ended' || st.phase === 'failed';

  return (
    <dialog ref={dlg} className="call-screen" aria-label={t(video ? 'calls.videoCall' : 'calls.voiceCall')} onCancel={(e) => e.preventDefault()} data-testid="call-screen" data-phase={st.phase}>
      <div className="call-stage">
        {video && st.remote ? <video ref={remoteRef} className="call-remote" autoPlay playsInline data-testid="remote-video" /> : (
          <div className="call-avatar"><Avatar profile={{ name: call.name, email: call.otherId || call.name }} size={120} /><audio ref={remoteRef} autoPlay data-testid="remote-audio" /></div>
        )}
        {video && st.local && <video ref={localRef} className={`call-local ${st.cameraOff ? 'off' : ''}`} autoPlay playsInline muted data-testid="local-video" />}
      </div>
      <div className="call-info">
        <h2 className="call-name"><bdi>{call.name}</bdi></h2>
        <p className="call-status" role="status" data-testid="call-status">{status}</p>
      </div>
      <div className="call-controls">
        <button type="button" className={`call-btn ${st.muted ? 'on' : ''}`} onClick={() => session.current?.setMuted(!st.muted)} aria-pressed={st.muted} aria-label={t(st.muted ? 'calls.unmute' : 'calls.mute')} disabled={finished || !st.local} data-testid="call-mute">
          {st.muted ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
        </button>
        {video && (
          <button type="button" className={`call-btn ${st.cameraOff ? 'on' : ''}`} onClick={() => session.current?.setCameraOff(!st.cameraOff)} aria-pressed={st.cameraOff} aria-label={t(st.cameraOff ? 'calls.cameraOn' : 'calls.cameraOff')} disabled={finished || !st.local} data-testid="call-camera">
            {st.cameraOff ? <VideoOff size={24} aria-hidden="true" /> : <Video size={24} aria-hidden="true" />}
          </button>
        )}
        <button type="button" className="call-btn hang" onClick={() => session.current?.hangup()} aria-label={t('calls.hangUp')} disabled={finished} data-testid="call-hangup"><PhoneOff size={26} aria-hidden="true" /></button>
      </div>
      {finished && <div className="call-done"><Button onClick={() => closeCall()} data-testid="call-close">{t('common.close')}</Button></div>}
    </dialog>
  );
}
