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

// Regression: /audio/manifest.json used to be served "immutable for a year". A browser that had loaded the list before the French, Spanish,
// Chinese and Egyptian clips (or lessons 11-30) existed kept that old copy and never offered those recordings.
describe('a stale clip list kept by the browser', () => {
  const fr = 'Bonjour, comment ça va ?';
  const setup = ({ fresh, freshFails = false }) => {
    const calls = [];
    const base = makeEnv({ clips: {} , voiceList: voices('fr-FR') });
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      if (init?.cache === 'reload') { if (freshFails) throw new Error('offline'); return { ok: true, json: async () => ({ clips: fresh }) }; }
      return { ok: true, json: async () => ({ clips: { ar: [], en: [], id: [] } }) }; // the OLD list: no fr / es / zh
    };
    return { ...base, env: { ...base.env, fetchFn }, calls };
  };

  it('looks once at a fresh copy and then plays the recording instead of falling back to the device voice', async () => {
    const { env, spoken, calls } = setup({ fresh: { fr: [audioKey(fr, 'fr')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: fr, lang: 'fr', track: 'fr' });
    expect(r).toMatchObject({ ok: true, kind: 'recorded' });
    expect(spoken).toHaveLength(0);
    expect(calls.filter((c) => c.init?.cache === 'reload')).toHaveLength(1);
  });
  it('only refreshes once per session, even for several missing clips', async () => {
    const { env, calls } = setup({ fresh: { fr: [] } });
    const svc = new AudioService(env);
    await svc.play({ text: 'un', lang: 'fr', track: 'fr' });
    await svc.play({ text: 'deux', lang: 'fr', track: 'fr' });
    await svc.play({ text: 'trois', lang: 'fr', track: 'fr' });
    expect(calls.filter((c) => c.init?.cache === 'reload')).toHaveLength(1);
  });
  it('a clip that really has no recording still falls back to the device voice', async () => {
    const { env, spoken } = setup({ fresh: { fr: [] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: fr, lang: 'fr', track: 'fr' });
    expect(r).toMatchObject({ ok: true, kind: 'device' });
    expect(spoken).toHaveLength(1);
  });
  it('keeps working when the fresh copy cannot be fetched (offline)', async () => {
    const { env } = setup({ fresh: {}, freshFails: true });
    const svc = new AudioService(env);
    const r = await svc.play({ text: fr, lang: 'fr', track: 'fr' });
    expect(r.ok).toBe(true); // device voice
  });
  it('asks for the list at an address that carries the build\'s version (so a new release can never be served an old copy)', async () => {
    const urls = [];
    const base = makeEnv({ clips: { ar: [] } });
    const svc = new AudioService({ ...base.env, fetchFn: async (u) => { urls.push(u); return { ok: true, json: async () => ({ clips: {} }) }; }, base: 'https://example.test' });
    await svc.loadManifest();
    expect(urls[0]).toMatch(/^https:\/\/example\.test\/audio\/manifest\.json(\?v=[0-9a-f]{10})?$/);
  });
});

describe('Egyptian Arabic recordings', () => {
  const eg = 'إزيك يا صاحبي';
  const urlsOf = (svc) => svc.element?.src;
  it('plays its own Egyptian recording when there is one', async () => {
    const { env, els } = makeEnv({ clips: { eg: [audioKey(eg, 'eg')], ar: [audioKey(eg, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: eg, lang: 'eg', track: 'eg' });
    expect(r).toMatchObject({ ok: true, kind: 'recorded' });
    expect(els[0].src).toBe(`/audio/eg/${audioKey(eg, 'eg')}.mp3`);
  });
  it('until a line has one, uses the Standard Arabic recording of the same text (not the device voice)', async () => {
    const { env, els, spoken } = makeEnv({ clips: { eg: [], ar: [audioKey(eg, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: eg, lang: 'eg', track: 'eg' });
    expect(r).toMatchObject({ ok: true, kind: 'recorded' });
    expect(els[0].src).toBe(`/audio/ar/${audioKey(eg, 'ar')}.mp3`);
    expect(spoken).toHaveLength(0);
  });
  it('with no recording at all, speaks with the device voice and prefers an Egyptian one', async () => {
    const { env, spoken } = makeEnv({ clips: { eg: [], ar: [] }, voiceList: voices('ar-SA', 'ar-EG', 'en-US') });
    const svc = new AudioService(env);
    const r = await svc.play({ text: eg, lang: 'eg', track: 'eg' });
    expect(r).toMatchObject({ ok: true, kind: 'device' });
    expect(spoken[0].voice.lang).toBe('ar-EG');
  });
  it('a Saudi line never uses an Egyptian recording, and an Egyptian clip key is different from the Arabic one', async () => {
    expect(audioKey(eg, 'eg')).not.toBe(audioKey(eg, 'ar'));
    const { env, els } = makeEnv({ clips: { eg: [audioKey(eg, 'eg')], ar: [audioKey(eg, 'ar')] } });
    const svc = new AudioService(env);
    await svc.play({ text: eg, lang: 'ar', track: 'sa' });
    expect(els[0].src).toContain('/audio/ar/');
  });
});

describe('Modern Standard Arabic recordings (ElevenLabs set "msa")', () => {
  const ar = 'مَرْحَبًا بِكُمْ';
  it('the Arabic course plays its msa recording when there is one', async () => {
    const { env, els } = makeEnv({ clips: { msa: [audioKey(ar, 'msa')], ar: [audioKey(ar, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: ar, lang: 'ar', track: 'ar' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/msa/${audioKey(ar, 'msa')}.mp3`);
  });
  it('falls back to the macOS Arabic recording for a line without an msa one', async () => {
    const { env, els } = makeEnv({ clips: { msa: [], ar: [audioKey(ar, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: ar, lang: 'ar', track: 'ar' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/ar/${audioKey(ar, 'ar')}.mp3`);
  });
  it('an msa clip key differs from the macOS Arabic key (so replacing the voice never meets a stale cached file)', () => {
    expect(audioKey(ar, 'msa')).not.toBe(audioKey(ar, 'ar'));
  });
});

describe('Saudi recordings (ElevenLabs set "sau")', () => {
  const sa = 'شْلُونَك؟';
  it('the Saudi track plays its sau recording when there is one, never the Arabic-course (msa) one', async () => {
    const { env, els } = makeEnv({ clips: { sau: [audioKey(sa, 'sau')], msa: [audioKey(sa, 'msa')], ar: [audioKey(sa, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: sa, lang: 'ar', track: 'sa' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/sau/${audioKey(sa, 'sau')}.mp3`);
  });
  it('falls back to the macOS Arabic recording for a Saudi line without a sau one', async () => {
    const { env, els } = makeEnv({ clips: { sau: [], ar: [audioKey(sa, 'ar')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: sa, lang: 'ar', track: 'sa' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/ar/${audioKey(sa, 'ar')}.mp3`);
  });
});

describe('Chinese recordings (ElevenLabs set "zhn")', () => {
  const zh = '你好，我叫小明。';
  it('the Chinese course plays its zhn recording when there is one', async () => {
    const { env, els } = makeEnv({ clips: { zhn: [audioKey(zh, 'zhn')], zh: [audioKey(zh, 'zh')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: zh, lang: 'zh', track: 'zh' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/zhn/${audioKey(zh, 'zhn')}.mp3`);
  });
  it('falls back to the macOS Chinese recording for a line without a zhn one', async () => {
    const { env, els } = makeEnv({ clips: { zhn: [], zh: [audioKey(zh, 'zh')] } });
    const svc = new AudioService(env);
    const r = await svc.play({ text: zh, lang: 'zh', track: 'zh' });
    expect(r.ok).toBe(true);
    expect(els[0].src).toBe(`/audio/zh/${audioKey(zh, 'zh')}.mp3`);
  });
});
