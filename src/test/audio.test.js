import { describe, it, expect, vi } from 'vitest';
import { AudioService, pickVoice } from '../features/audio/audioService.js';
import { audioKey } from '../features/audio/hash.js';

const voices = (...langs) => langs.map((l, i) => ({ lang: l, name: 'v' + i, default: false, localService: true }));

describe('pickVoice', () => {
  it('prefers the exact locale', () => {
    expect(pickVoice(voices('ar-EG', 'ar-SA', 'en-US'), 'ar', 'ar').voice.lang).toBe('ar-SA');
    expect(pickVoice(voices('en-GB', 'en-US'), 'en', 'en').voice.lang).toBe('en-US');
    expect(pickVoice(voices('id-ID'), 'id', 'id').exact).toBe(true);
  });
  it('falls back to any voice of the same language, never a different language', () => {
    expect(pickVoice(voices('ar-EG'), 'ar', 'ar').voice.lang).toBe('ar-EG');
    expect(pickVoice(voices('en-US', 'fr-FR'), 'ar', 'ar')).toBeNull();
  });
  it('understands Android style ar_SA', () => {
    expect(pickVoice(voices('ar_SA'), 'ar', 'sa').voice.lang).toBe('ar_SA');
  });
});

function makeEnv({ clips = {}, voiceList = [], playBehavior = 'ok', manifestOk = true } = {}) {
  const els = [];
  class FakeAudio {
    constructor() { els.push(this); this.playbackRate = 1; this.paused = true; }
    pause() { this.paused = true; }
    removeAttribute() {}
    load() {}
    play() {
      this.paused = false;
      if (playBehavior === 'blocked') return Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
      if (playBehavior === 'error') { setTimeout(() => this.onerror && this.onerror(), 0); return Promise.resolve(); }
      setTimeout(() => { this.onplaying && this.onplaying(); setTimeout(() => this.onended && this.onended(), 5); }, 0);
      return Promise.resolve();
    }
  }
  const spoken = [];
  const synth = {
    getVoices: () => voiceList,
    cancel: vi.fn(),
    speak: (u) => { spoken.push(u); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 0); },
    addEventListener() {}, removeEventListener() {},
  };
  class Utt { constructor(t) { this.text = t; } }
  const fetchFn = async () => ({ ok: manifestOk, json: async () => ({ clips }) });
  return { env: { AudioCtor: FakeAudio, synth, Utterance: Utt, fetchFn }, els, spoken, synth };
}

describe('AudioService', () => {
  const text = 'مَرْحَبًا';
  it('plays a bundled recording', async () => {
    const { env, spoken } = makeEnv({ clips: { ar: [audioKey(text, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text, lang: 'ar', track: 'ar' });
    expect(r).toMatchObject({ ok: true, kind: 'recorded' });
    expect(spoken).toHaveLength(0);
    expect(svc.getState().status).toBe('idle');
  });
  it('falls back to the device voice when no recording exists', async () => {
    const { env, spoken } = makeEnv({ clips: { ar: [] }, voiceList: voices('ar-SA') });
    const svc = new AudioService(env);
    const r = await svc.play({ text, lang: 'ar', track: 'ar' });
    expect(r).toMatchObject({ ok: true, kind: 'device' });
    expect(spoken[0].voice.lang).toBe('ar-SA');
  });
  it('reports a meaningful error when neither recording nor voice exists (never silent)', async () => {
    const { env } = makeEnv({ clips: { ar: [] }, voiceList: voices('en-US') });
    const svc = new AudioService(env);
    const r = await svc.play({ text, lang: 'ar', track: 'ar' });
    expect(r).toMatchObject({ ok: false, error: 'noVoice' });
    expect(svc.getState().error).toBe('noVoice');
  });
  it('reports blocked autoplay', async () => {
    const { env } = makeEnv({ clips: { ar: [audioKey(text, 'ar')] }, playBehavior: 'blocked' });
    const svc = new AudioService(env);
    expect((await svc.play({ text, lang: 'ar' })).error).toBe('blocked');
  });
  it('recording-only mode does not use device voices', async () => {
    const { env, spoken } = makeEnv({ clips: { ar: [] }, voiceList: voices('ar-SA') });
    const svc = new AudioService(env);
    svc.setPrefs({ source: 'recorded' });
    const r = await svc.play({ text, lang: 'ar' });
    expect(r.error).toBe('noAudioFile');
    expect(spoken).toHaveLength(0);
  });
  it('reports unsupported speech', async () => {
    const svc = new AudioService({ AudioCtor: null, synth: null, Utterance: null, fetchFn: null });
    expect((await svc.play({ text, lang: 'ar' })).error).toBe('unsupported');
  });
  it('a second click on the playing clip stops it; a different clip replaces it (no overlap)', async () => {
    const { env, els } = makeEnv({ clips: { ar: [audioKey(text, 'ar'), audioKey('شُكْرًا', 'ar')] } });
    const svc = new AudioService(env);
    const p1 = svc.play({ text, lang: 'ar' });
    await Promise.resolve(); await Promise.resolve();
    const stop = await svc.play({ text, lang: 'ar' });
    expect(stop.stopped).toBe(true);
    await p1;
    expect(svc.getState().status).toBe('idle');
    const a = svc.play({ text, lang: 'ar' });
    const b = svc.play({ text: 'شُكْرًا', lang: 'ar' });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.superseded || ra.ok).toBeTruthy();
    expect(rb.ok).toBe(true);
    expect(els).toHaveLength(1); // a single shared <audio> element
  });
  it('applies playback speed', async () => {
    const { env, els } = makeEnv({ clips: { ar: [audioKey(text, 'ar')] } });
    const svc = new AudioService(env);
    svc.setPrefs({ speed: 0.75 });
    await svc.play({ text, lang: 'ar' });
    expect(els[0].playbackRate).toBe(0.75);
  });
});

describe('audioKey', () => {
  it('is stable and normalises whitespace', () => {
    expect(audioKey('a  b ', 'en')).toBe(audioKey('a b', 'en'));
    expect(audioKey('a', 'en')).not.toBe(audioKey('a', 'id'));
  });
});
