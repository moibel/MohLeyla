// One voice or video call between two browsers (WebRTC). The audio/video goes directly between the two people's devices; the app server
// only passes the small connection messages (offer, answer, network candidates) and records the call state. Nothing is recorded.
import { callPoll, callSignalSend, endCall, answerCall } from '../classes/api.js';

export const POLL_MS = 800;
export const CONNECT_TIMEOUT_MS = 25000;

/** STUN is free and enough for most connections. A TURN relay (needed behind some strict networks) can be configured at build time. */
export function iceServers(env = (typeof import.meta !== 'undefined' ? import.meta.env : {})) {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  if (env && env.VITE_TURN_URL) servers.push({ urls: env.VITE_TURN_URL.split(',').map((s) => s.trim()).filter(Boolean), username: env.VITE_TURN_USERNAME || undefined, credential: env.VITE_TURN_CREDENTIAL || undefined });
  return servers;
}

export function mapCallError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'denied';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'noDevice';
  return 'failed';
}

/**
 * states: 'starting' -> 'ringing' (caller waiting) | 'connecting' -> 'connected' -> 'ended';  or 'failed' / 'ended'
 * The session talks to the server through `api` so tests can swap it.
 */
export class CallSession {
  constructor({ callId, media, isCaller, api, env = {}, onChange }) {
    this.callId = callId; this.media = media; this.isCaller = isCaller;
    this.api = api || { callPoll, callSignalSend, endCall, answerCall };
    const w = typeof window !== 'undefined' ? window : {};
    this.PC = env.RTCPeerConnection || w.RTCPeerConnection;
    this.getUserMedia = env.getUserMedia || (typeof navigator !== 'undefined' && navigator.mediaDevices ? (c) => navigator.mediaDevices.getUserMedia(c) : null);
    this.iceServers = env.iceServers || iceServers();
    this.onChange = onChange || (() => {});
    this.state = { phase: 'starting', error: null, muted: false, cameraOff: false, local: null, remote: null, startedAt: null };
    this.after = 0; this.pc = null; this.stream = null; this.timer = null; this.pending = []; this.haveRemote = false; this.closed = false; this.connectTimer = null; this.polling = false;
  }

  set(patch) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }

  async start() {
    if (!this.PC || !this.getUserMedia) { this.set({ phase: 'failed', error: 'unsupported' }); return this.cleanup(); }
    try {
      this.stream = await this.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: this.media === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false });
    } catch (e) { this.set({ phase: 'failed', error: mapCallError(e) }); await this.api.endCall(this.callId).catch(() => {}); return this.cleanup(); }
    if (this.closed) return this.cleanup();
    this.set({ local: this.stream });
    const pc = new this.PC({ iceServers: this.iceServers });
    this.pc = pc;
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));
    pc.ontrack = (ev) => { if (ev.streams && ev.streams[0]) this.set({ remote: ev.streams[0] }); };
    pc.onicecandidate = (ev) => { if (ev.candidate) this.api.callSignalSend(this.callId, 'ice', ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate).catch(() => {}); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { clearTimeout(this.connectTimer); this.set({ phase: 'connected', startedAt: this.state.startedAt || Date.now() }); }
      if (pc.connectionState === 'failed') this.fail('connection');
    };
    this.set({ phase: this.isCaller ? 'ringing' : 'connecting' });
    this.connectTimer = setTimeout(() => { if (this.state.phase !== 'connected') this.fail('connection'); }, this.isCaller ? 90000 : CONNECT_TIMEOUT_MS + 10000);
    if (this.isCaller) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.api.callSignalSend(this.callId, 'offer', { type: offer.type, sdp: offer.sdp });
      } catch { return this.fail('connection'); }
    }
    this.poll();
  }

  async poll() {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      const rows = await this.api.callPoll(this.callId, this.after);
      const head = rows[0];
      for (const r of rows) {
        if (r.signal_id == null) continue;
        this.after = Math.max(this.after, Number(r.signal_id));
        await this.handle(r);
      }
      if (head) {
        if (['ended', 'declined', 'missed'].includes(head.status)) { this.set({ phase: 'ended', error: head.status === 'declined' ? 'declined' : head.status === 'missed' ? 'missed' : null }); return this.cleanup(); }
        if (head.status === 'active' && this.isCaller && this.state.phase === 'ringing') this.set({ phase: 'connecting' });
      }
    } catch { /* a missed poll is fine: the next one catches up */ }
    this.polling = false;
    if (!this.closed) this.timer = setTimeout(() => this.poll(), POLL_MS);
  }

  async handle(sig) {
    const pc = this.pc;
    if (!pc) return;
    try {
      if (sig.kind === 'offer' && !this.isCaller) {
        await pc.setRemoteDescription(sig.payload);
        this.haveRemote = true;
        await this.flush();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.api.callSignalSend(this.callId, 'answer', { type: answer.type, sdp: answer.sdp });
      } else if (sig.kind === 'answer' && this.isCaller) {
        await pc.setRemoteDescription(sig.payload);
        this.haveRemote = true;
        await this.flush();
      } else if (sig.kind === 'ice') {
        if (this.haveRemote) await pc.addIceCandidate(sig.payload).catch(() => {});
        else this.pending.push(sig.payload);
      }
    } catch { this.fail('connection'); }
  }

  async flush() { for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c).catch(() => {}); }

  fail(error) { if (this.closed) return; this.set({ phase: 'failed', error }); this.api.endCall(this.callId).catch(() => {}); this.cleanup(); }

  setMuted(on) { this.stream?.getAudioTracks().forEach((t) => { t.enabled = !on; }); this.set({ muted: on }); }
  setCameraOff(on) { this.stream?.getVideoTracks().forEach((t) => { t.enabled = !on; }); this.set({ cameraOff: on }); }

  /** Hang up (or cancel / decline) on purpose. */
  async hangup() {
    if (this.closed) return;
    await this.api.endCall(this.callId).catch(() => {});
    this.set({ phase: 'ended' });
    this.cleanup();
  }

  cleanup() {
    this.closed = true;
    clearTimeout(this.timer); clearTimeout(this.connectTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.pc?.close(); } catch { /* already closed */ }
    this.pc = null; this.stream = null;
  }
}
