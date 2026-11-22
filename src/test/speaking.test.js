import { describe, it, expect, vi } from 'vitest';
import { Recorder, pickMimeType, mapMediaError, MAX_RECORD_MS } from '../features/speaking/recorder.js';
import { applySpeaking, emptyState, XP, ACHIEVEMENTS, unlockedAchievements, migrate } from '../features/progress/engine.js';

function makeEnv({ gum, types = ['audio/webm;codecs=opus'], size = 5, clock } = {}) {
  const tracks = [{ stop: vi.fn() }];
  const stream = { getTracks: () => tracks };
  let instance;
  class FakeMR {
    static isTypeSupported(t) { return types.includes(t); }
    constructor(s, opts) { this.state = 'inactive'; this.opts = opts; this.mimeType = (opts && opts.mimeType) || ''; instance = this; }
    start() { this.state = 'recording'; this.ondataavailable && this.ondataavailable({ data: { size, type: this.mimeType || 'audio/webm' } }); }
    stop() { this.state = 'inactive'; setTimeout(() => this.onstop && this.onstop(), 0); }
  }
  const timers = [];
  let now = 0;
  global.URL.createObjectURL = vi.fn(() => 'blob:fake');
  return {
    env: {
      MediaRecorder: FakeMR,
      getUserMedia: gum || (async () => stream),
      now: () => (clock ? clock() : now),
      setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      clearTimeout: () => {},
    },
    tracks, timers, advance: (ms) => { now += ms; }, get instance() { return instance; },
  };
}

describe('Recorder', () => {
  it('records, stops, releases the microphone and returns a clip', async () => {
    const h = makeEnv({ size: 0 });
    // Blob must be non-empty: override chunk size path via real Blob content
    const r = new Recorder({ ...h.env });
    await r.start();
    expect(r.recording).toBe(true);
    h.advance(1500);
    r.rec.ondataavailable({ data: new Blob(['abc'], { type: 'audio/webm' }) });
    const clip = await r.stop();
    expect(clip.url).toBe('blob:fake');
    expect(clip.durationMs).toBe(1500);
    expect(h.tracks[0].stop).toHaveBeenCalled();
    expect(r.recording).toBe(false);
  });
  it('rejects a clip that is too short', async () => {
    const h = makeEnv();
    const r = new Recorder(h.env);
    await r.start();
    r.rec.ondataavailable({ data: new Blob(['abc']) });
    h.advance(100);
    await expect(r.stop()).rejects.toMatchObject({ code: 'tooShort' });
    expect(h.tracks[0].stop).toHaveBeenCalled();
  });
  it('auto-stop timer is armed for the maximum duration', async () => {
    const h = makeEnv();
    const r = new Recorder(h.env);
    const onAuto = vi.fn();
    r.onAutoStop = onAuto;
    await r.start();
    expect(h.timers[0].ms).toBe(MAX_RECORD_MS);
    h.timers[0].fn();
    expect(onAuto).toHaveBeenCalled();
  });
  it('maps permission and device errors to translatable codes', async () => {
    for (const [name, code] of [['NotAllowedError', 'denied'], ['NotFoundError', 'noMic'], ['AbortError', 'failed']]) {
      const h = makeEnv({ gum: async () => { throw Object.assign(new Error('x'), { name }); } });
      await expect(new Recorder(h.env).start()).rejects.toMatchObject({ code });
    }
    expect(mapMediaError(null)).toBe('failed');
  });
  it('reports unsupported browsers', async () => {
    const r = new Recorder({ MediaRecorder: undefined, getUserMedia: null });
    expect(r.supported).toBe(false);
    await expect(r.start()).rejects.toMatchObject({ code: 'unsupported' });
  });
  it('cancel releases the microphone without producing a clip', async () => {
    const h = makeEnv();
    const r = new Recorder(h.env);
    await r.start();
    r.cancel();
    expect(h.tracks[0].stop).toHaveBeenCalled();
    expect(r.recording).toBe(false);
  });
  it('prefers webm/opus, falls back to mp4 (Safari)', () => {
    const MR = (types) => ({ isTypeSupported: (t) => types.includes(t) });
    expect(pickMimeType(MR(['audio/webm;codecs=opus', 'audio/mp4']))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(MR(['audio/mp4']))).toBe('audio/mp4');
    expect(pickMimeType(MR([]))).toBe('');
    expect(pickMimeType(undefined)).toBe('');
  });
});

describe('speaking progress', () => {
  const T = new Date(2026, 4, 10, 12).getTime();
  it('awards 1 XP per "close" rating, capped per day, nothing for "needs practice"', () => {
    let s = emptyState();
    let total = 0;
    for (let i = 0; i < 30; i++) { const r = applySpeaking(s, 'a' + (i % 3), true, T + i); s = r.state; total += r.xp; }
    expect(total).toBe(XP.speakingDailyCap);
    const r = applySpeaking(emptyState(), 'a1', false, T);
    expect(r.xp).toBe(0);
    expect(r.state.speaking.a1).toMatchObject({ tries: 1, close: 0 });
  });
  it('unlocks the speaker achievement after 10 attempts and survives migration', () => {
    let s = emptyState();
    for (let i = 0; i < 10; i++) s = applySpeaking(s, 'w' + i, i % 2 === 0, T + i).state;
    expect(unlockedAchievements(s, { learned: 0, tracksTouched: 0, tracksDone: 0 })).toContain('speaker');
    expect(ACHIEVEMENTS.map((a) => a.id)).toContain('speaker');
    expect(migrate(JSON.parse(JSON.stringify(s))).speaking.w0.tries).toBe(1);
    expect(migrate({ schema: 6, xp: 5 }).speaking).toEqual({});
  });
});
