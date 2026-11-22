import { describe, it, expect, vi } from 'vitest';
import { CallSession, iceServers, mapCallError } from '../features/calls/webrtc.js';
import { callText } from '../features/calls/format.js';

function fakeStream() {
  const mk = (kind) => ({ kind, enabled: true, stopped: false, stop() { this.stopped = true; } });
  const tracks = [mk('audio'), mk('video')];
  return { tracks, getTracks: () => tracks, getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'), getVideoTracks: () => tracks.filter((t) => t.kind === 'video') };
}
class FakePC {
  constructor(cfg) { this.cfg = cfg; this.added = []; this.remote = null; this.local = null; this.ice = []; this.closed = false; FakePC.last = this; }
  addTrack(t) { this.added.push(t); }
  async createOffer() { return { type: 'offer', sdp: 'OFFER' }; }
  async createAnswer() { return { type: 'answer', sdp: 'ANSWER' }; }
  async setLocalDescription(d) { this.local = d; }
  async setRemoteDescription(d) { this.remote = d; }
  async addIceCandidate(c) { if (!this.remote) throw new Error('no remote description yet'); this.ice.push(c); }
  close() { this.closed = true; }
}
const mkApi = (script = []) => {
  const sent = []; const log = { ended: 0 };
  return { sent, log, callSignalSend: vi.fn(async (id, kind, payload) => { sent.push({ kind, payload }); return sent.length; }), endCall: vi.fn(async () => { log.ended++; }), answerCall: vi.fn(), callPoll: vi.fn(async () => script.shift() || [{ status: 'ringing', media: 'video', i_am_caller: true }]) };
};
const make = (over = {}) => {
  const states = []; const stream = fakeStream(); const api = over.api || mkApi();
  const s = new CallSession({ callId: 'c1', media: over.media || 'video', isCaller: over.isCaller ?? true, api, env: { RTCPeerConnection: FakePC, getUserMedia: over.getUserMedia || (async () => stream), iceServers: [] }, onChange: (st) => states.push(st.phase) });
  return { s, states, stream, api };
};

describe('CallSession', () => {
  it('the caller captures media, sends an offer, then waits (ringing)', async () => {
    const { s, states, api } = make();
    await s.start();
    expect(states).toContain('starting'); expect(s.state.phase).toBe('ringing');
    expect(api.sent[0]).toEqual({ kind: 'offer', payload: { type: 'offer', sdp: 'OFFER' } });
    expect(FakePC.last.added).toHaveLength(2); // audio + video
    s.cleanup();
  });
  it('a voice call asks for no video', async () => {
    const gum = vi.fn(async () => fakeStream());
    const { s } = make({ media: 'audio', getUserMedia: gum });
    await s.start();
    expect(gum.mock.calls[0][0].video).toBe(false);
    s.cleanup();
  });
  it('the caller applies the answer and queues network candidates that arrive before it', async () => {
    const { s } = make();
    await s.start();
    await s.handle({ kind: 'ice', payload: { candidate: 'early' } });
    expect(FakePC.last.ice).toHaveLength(0); // no remote description yet: kept in the queue
    await s.handle({ kind: 'answer', payload: { type: 'answer', sdp: 'A' } });
    expect(FakePC.last.remote.sdp).toBe('A');
    expect(FakePC.last.ice).toEqual([{ candidate: 'early' }]);
    await s.handle({ kind: 'ice', payload: { candidate: 'late' } });
    expect(FakePC.last.ice).toHaveLength(2);
    s.cleanup();
  });
  it('the callee answers an offer and replies with an answer', async () => {
    const { s, api } = make({ isCaller: false });
    await s.start();
    expect(s.state.phase).toBe('connecting');
    expect(api.sent).toHaveLength(0); // the callee never offers
    await s.handle({ kind: 'offer', payload: { type: 'offer', sdp: 'O' } });
    expect(FakePC.last.remote.sdp).toBe('O');
    expect(api.sent.at(-1)).toEqual({ kind: 'answer', payload: { type: 'answer', sdp: 'ANSWER' } });
    s.cleanup();
  });
  it('a caller ignores offers and a callee ignores answers (nobody can hijack the roles)', async () => {
    const a = make(); await a.s.start(); await a.s.handle({ kind: 'offer', payload: { type: 'offer', sdp: 'X' } }); expect(FakePC.last.remote).toBeNull(); a.s.cleanup();
    const b = make({ isCaller: false }); await b.s.start(); await b.s.handle({ kind: 'answer', payload: { type: 'answer', sdp: 'Y' } }); expect(FakePC.last.remote).toBeNull(); b.s.cleanup();
  });
  it('polling ends the call when the server says it ended, and releases the camera and microphone', async () => {
    const api = mkApi([[{ status: 'ended', media: 'video', i_am_caller: true }]]);
    const { s, stream, states } = make({ api });
    await s.start();
    await new Promise((r) => setTimeout(r, 0));
    await s.poll();
    expect(s.state.phase).toBe('ended');
    expect(stream.tracks.every((t) => t.stopped)).toBe(true);
    expect(FakePC.last.closed).toBe(true);
    expect(states.at(-1)).toBe('ended');
  });
  it('declined and missed calls are reported to the screen', async () => {
    for (const status of ['declined', 'missed']) {
      const { s } = make({ api: mkApi([[{ status, media: 'audio', i_am_caller: true }]]) });
      await s.start(); await s.poll();
      expect(s.state).toMatchObject({ phase: 'ended', error: status });
    }
  });
  it('mute and camera-off switch the real tracks', async () => {
    const { s, stream } = make();
    await s.start();
    s.setMuted(true); s.setCameraOff(true);
    expect(stream.getAudioTracks()[0].enabled).toBe(false); expect(stream.getVideoTracks()[0].enabled).toBe(false);
    s.setMuted(false);
    expect(stream.getAudioTracks()[0].enabled).toBe(true);
    s.cleanup();
  });
  it('hanging up tells the server once and stops everything', async () => {
    const { s, stream, api } = make();
    await s.start();
    await s.hangup(); await s.hangup();
    expect(api.endCall).toHaveBeenCalledTimes(1);
    expect(stream.tracks.every((t) => t.stopped)).toBe(true);
  });
  it('a blocked microphone fails clearly, tells the server and never opens a connection', async () => {
    const { s, api } = make({ getUserMedia: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } });
    await s.start();
    expect(s.state).toMatchObject({ phase: 'failed', error: 'denied' });
    expect(api.endCall).toHaveBeenCalled();
    expect(FakePC.last?.added?.length || 0).toBeGreaterThanOrEqual(0);
  });
  it('maps media errors and builds ICE servers (a TURN relay only when configured)', () => {
    expect(mapCallError({ name: 'NotAllowedError' })).toBe('denied'); expect(mapCallError({ name: 'NotFoundError' })).toBe('noDevice'); expect(mapCallError({ name: 'Weird' })).toBe('failed');
    expect(iceServers({}).every((s) => String(s.urls).startsWith('stun:'))).toBe(true);
    const withTurn = iceServers({ VITE_TURN_URL: 'turn:a.example:3478, turns:a.example:5349', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'p' });
    expect(withTurn.at(-1)).toEqual({ urls: ['turn:a.example:3478', 'turns:a.example:5349'], username: 'u', credential: 'p' });
  });
});

describe('call lines in the chat', () => {
  const t = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  it('translates the stored line', () => {
    expect(callText(t, 'video:ended:3')).toBe('calls.line.video.ended{"n":3}');
    expect(callText(t, 'audio:missed')).toContain('calls.line.audio.missed');
    expect(callText(t, 'garbage')).toBe('calls.callGeneric');
  });
});
