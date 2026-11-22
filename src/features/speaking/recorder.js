// Microphone recorder for speaking practice.
// Privacy by design: audio lives only in memory (a Blob + object URL) for the current screen. It is never written to
// storage and never uploaded. Errors are mapped to codes the UI translates.

export const MAX_RECORD_MS = 15000;
export const MIN_RECORD_MS = 400;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Pick a container the browser can record (Safari: mp4, Chrome/Firefox: webm/ogg). */
export function pickMimeType(MR) {
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find((m) => MR.isTypeSupported(m)) || '';
}

export function mapMediaError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'denied';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'noMic';
  return 'failed';
}

export class Recorder {
  /** @param {object} env injectable for tests: { MediaRecorder, getUserMedia, now, setTimeout, clearTimeout } */
  constructor(env = {}) {
    const w = typeof window !== 'undefined' ? window : {};
    const has = (k) => Object.prototype.hasOwnProperty.call(env, k);
    this.MR = has('MediaRecorder') ? env.MediaRecorder : w.MediaRecorder;
    this.getUserMedia = has('getUserMedia')
      ? env.getUserMedia
      : typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? (c) => navigator.mediaDevices.getUserMedia(c)
        : null;
    this.now = env.now || (() => Date.now());
    this.setTimeout = env.setTimeout || ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeout = env.clearTimeout || ((id) => clearTimeout(id));
    this.rec = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
    this.timer = null;
    this.onAutoStop = null;
  }

  get supported() {
    return !!(this.MR && this.getUserMedia);
  }
  get recording() {
    return !!this.rec && this.rec.state === 'recording';
  }

  /** Starts recording. Throws an Error whose `code` is one of: unsupported | denied | noMic | failed. */
  async start() {
    if (!this.supported) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    this.cleanup();
    let stream;
    try {
      stream = await this.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      throw Object.assign(new Error(String(e && e.message)), { code: mapMediaError(e) });
    }
    try {
      const mimeType = pickMimeType(this.MR);
      this.stream = stream;
      this.chunks = [];
      this.rec = mimeType ? new this.MR(stream, { mimeType }) : new this.MR(stream);
      this.rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) this.chunks.push(ev.data);
      };
      this.rec.start();
      this.startedAt = this.now();
      this.timer = this.setTimeout(() => {
        if (this.onAutoStop) this.onAutoStop();
      }, MAX_RECORD_MS);
    } catch (e) {
      this.cleanup();
      throw Object.assign(new Error(String(e && e.message)), { code: 'failed' });
    }
  }

  /** Stops and resolves { blob, url, durationMs } or rejects with code 'tooShort' / 'failed'. */
  stop() {
    return new Promise((resolve, reject) => {
      const rec = this.rec;
      if (!rec) return reject(Object.assign(new Error('not recording'), { code: 'failed' }));
      const duration = this.now() - this.startedAt;
      rec.onstop = () => {
        const type = rec.mimeType || (this.chunks[0] && this.chunks[0].type) || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        this.cleanup();
        if (duration < MIN_RECORD_MS || blob.size === 0) return reject(Object.assign(new Error('too short'), { code: 'tooShort' }));
        resolve({ blob, url: URL.createObjectURL(blob), durationMs: duration });
      };
      rec.onerror = () => {
        this.cleanup();
        reject(Object.assign(new Error('recorder error'), { code: 'failed' }));
      };
      try {
        if (rec.state !== 'inactive') rec.stop();
        else rec.onstop();
      } catch (e) {
        this.cleanup();
        reject(Object.assign(new Error(String(e && e.message)), { code: 'failed' }));
      }
    });
  }

  /** Abort without producing a clip; always releases the microphone. */
  cancel() {
    if (this.rec) {
      this.rec.onstop = null;
      try {
        if (this.rec.state !== 'inactive') this.rec.stop();
      } catch { /* ignore */ }
    }
    this.cleanup();
  }

  cleanup() {
    if (this.timer) this.clearTimeout(this.timer);
    this.timer = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }
}
