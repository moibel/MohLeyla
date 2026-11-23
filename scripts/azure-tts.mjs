// Azure Speech (Microsoft's official text-to-speech service) for the Egyptian Arabic recordings.
// Used by scripts/generate-audio.mjs. Pure helpers are exported so they can be unit-tested without a key or a network.
//   Voices: ar-EG-SalmaNeural (female, default) and ar-EG-ShakirNeural (male). Free tier: 500,000 characters a month; the whole
//   Egyptian course is about 9,300 characters.
//   Key: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, from the environment or from a git-ignored .env.local file. The key is only ever sent
//   in the request header to Microsoft's own host, and never printed.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_VOICE = 'ar-EG-SalmaNeural';
export const ALLOWED_VOICES = ['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural'];
export const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const REGION = /^[a-z0-9]{3,30}$/;

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** SSML for one line: Egyptian Arabic, a little slower than natural speech because this is for learners. */
export function buildSsml(text, { voice = DEFAULT_VOICE, rate = '-10%' } = {}) {
  if (!ALLOWED_VOICES.includes(voice)) throw new Error(`unsupported voice: ${voice}`);
  if (!/^[+-]?\d{1,3}%$/.test(rate)) throw new Error(`bad rate: ${rate}`);
  const clean = String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  if (!clean) throw new Error('empty text');
  return `<speak version="1.0" xml:lang="ar-EG" xmlns="http://www.w3.org/2001/10/synthesis"><voice xml:lang="ar-EG" name="${voice}"><prosody rate="${rate}">${escapeXml(clean)}</prosody></voice></speak>`;
}

/** The HTTP request for one clip. The key goes only in a header, to https://<region>.tts.speech.microsoft.com. */
export function buildRequest(text, { key, region, voice, rate } = {}) {
  if (!key) throw new Error('AZURE_SPEECH_KEY is not set');
  if (!REGION.test(String(region || ''))) throw new Error('AZURE_SPEECH_REGION is not set or not valid (for example: westeurope)');
  return {
    url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    options: {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': OUTPUT_FORMAT, 'User-Agent': 'MohLeyla-audio-generator' },
      body: buildSsml(text, { voice, rate }),
    },
  };
}

/** Synthesises one line to mp3 bytes. `fetchFn` is injectable for tests. Throws a short error that never contains the key. */
export async function synthesize(text, cfg, fetchFn = fetch) {
  const { url, options } = buildRequest(text, cfg);
  const res = await fetchFn(url, options);
  if (!res.ok) {
    const why = res.status === 401 || res.status === 403 ? 'the key or region was refused' : res.status === 429 ? 'rate limited' : `HTTP ${res.status}`;
    throw new Error(`Azure Speech: ${why}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new Error('Azure Speech returned no audio');
  return bytes;
}

/** Reads AZURE_SPEECH_KEY / AZURE_SPEECH_REGION / AZURE_EG_VOICE from the environment, then from .env.local in the project root. */
export function readConfig(root, env = process.env) {
  const out = { key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION, voice: env.AZURE_EG_VOICE };
  const file = path.join(root, '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(AZURE_SPEECH_KEY|AZURE_SPEECH_REGION|AZURE_EG_VOICE)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (m[1] === 'AZURE_SPEECH_KEY' && !out.key) out.key = v;
      if (m[1] === 'AZURE_SPEECH_REGION' && !out.region) out.region = v;
      if (m[1] === 'AZURE_EG_VOICE' && !out.voice) out.voice = v;
    }
  }
  return { key: out.key || '', region: out.region || '', voice: out.voice || DEFAULT_VOICE };
}
