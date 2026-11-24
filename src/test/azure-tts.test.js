// The Egyptian-voice generator (scripts/azure-tts.mjs): what it sends to Azure Speech, and that the key never leaks. No network, no key needed.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSsml, buildRequest, synthesize, readConfig, ALLOWED_VOICES, DEFAULT_VOICE, OUTPUT_FORMAT } from '../../scripts/azure-tts.mjs';

const KEY = 'k'.repeat(32);
const bytes = (n) => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(n).buffer });

describe('SSML', () => {
  it('asks for an Egyptian Arabic voice, slightly slow for learners', () => {
    const s = buildSsml('إزيك يا صاحبي؟');
    expect(s).toContain('xml:lang="ar-EG"');
    expect(s).toContain(`name="${DEFAULT_VOICE}"`);
    expect(s).toContain('rate="-10%"');
    expect(s).toContain('إزيك يا صاحبي؟');
  });
  it('escapes markup so text can never inject SSML tags', () => {
    const s = buildSsml(`a & b <break time="9s"/> "c" 'd'`);
    expect(s).not.toContain('<break');
    expect(s).toContain('&amp;');
    expect(s).toContain('&lt;break');
    expect(s).toContain('&quot;c&quot;');
  });
  it('only the two Egyptian voices and a sane rate are accepted', () => {
    expect(ALLOWED_VOICES).toEqual(['ar-EG-SalmaNeural', 'ar-EG-ShakirNeural']);
    expect(() => buildSsml('x', { voice: 'ar-SA-HamedNeural' })).toThrow(/unsupported voice/);
    expect(() => buildSsml('x', { voice: '"><x' })).toThrow();
    expect(() => buildSsml('x', { rate: 'fast"' })).toThrow(/bad rate/);
    expect(buildSsml('x', { voice: 'ar-EG-ShakirNeural', rate: '+5%' })).toContain('rate="+5%"');
  });
  it('refuses empty text and strips control characters', () => {
    expect(() => buildSsml('   ')).toThrow(/empty/);
    expect(buildSsml('a\u0007b')).toContain('>a b<');
  });
});

describe('the request', () => {
  it('goes only to Microsoft\'s own speech host for the given region, with the key in a header and an mp3 format', () => {
    const { url, options } = buildRequest('مرحبا', { key: KEY, region: 'westeurope' });
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(options.headers['Ocp-Apim-Subscription-Key']).toBe(KEY);
    expect(options.headers['Content-Type']).toBe('application/ssml+xml');
    expect(options.headers['X-Microsoft-OutputFormat']).toBe(OUTPUT_FORMAT);
    expect(OUTPUT_FORMAT).toMatch(/mp3/);
    expect(url).not.toContain(KEY);
    expect(options.body).not.toContain(KEY);
  });
  it('a region cannot redirect the key to another host', () => {
    for (const bad of ['evil.com/x?', 'a.b', 'west europe', '', undefined, 'x'.repeat(40), 'westeurope.evil.example']) expect(() => buildRequest('x', { key: KEY, region: bad }), String(bad)).toThrow(/REGION/);
  });
  it('needs a key', () => expect(() => buildRequest('x', { key: '', region: 'westeurope' })).toThrow(/AZURE_SPEECH_KEY/));
});

describe('synthesizing', () => {
  it('returns the mp3 bytes', async () => {
    const fetchFn = vi.fn(async () => bytes(2000));
    const out = await synthesize('مرحبا', { key: KEY, region: 'westeurope' }, fetchFn);
    expect(out.length).toBe(2000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('explains failures briefly, and the error text never contains the key', async () => {
    for (const [status, re] of [[401, /refused/], [403, /refused/], [429, /rate limited/], [500, /HTTP 500/]]) {
      const err = await synthesize('x', { key: KEY, region: 'westeurope' }, async () => ({ ok: false, status })).catch((e) => e);
      expect(err.message).toMatch(re);
      expect(err.message).not.toContain(KEY);
    }
    await expect(synthesize('x', { key: KEY, region: 'westeurope' }, async () => bytes(10))).rejects.toThrow(/no audio/);
  });
});

describe('reading the key', () => {
  const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mohleyla-env-'));
  it('uses the environment first, then .env.local, and defaults the voice', () => {
    const d = dir();
    fs.writeFileSync(path.join(d, '.env.local'), `# note\nAZURE_SPEECH_KEY="from-file"\nAZURE_SPEECH_REGION = westeurope \nAZURE_EG_VOICE=ar-EG-ShakirNeural\nOTHER=1\n`);
    expect(readConfig(d, {})).toEqual({ key: 'from-file', region: 'westeurope', voice: 'ar-EG-ShakirNeural' });
    expect(readConfig(d, { AZURE_SPEECH_KEY: 'from-env', AZURE_SPEECH_REGION: 'eastus' })).toMatchObject({ key: 'from-env', region: 'eastus' });
    expect(readConfig(dir(), {})).toEqual({ key: '', region: '', voice: DEFAULT_VOICE });
  });
  it('.env.local is git-ignored, so a key cannot be committed by accident', () => {
    expect(fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8')).toMatch(/^\.env\.local$/m);
  });
});
