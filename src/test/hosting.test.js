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

// Cloudflare (and Netlify) read public/_headers; netlify.toml is only read by Netlify. The two must agree on the microphone policy.
describe('public/_headers (Cloudflare)', () => {
  const headers = fs.readFileSync(path.resolve(__dirname, '../../public/_headers'), 'utf8');
  it('allows the microphone for the app and keeps camera and geolocation off', () => {
    const m = headers.match(/Permissions-Policy:\s*(.*)/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/microphone=\(self\)/);
    expect(m[1]).toMatch(/camera=\(\)/);
    expect(m[1]).toMatch(/geolocation=\(\)/);
  });
  it('serves the service worker and index.html uncached so updates are noticed', () => {
    expect(headers).toMatch(/\/sw\.js\n\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/index\.html\n\s+Cache-Control: no-cache/);
  });
});

describe('wrangler.jsonc', () => {
  it('serves ./dist as a single-page app', () => {
    const cfg = fs.readFileSync(path.resolve(__dirname, '../../wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const json = JSON.parse(cfg);
    expect(json.assets.directory).toBe('./dist');
    expect(json.assets.not_found_handling).toBe('single-page-application');
    expect(json.name).toBe('mohleyla');
  });
});

// The public build settings live in .env.production (committed). They are public by design; secrets must never appear there.
describe('.env.production (public build settings)', () => {
  const env = fs.readFileSync(path.resolve(__dirname, '../../.env.production'), 'utf8');
  const vars = Object.fromEntries(env.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  it('only defines VITE_ variables', () => {
    for (const k of Object.keys(vars)) expect(k).toMatch(/^VITE_/);
  });
  it('contains no secret keys, tokens or passwords (in the settings, comments may warn about them)', () => {
    const settings = env.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n');
    expect(settings).not.toMatch(/sb_secret_|service_role|SECRET|PASSWORD|BEGIN [A-Z ]*PRIVATE|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/i);
  });
  it('uses a publishable Supabase key and an https Supabase URL', () => {
    expect(vars.VITE_SUPABASE_ANON_KEY).toMatch(/^sb_publishable_[A-Za-z0-9_-]{20,}$/);
    expect(vars.VITE_SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  });
  it('turns on required sign-in and Google sign-in for production builds', () => {
    expect(vars.VITE_REQUIRE_SIGN_IN).toBe('true');
    expect(vars.VITE_GOOGLE_SIGN_IN).toBe('true');
  });
});
