// ElevenLabs text-to-speech for the Egyptian Arabic recordings (an alternative to Azure Speech; see scripts/egyptian-tts.mjs).
// Pure helpers are exported so they can be unit-tested without a key or a network.
//   Key: ELEVENLABS_API_KEY, voice: ELEVENLABS_VOICE_ID (an Egyptian voice picked in the ElevenLabs Voice Library), optional ELEVENLABS_MODEL.
//   From the environment or from a git-ignored .env.local. The key only goes in a request header to api.elevenlabs.io and is never printed.
import fs from 'node:fs';
import path from 'node:path';

export const HOST = 'https://api.elevenlabs.io';
export const DEFAULT_MODEL = 'eleven_multilingual_v2';
export const ALLOWED_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3'];
export const OUTPUT_FORMAT = 'mp3_44100_64';
const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;
export const MAX_CHARS = 500; // a lesson line is far shorter; a longer text is a mistake, and credits are charged per character

/** The request for one line. The key goes only in a header; the voice id is checked so it cannot change the address. */
export function buildRequest(text, { key, voiceId, model = DEFAULT_MODEL } = {}) {
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  if (!VOICE_ID.test(String(voiceId || ''))) throw new Error('ELEVENLABS_VOICE_ID is not set or not valid (copy it from the voice in ElevenLabs)');
  if (!ALLOWED_MODELS.includes(model)) throw new Error(`unsupported model: ${model}`);
  const clean = String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  if (!clean) throw new Error('empty text');
  if (clean.length > MAX_CHARS) throw new Error(`text too long (${clean.length} characters)`);
  const body = { text: clean, model_id: model, voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true } };
  // The flash and turbo models can be told the language explicitly; the other models detect it from the text.
  if (model === 'eleven_flash_v2_5' || model === 'eleven_turbo_v2_5') body.language_code = 'ar';
  return {
    url: `${HOST}/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    options: { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body) },
  };
}

/** Synthesises one line to mp3 bytes. `fetchFn` is injectable for tests. Errors are short and never contain the key. */
export async function synthesize(text, cfg, fetchFn = fetch) {
  const { url, options } = buildRequest(text, cfg);
  const res = await fetchFn(url, options);
  if (!res.ok) {
    const why = res.status === 401 ? 'the key was refused' : res.status === 402 || res.status === 403 ? 'the plan or credits do not allow this' : res.status === 404 || res.status === 422 ? 'the voice or model was not accepted' : res.status === 429 ? 'rate limited' : `HTTP ${res.status}`;
    throw new Error(`ElevenLabs: ${why}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new Error('ElevenLabs returned no audio');
  return bytes;
}

/**
 * Reads ELEVENLABS_API_KEY / ELEVENLABS_MODEL and a voice id from the environment, then from .env.local in the project root.
 * The voice id comes from `voiceVar` (default ELEVENLABS_VOICE_ID = the Egyptian voice; ELEVENLABS_VOICE_ID_AR = the Modern Standard Arabic voice).
 */
export function readConfig(root, env = process.env, voiceVar = 'ELEVENLABS_VOICE_ID') {
  if (!/^ELEVENLABS_VOICE_ID(_[A-Z]{2,4})?$/.test(voiceVar)) throw new Error('unknown voice setting');
  const out = { key: env.ELEVENLABS_API_KEY, voiceId: env[voiceVar], model: env.ELEVENLABS_MODEL };
  const file = path.join(root, '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (m[1] === 'ELEVENLABS_API_KEY' && !out.key) out.key = v;
      if (m[1] === voiceVar && !out.voiceId) out.voiceId = v;
      if (m[1] === 'ELEVENLABS_MODEL' && !out.model) out.model = v;
    }
  }
  return { key: out.key || '', voiceId: out.voiceId || '', model: out.model || DEFAULT_MODEL };
}
