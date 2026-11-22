import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Speaking practice needs getUserMedia. A Permissions-Policy that disables the microphone for this origin makes every
// recording fail on the deployed site while all local tests still pass (local servers do not send Netlify headers).
describe('deployment headers', () => {
  const toml = fs.readFileSync(path.resolve(__dirname, '../../netlify.toml'), 'utf8');
  it('allows the microphone for the app itself', () => {
    const m = toml.match(/Permissions-Policy\s*=\s*"([^"]*)"/);
    expect(m, 'Permissions-Policy header present').toBeTruthy();
    expect(m[1]).toMatch(/microphone=\(self\)/);
    expect(m[1]).not.toMatch(/microphone=\(\)/);
  });
  it('keeps camera and geolocation disabled', () => {
    const policy = toml.match(/Permissions-Policy\s*=\s*"([^"]*)"/)[1];
    expect(policy).toMatch(/camera=\(\)/);
    expect(policy).toMatch(/geolocation=\(\)/);
  });
});
