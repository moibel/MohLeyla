// Audio architecture
//   1. Pre-generated, content-addressed mp3 clips in /audio/<lang>/<hash>.mp3 (cached by the service worker).
//   2. Fallback: the browser's Web Speech API, with explicit voice selection (exact locale first, then same language).
// Only one clip can play at a time; every failure is surfaced through `state.error` (never silent).
import { audioKey, normalizeSpeech } from './hash.js';

export const SPEEDS = { slow: 0.75, normal: 1, fast: 1.25 };

// Preferred BCP-47 locales per speech language / track, best first.
const LOCALE_PREFS = {
  ar: ['ar-SA', 'ar-001', 'ar-AE', 'ar-EG', 'ar-JO', 'ar-KW', 'ar-QA'],
  'ar:sa': ['ar-SA', 'ar-AE', 'ar-KW', 'ar-QA', 'ar-001', 'ar-EG', 'ar-JO'],
  en: ['en-US', 'en-GB', 'en-AU', 'en-IN'],
  'ar:eg': ['ar-EG', 'ar-SA', 'ar-001', 'ar-AE', 'ar-JO', 'ar-KW', 'ar-QA'],
  id: ['id-ID'],
  fr: ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH'],
  es: ['es-ES', 'es-MX', 'es-US', 'es-AR', 'es-CO'],
  zh: ['zh-CN', 'zh-TW', 'zh-HK'],
};

const normLang = (l) => String(l || '').replace('_', '-').toLowerCase();

/** Pick the best installed voice. Returns { voice, exact } or null. Pure: easy to unit-test. */
export function pickVoice(voices, lang, track) {
  const list = (voices || []).filter((v) => normLang(v.lang).startsWith(lang));
  if (!list.length) return null;
  const prefs = LOCALE_PREFS[lang === 'ar' && track === 'sa' ? 'ar:sa' : lang === 'ar' && track === 'eg' ? 'ar:eg' : lang] || [];
  for (const p of prefs) {
    const hit = list.filter((v) => normLang(v.lang) === p.toLowerCase());
    if (hit.length) return { voice: hit.find((v) => v.default) || hit.find((v) => v.localService) || hit[0], exact: p === prefs[0] };
  }
  return { voice: list.find((v) => v.default) || list[0], exact: false };
}

export class AudioService {
  /**
   * @param {object} env injectable environment (for tests): { AudioCtor, synth, Utterance, fetchFn, base }
   */
  constructor(env = {}) {
    const w = typeof window !== 'undefined' ? window : {};
    const has = (k) => Object.prototype.hasOwnProperty.call(env, k);
    this.AudioCtor = has('AudioCtor') ? env.AudioCtor : w.Audio;
    this.synth = has('synth') ? env.synth : w.speechSynthesis;
    this.Utterance = has('Utterance') ? env.Utterance : w.SpeechSynthesisUtterance;
    this.fetchFn = has('fetchFn') ? env.fetchFn : typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;
    this.base = env.base ?? '';
    this.prefs = { speed: 1, source: 'auto' };
    this.listeners = new Set();
    this.token = 0;
    this.manifestPromise = null;
    this.element = null;
    this.state = { status: 'idle', key: null, error: null, kind: null, errorId: 0, fallback: false, lang: null };
  }

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  setPrefs(p) {
    this.prefs = { ...this.prefs, ...p };
    if (this.element) this.element.playbackRate = this.prefs.speed;
  }
  clearError() {
    if (this.state.error) this.setState({ error: null });
  }

