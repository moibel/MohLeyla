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
  it('allows the camera for the app itself (video calls) and keeps geolocation disabled', () => {
    const policy = toml.match(/Permissions-Policy\s*=\s*"([^"]*)"/)[1];
    expect(policy).toMatch(/camera=\(self\)/);
    expect(policy).not.toMatch(/camera=\(\)/);
    expect(policy).toMatch(/geolocation=\(\)/);
  });
});

// Cloudflare (and Netlify) read public/_headers; netlify.toml is only read by Netlify. The two must agree on the microphone policy.
describe('public/_headers (Cloudflare)', () => {
  const headers = fs.readFileSync(path.resolve(__dirname, '../../public/_headers'), 'utf8');
  it('allows the microphone and camera for the app (speaking practice, video calls) and keeps geolocation off', () => {
    const m = headers.match(/Permissions-Policy:\s*(.*)/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/microphone=\(self\)/);
    expect(m[1]).toMatch(/camera=\(self\)/);
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

// Regression: the audio clip list was cached "immutable" for a year, so browsers kept an old copy and the new languages' recordings were never used.
describe('audio caching', () => {
  const headers = fs.readFileSync(path.resolve(__dirname, '../../public/_headers'), 'utf8');
  const toml = fs.readFileSync(path.resolve(__dirname, '../../netlify.toml'), 'utf8');
  const block = (text, p) => (text.split(/\n(?=\S)/).find((b) => b.startsWith(p + '\n')) || '');
  const LANGS = ['ar', 'en', 'id', 'fr', 'es', 'zh', 'eg'];
  it('the list of clips (manifest.json) is always revalidated, never cached forever', () => {
    expect(block(headers, '/audio/manifest.json')).toMatch(/Cache-Control: no-cache/);
    expect(toml).toMatch(/for = "\/audio\/manifest\.json"\s+\[headers\.values\]\s+Cache-Control = "no-cache"/);
  });
  it('no rule that also matches manifest.json (like /audio/*) may set a long cache', () => {
    expect(block(headers, '/audio/*')).not.toMatch(/Cache-Control/);
    expect(toml.match(/for = "\/audio\/\*"\s+\[headers\.values\]([^[]*)/)[1]).not.toMatch(/Cache-Control/);
  });
  it('the clips themselves (named by a hash of their text) are cached for a year, for every language', () => {
    for (const l of LANGS) {
      expect(block(headers, `/audio/${l}/*`), l).toMatch(/Cache-Control: public, max-age=31536000, immutable/);
      expect(toml).toContain(`for = "/audio/${l}/*"`);
    }
  });
  it('every audio folder that exists has a caching rule (a new language must not silently lose its cache or CORS header)', () => {
    const dirs = fs.readdirSync(path.resolve(__dirname, '../../public/audio'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const d of dirs) expect(LANGS, `public/audio/${d} has no cache rule in _headers / netlify.toml`).toContain(d);
  });
  it('clips can be fetched cross-origin (the phone apps load them from the website)', () => {
    expect(block(headers, '/audio/*')).toMatch(/Access-Control-Allow-Origin: \*/);
  });
});
