import { describe, it, expect } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { chooseMsaEngine, chooseIdnEngine, chooseSauEngine } from '../../scripts/msa-tts.mjs';
import { readConfig } from '../../scripts/elevenlabs-tts.mjs';

const KEY = ['sk', 'b'.repeat(40)].join('_');
const emptyRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));

describe('Modern Standard Arabic voice settings', () => {
  it('needs the key AND ELEVENLABS_VOICE_ID_AR; the Egyptian voice id is not used for it', () => {
    const root = emptyRoot();
    expect(chooseMsaEngine(root, {}).name).toBe('none');
    expect(chooseMsaEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID: 'abcdefghij1234567890' }).name).toBe('none');
    const e = chooseMsaEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID_AR: 'abcdefghij1234567890' });
    expect(e.name).toBe('elevenlabs');
    expect(e.label).not.toContain(KEY);
  });
  it('reads the Arabic voice id from .env.local and never the wrong variable', () => {
    const root = emptyRoot();
    fs.writeFileSync(path.join(root, '.env.local'), `ELEVENLABS_API_KEY=${KEY}\nELEVENLABS_VOICE_ID=egyptianvoice0000001\nELEVENLABS_VOICE_ID_AR=arabicvoice00000002\n`);
    expect(readConfig(root, {}, 'ELEVENLABS_VOICE_ID_AR').voiceId).toBe('arabicvoice00000002');
    expect(readConfig(root, {}).voiceId).toBe('egyptianvoice0000001');
  });
  it('the Indonesian voice uses its own setting, ELEVENLABS_VOICE_ID_ID', () => {
    const root = emptyRoot();
    expect(chooseIdnEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID_AR: 'abcdefghij1234567890' }).name).toBe('none');
    expect(chooseIdnEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID_ID: 'abcdefghij1234567890' }).name).toBe('elevenlabs');
  });
  it('the Saudi voice uses its own setting, ELEVENLABS_VOICE_ID_SA', () => {
    const root = emptyRoot();
    expect(chooseSauEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID_AR: 'abcdefghij1234567890' }).name).toBe('none');
    expect(chooseSauEngine(root, { ELEVENLABS_API_KEY: KEY, ELEVENLABS_VOICE_ID_SA: 'abcdefghij1234567890' }).name).toBe('elevenlabs');
  });
  it('refuses an unknown voice setting name', () => {
    expect(() => readConfig(emptyRoot(), {}, 'PATH')).toThrow();
  });
});