  loadManifest() {
    if (!this.manifestPromise) {
      this.manifestPromise = (this.fetchFn
        ? this.fetchFn(`${this.base}/audio/manifest.json`).then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null)
      )
        .then((m) => (m && m.clips ? Object.fromEntries(Object.entries(m.clips).map(([k, v]) => [k, new Set(v)])) : null))
        .catch(() => null);
    }
    return this.manifestPromise;
  }

  stop() {
    this.token++;
    if (this.element) {
      try { this.element.pause(); this.element.removeAttribute('src'); this.element.load?.(); } catch { /* ignore */ }
    }
    try { this.synth?.cancel(); } catch { /* ignore */ }
    if (this.state.status !== 'idle') this.setState({ status: 'idle', key: null, kind: null });
  }

  fail(code, token) {
    if (token !== this.token) return { ok: false, error: code, superseded: true };
    this.setState({ status: 'idle', key: null, kind: null, error: code, errorId: this.state.errorId + 1 });
    return { ok: false, error: code };
  }

  /**
   * Play `text` spoken in `lang` ('ar' | 'en' | 'id' | 'fr' | 'es' | 'zh'). `track` ('sa' Saudi, 'eg' Egyptian) only influences voice choice and labelling.
   * Resolves when playback ends. Replaces any clip that is currently playing.
   */
  async play({ text, lang, track, key: keyOverride }) {
    const clean = normalizeSpeech(text);
    const key = keyOverride || `${lang}:${clean}`;
    // Clicking the active clip again stops it (pause / cancel).
    if (this.state.key === key && this.state.status !== 'idle') {
      this.stop();
      return { ok: true, stopped: true };
    }
    this.stop();
    const token = this.token;
    this.setState({ status: 'loading', key, error: null, kind: null, fallback: false, lang });
    const { source } = this.prefs;

    if (source !== 'device') {
      const r = await this.playRecording(clean, lang, key, token);
      if (r.ok || r.superseded) return r;
      if (source === 'recorded' || r.error === 'blocked') return this.fail(r.error, token);
      // auto: fall through to the device voice
      if (token === this.token) this.setState({ fallback: true });
      return this.playDevice(clean, lang, track, key, token);
    }
    return this.playDevice(clean, lang, track, key, token);
  }

  async playRecording(text, lang, key, token) {
    if (!this.AudioCtor) return { ok: false, error: 'unsupported' };
    const clips = await this.loadManifest();
    if (token !== this.token) return { ok: false, superseded: true };
    const hash = audioKey(text, lang);
    if (clips && !clips[lang]?.has(hash)) return { ok: false, error: 'noAudioFile' };
    const url = `${this.base}/audio/${lang}/${hash}.mp3`;
    if (!this.element) this.element = new this.AudioCtor();
    const el = this.element;
    el.preservesPitch = true;
    return new Promise((resolve) => {
      let settled = false;
      const done = (res) => {
        if (settled) return;
        settled = true;
        el.onended = el.onerror = el.onplaying = null;
        if (token === this.token && res.ok) this.setState({ status: 'idle', key: null, kind: null });
        resolve(res);
      };
      el.onplaying = () => {
        if (token === this.token) this.setState({ status: 'playing', kind: 'recorded' });
      };
      el.onended = () => done({ ok: true, kind: 'recorded' });
      el.onerror = () => done(token !== this.token ? { ok: false, superseded: true } : { ok: false, error: this.isOffline() ? 'network' : 'failed' });
      el.src = url;
      el.playbackRate = this.prefs.speed;
      let p;
      try { p = el.play(); } catch { p = null; }
      if (p && p.catch) {
        p.catch((e) => {
          if (token !== this.token) return done({ ok: false, superseded: true });
          done({ ok: false, error: e && e.name === 'NotAllowedError' ? 'blocked' : e && e.name === 'AbortError' ? 'failed' : 'failed' });
        });
      }
    });
  }

  isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  async getVoices() {
    const synth = this.synth;
    if (!synth) return [];
    let voices = synth.getVoices();
    if (voices.length) return voices;
    await new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        synth.removeEventListener?.('voiceschanged', finish);
        resolve();
      };
      synth.addEventListener?.('voiceschanged', finish);
      setTimeout(finish, 1500);
    });
    voices = synth.getVoices();
    return voices;
  }

  async playDevice(text, lang, track, key, token) {
    if (!this.synth || !this.Utterance) return this.fail('unsupported', token);
    const voices = await this.getVoices();
    if (token !== this.token) return { ok: false, superseded: true };
    const picked = pickVoice(voices, lang, track);
    if (!picked) return this.fail('noVoice', token);
    return new Promise((resolve) => {
      const u = new this.Utterance(text);
      u.voice = picked.voice;
      u.lang = picked.voice.lang;
      u.rate = Math.min(1.5, Math.max(0.5, this.prefs.speed * (lang === 'ar' ? 0.9 : 0.95)));
      u.pitch = 1;
      let settled = false;
      const finish = (res) => {
        if (settled) return;
        settled = true;
        if (token === this.token && res.ok) this.setState({ status: 'idle', key: null, kind: null });
        resolve(res);
      };
      u.onstart = () => token === this.token && this.setState({ status: 'playing', kind: 'device' });
      u.onend = () => finish({ ok: true, kind: 'device' });
      u.onerror = (e) => {
        if (token !== this.token || e.error === 'canceled' || e.error === 'interrupted') return finish({ ok: false, superseded: true });
        finish(e.error === 'not-allowed' ? this.fail('blocked', token) : this.fail('failed', token));
      };
      try {
        this.synth.cancel();
        this.synth.speak(u);
      } catch {
        finish(this.fail('failed', token));
      }
      // Some browsers never fire events when speech is blocked: guard against a silent hang.
      setTimeout(() => {
        if (!settled && token === this.token && this.state.status === 'loading') finish(this.fail('failed', token));
      }, 6000);
    });
  }
}

export const audio = new AudioService();
