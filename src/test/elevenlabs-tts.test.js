// The ElevenLabs Egyptian-voice path and the engine chooser (scripts/elevenlabs-tts.mjs, scripts/egyptian-tts.mjs). No network, no key needed.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRequest, synthesize, readConfig, DEFAULT_MODEL, ALLOWED_MODELS, OUTPUT_FORMAT, MAX_CHARS, HOST } from '../../scripts/elevenlabs-tts.mjs';
import { chooseEngine } from '../../scripts/egyptian-tts.mjs';

// built from parts so no key-shaped text sits in the source (the secrets scan in security.test.js would flag it)
const KEY = ['sk', 'a'.repeat(40)].join('_');
const VOICE = 'AbCdEfGhIjKlMnOp12';
const bytes = (n) => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(n).buffer });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mohleyla-el-'));

describe('the ElevenLabs request', () => {
  it('goes to api.elevenlabs.io for the given voice, with the key only in a header', () => {
    const { url, options } = buildRequest('إزيك يا صاحبي؟', { key: KEY, voiceId: VOICE });
    expect(url).toBe(`${HOST}/v1/text-to-speech/${VOICE}?output_format=${OUTPUT_FORMAT}`);
    expect(options.headers['xi-api-key']).toBe(KEY);
    expect(url).not.toContain(KEY);
    expect(options.body).not.toContain(KEY);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ text: 'إزيك يا صاحبي؟', model_id: DEFAULT_MODEL });
    expect(body.language_code).toBeUndefined(); // multilingual v2 detects the language
  });
  it('tells the flash and turbo models the language explicitly', () => {
    expect(JSON.parse(buildRequest('x', { key: KEY, voiceId: VOICE, model: 'eleven_flash_v2_5' }).options.body).language_code).toBe('ar');
    expect(JSON.parse(buildRequest('x', { key: KEY, voiceId: VOICE, model: 'eleven_turbo_v2_5' }).options.body).language_code).toBe('ar');
  });
  it('a voice id or model can never change the address or the account that is billed', () => {
    for (const bad of ['../../v1/user', 'abc', '', undefined, 'a/b' + 'c'.repeat(12), 'x'.repeat(41), 'ok voice id 1234', 'abc?xi=1&' + 'd'.repeat(10)]) expect(() => buildRequest('x', { key: KEY, voiceId: bad }), String(bad)).toThrow(/VOICE_ID/);
    expect(() => buildRequest('x', { key: KEY, voiceId: VOICE, model: 'some_model/../x' })).toThrow(/unsupported model/);
    expect(ALLOWED_MODELS).toContain(DEFAULT_MODEL);
  });
  it('needs a key, refuses empty or very long text (credits are charged per character), strips control characters', () => {
    expect(() => buildRequest('x', { key: '', voiceId: VOICE })).toThrow(/ELEVENLABS_API_KEY/);
    expect(() => buildRequest('   ', { key: KEY, voiceId: VOICE })).toThrow(/empty/);
    expect(() => buildRequest('ا'.repeat(MAX_CHARS + 1), { key: KEY, voiceId: VOICE })).toThrow(/too long/);
    expect(JSON.parse(buildRequest('a\u0007b', { key: KEY, voiceId: VOICE }).options.body).text).toBe('a b');
  });
});

describe('synthesizing with ElevenLabs', () => {
  it('returns the mp3 bytes', async () => {
    const f = vi.fn(async () => bytes(3000));
    expect((await synthesize('مرحبا', { key: KEY, voiceId: VOICE }, f)).length).toBe(3000);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('explains failures briefly, and the error text never contains the key', async () => {
    for (const [status, re] of [[401, /key was refused/], [402, /plan or credits/], [403, /plan or credits/], [404, /voice or model/], [422, /voice or model/], [429, /rate limited/], [500, /HTTP 500/]]) {
      const err = await synthesize('x', { key: KEY, voiceId: VOICE }, async () => ({ ok: false, status })).catch((e) => e);
      expect(err.message, String(status)).toMatch(re);
      expect(err.message).not.toContain(KEY);
    }
    await expect(synthesize('x', { key: KEY, voiceId: VOICE }, async () => bytes(10))).rejects.toThrow(/no audio/);
  });
});

describe('reading the settings', () => {
  it('uses the environment first, then .env.local, with a default model', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, '.env.local'), `ELEVENLABS_API_KEY="from-file"\nELEVENLABS_VOICE_ID = ${VOICE}\nELEVENLABS_MODEL=eleven_flash_v2_5\n`);
    expect(readConfig(d, {})).toEqual({ key: 'from-file', voiceId: VOICE, model: 'eleven_flash_v2_5' });
    expect(readConfig(d, { ELEVENLABS_API_KEY: 'from-env' })).toMatchObject({ key: 'from-env', voiceId: VOICE });
    expect(readConfig(tmp(), {})).toEqual({ key: '', voiceId: '', model: DEFAULT_MODEL });
  });
});

describe('which service makes the Egyptian recordings', () => {
  const env = (o) => ({ ...o });
  const write = (d, text) => fs.writeFileSync(path.join(d, '.env.local'), text);
  it('none when nothing is configured (the app keeps the Standard Arabic recordings)', () => {
    const e = chooseEngine(tmp(), env({}));
    expect(e.name).toBe('none');
    expect(e.reason).toMatch(/ELEVENLABS_API_KEY/);
  });
  it('ElevenLabs when its key and an Egyptian voice id are set; it needs the voice id too', () => {
    expect(chooseEngine(tmp(), env({ ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID: VOICE })).name).toBe('elevenlabs');
    expect(chooseEngine(tmp(), env({ ELEVENLABS_API_KEY: KEY })).name).toBe('none');
  });
  it('Azure when only its key and region are set', () => {
    expect(chooseEngine(tmp(), env({ AZURE_SPEECH_KEY: 'k'.repeat(32), AZURE_SPEECH_REGION: 'westeurope' })).name).toBe('azure');
  });
  it('prefers ElevenLabs when both are set, unless EG_TTS_ENGINE says otherwise', () => {
    const both = { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID: VOICE, AZURE_SPEECH_KEY: 'k'.repeat(32), AZURE_SPEECH_REGION: 'westeurope' };
    expect(chooseEngine(tmp(), env(both)).name).toBe('elevenlabs');
    expect(chooseEngine(tmp(), env({ ...both, EG_TTS_ENGINE: 'azure' })).name).toBe('azure');
    expect(chooseEngine(tmp(), env({ ...both, EG_TTS_ENGINE: 'elevenlabs' })).name).toBe('elevenlabs');
  });
  it('a forced engine with incomplete settings does not silently use the other one', () => {
    const e = chooseEngine(tmp(), env({ EG_TTS_ENGINE: 'elevenlabs', AZURE_SPEECH_KEY: 'k'.repeat(32), AZURE_SPEECH_REGION: 'westeurope' }));
    expect(e.name).toBe('none');
    expect(e.reason).toMatch(/incomplete/);
  });
  it('reads the choice and the settings from .env.local', () => {
    const d = tmp();
    write(d, `EG_TTS_ENGINE=elevenlabs\nELEVENLABS_API_KEY=${KEY}\nELEVENLABS_VOICE_ID=${VOICE}\n`);
    expect(chooseEngine(d, {}).name).toBe('elevenlabs');
  });
  it('the engine label names the voice but never the key', () => {
    const e = chooseEngine(tmp(), env({ ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID: VOICE }));
    expect(e.label).toContain(VOICE);
    expect(e.label).not.toContain(KEY);
  });
});
