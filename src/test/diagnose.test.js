import { describe, it, expect } from 'vitest';
import { diagnoseMicBlock } from '../features/speaking/diagnose.js';

const nav = (state) => ({ permissions: { query: async () => ({ state }) } });

describe('diagnoseMicBlock', () => {
  it('detects a Permissions-Policy that disables the microphone (old cached copy)', async () => {
    const doc = { permissionsPolicy: { allowsFeature: (f) => f !== 'microphone' } };
    expect(await diagnoseMicBlock(doc, nav('prompt'))).toBe('policy');
    expect(await diagnoseMicBlock({ featurePolicy: { allowsFeature: () => false } }, nav('granted'))).toBe('policy');
  });
  it('detects a user/browser block and a dismissed prompt', async () => {
    const ok = { permissionsPolicy: { allowsFeature: () => true } };
    expect(await diagnoseMicBlock(ok, nav('denied'))).toBe('blocked');
    expect(await diagnoseMicBlock(ok, nav('prompt'))).toBe('dismissed');
  });
  it('falls back to "unknown" when the browser cannot say (Safari)', async () => {
    expect(await diagnoseMicBlock({}, {})).toBe('unknown');
    expect(await diagnoseMicBlock({}, { permissions: { query: async () => { throw new TypeError('bad name'); } } })).toBe('unknown');
    expect(await diagnoseMicBlock(null, null)).toBe('unknown');
  });
});
