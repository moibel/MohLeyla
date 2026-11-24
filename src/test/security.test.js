// Security checks that run on every `npm test`: secrets, the content security policy, risky code patterns, the Android and iOS
// project settings, the app's sign-in link, and the database rules (row level security, safe functions).
// These are static checks; the live behaviour is covered by the browser tests and supabase/tests/*.sql.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsp } from '../../scripts/csp.mjs';
import { parseNativeAuthUrl, NATIVE_AUTH_REDIRECT } from '../utils/platform.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};
const sourceFiles = walk('src').filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.startsWith('src/test'));
const env = Object.fromEntries(read('.env.production').split('\n').filter((l) => /^VITE_\w+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]));

describe('secrets', () => {
  const scan = ['src', 'public', 'ios/App/App', 'android/app/src', 'scripts', 'index.html', '.env.production', 'capacitor.config.json', 'netlify.toml', 'wrangler.jsonc']
    .filter(exists)
    .flatMap((p) => (fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : [p]))
    .filter((f) => /\.(jsx?|mjs|json|html|toml|jsonc|plist|xml|gradle|swift|java|kt|env\w*|js)$/.test(f) || f.endsWith('.env.production'));
  it('no service-role or secret key is shipped in the app, the native projects or the settings files', () => {
    for (const f of scan) {
      if (f.endsWith('manifest.json') || f.includes('src/data/content')) continue;
      const text = read(f);
      expect(text, f).not.toMatch(/sb_secret_[A-Za-z0-9_-]{10,}/);
      expect(text, f).not.toMatch(/\bsk_[a-f0-9]{32,}\b/); // ElevenLabs API key
      for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
        expect(payload.role, `${f} contains a JWT with role ${payload.role}`).not.toBe('service_role');
      }
      expect(text, f).not.toMatch(/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/);
      expect(text, f).not.toMatch(/AKIA[0-9A-Z]{16}/);
    }
  });
  it('the committed public key is the publishable kind', () => {
    const k = env.VITE_SUPABASE_ANON_KEY || '';
    if (k.startsWith('eyJ')) expect(JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role).toBe('anon');
    else expect(k).toMatch(/^sb_publishable_/);
  });
  it('local env files and native signing keys are git-ignored', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env\.local$/m);
    expect(ignore).toMatch(/^dist-native$/m);
    expect(walk('.').filter((f) => /\.(jks|keystore|p12|mobileprovision)$/.test(f) && !f.startsWith('node_modules'))).toEqual([]);
  });
});

describe('content security policy', () => {
  const csp = buildCsp({ supabaseUrl: env.VITE_SUPABASE_URL, audioBase: 'https://mohleyla.pages.dev', header: true });
  const directive = (name) => (csp.split('; ').find((d) => d.startsWith(name + ' ')) || '').split(' ').slice(1);
  it('allows scripts only from the app itself: no inline script, no eval, no other host', () => {
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(csp).not.toMatch(/unsafe-eval|\*|data:.*script|http:/);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });
  it('network access is limited to the app, its Supabase project and the audio host', () => {
    expect(directive('connect-src')).toEqual(["'self'", env.VITE_SUPABASE_URL, env.VITE_SUPABASE_URL.replace('https://', 'wss://'), 'https://mohleyla.pages.dev']);
  });
  it('refuses a malformed host instead of widening the policy', () => {
    expect(buildCsp({ supabaseUrl: "https://x.co; script-src *", audioBase: 'http://insecure.example' })).toBe(buildCsp({}));
  });
  it('the hosting headers carry exactly the same policy as the build', () => {
    const expected = buildCsp({ supabaseUrl: env.VITE_SUPABASE_URL, header: true });
    expect(read('public/_headers')).toContain(`Content-Security-Policy: ${expected}`);
    expect(read('netlify.toml')).toContain(`Content-Security-Policy = "${expected}"`);
    for (const h of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Strict-Transport-Security']) expect(read('public/_headers')).toContain(h);
  });
  it('a built page carries the policy as a meta tag (so it also protects the store apps)', () => {
    for (const dir of ['dist', 'dist-native']) {
      if (!exists(`${dir}/index.html`)) continue;
      expect(read(`${dir}/index.html`), dir).toMatch(/http-equiv="Content-Security-Policy"/);
    }
  });
});

describe('risky code patterns', () => {
  it('no eval, new Function, document.write, innerHTML or dangerouslySetInnerHTML in the app', () => {
    for (const f of sourceFiles) {
      const code = read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, f).not.toMatch(/\beval\s*\(|new Function\s*\(|document\.write\s*\(|\.innerHTML\s*=|dangerouslySetInnerHTML|insertAdjacentHTML/);
    }
  });
  it('no http:// address is called by the app (everything is https/wss)', () => {
    for (const f of sourceFiles) {
      const code = read(f).replace(/\/\/.*$/gm, '');
      for (const m of code.match(/['"`]http:\/\/[^'"`]+['"`]/g) || []) expect(m, f).toMatch(/localhost|127\.0\.0\.1|www\.w3\.org/);
    }
  });
  it('the service-role key is never read from the environment in app code', () => {
    for (const f of sourceFiles) expect(read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), f).not.toMatch(/service_role|SERVICE_ROLE/);
  });
});

describe('the sign-in link of the app', () => {
  const good = `${NATIVE_AUTH_REDIRECT}#access_token=aaa&refresh_token=bbb&type=bearer`;
  it('accepts only the app\'s own link', () => {
    expect(parseNativeAuthUrl(good)).toEqual({ access_token: 'aaa', refresh_token: 'bbb' });
    expect(parseNativeAuthUrl(`${NATIVE_AUTH_REDIRECT}?code=abc123`)).toEqual({ code: 'abc123' });
  });
  it('rejects lookalikes, other schemes and tricks', () => {
    for (const bad of [
      'https://auth/#access_token=a&refresh_token=b',
      'com.mohleyla.app://auth.evil.com#access_token=a&refresh_token=b',
      'com.mohleyla.app://evil@auth#access_token=a&refresh_token=b',
      'com.mohleyla.app://auth:99#access_token=a&refresh_token=b',
      'com.mohleyla.app.evil://auth#access_token=a&refresh_token=b',
      'com.mohleyla.app://other#access_token=a&refresh_token=b',
      'javascript:alert(1)',
      `${NATIVE_AUTH_REDIRECT}#access_token=only-one`,
      `${NATIVE_AUTH_REDIRECT}`,
      '',
      null,
      undefined,
    ]) expect(parseNativeAuthUrl(bad), String(bad)).toBeNull();
  });
});

describe('Android project', () => {
  const manifest = () => read('android/app/src/main/AndroidManifest.xml');
  it('has no backups, no plain-http traffic, no debugging, and only the launcher screen is reachable from other apps', () => {
    const m = manifest();
    expect(m).toMatch(/android:allowBackup="false"/);
    expect(m).toMatch(/android:usesCleartextTraffic="false"/);
    expect(m).not.toMatch(/android:debuggable="true"/);
    expect(m.match(/android:exported="true"/g)).toHaveLength(1);
    expect(read('android/app/src/main/res/xml/data_extraction_rules.xml')).toMatch(/<cloud-backup>[\s\S]*<exclude domain="sharedpref"/);
  });
  it('asks only for the permissions the app uses', () => {
    const perms = [...manifest().matchAll(/<uses-permission android:name="android\.permission\.(\w+)"/g)].map((x) => x[1]).sort();
    expect(perms).toEqual(['CAMERA', 'INTERNET', 'MODIFY_AUDIO_SETTINGS', 'POST_NOTIFICATIONS', 'RECORD_AUDIO']);
  });
  it('registers only its own sign-in link scheme', () => {
    const schemes = [...manifest().matchAll(/android:scheme="([^"]+)"/g)].map((x) => x[1]);
    expect(schemes).toEqual(['com.mohleyla.app']);
  });
});

describe('iOS project', () => {
  const plist = () => read('ios/App/App/Info.plist');
  it('keeps App Transport Security on (no plain-http exceptions)', () => {
    expect(plist()).not.toMatch(/NSAppTransportSecurity|NSAllowsArbitraryLoads/);
  });
  it('explains every permission it asks for, and declares standard encryption only', () => {
    const p = plist();
    for (const k of ['NSMicrophoneUsageDescription', 'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']) expect(p).toContain(k);
    expect(p).toMatch(/ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
    expect([...p.matchAll(/<string>(com\.mohleyla\.app)<\/string>/g)].length).toBeGreaterThan(0);
    expect(p).not.toMatch(/NSLocation|NSContacts|NSBluetooth/);
  });
});

describe('push notifications and Sign in with Apple', () => {
  it('iOS has the push and Sign in with Apple capabilities, and only the background mode push needs', () => {
    const ent = read('ios/App/App/App.entitlements');
    expect(ent).toContain('aps-environment');
    expect(ent).toContain('com.apple.developer.applesignin');
    expect(read('ios/App/App.xcodeproj/project.pbxproj').match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)).toHaveLength(2);
    const modes = [...read('ios/App/App/Info.plist').matchAll(/UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/g)].flatMap((m) => [...m[1].matchAll(/<string>([^<]+)<\/string>/g)].map((x) => x[1]));
    expect(modes).toEqual(['remote-notification']);
  });
  it('the Apple sign-in plugin always sends a nonce to Apple and never logs tokens', () => {
    const swift = read('ios/App/App/AppleSignInPlugin.swift');
    expect(swift).toMatch(/request\.nonce = nonce/);
    // regression: the scene delegate must create OUR view controller, or the plugin is never registered (found in the simulator)
    expect(read('ios/App/App/SceneDelegate.swift')).toMatch(/rootViewController = MainViewController\(\)/);
    expect(read('ios/App/App/MainViewController.swift')).toMatch(/registerPluginInstance\(AppleSignInPlugin\(\)\)/);
    expect(swift).not.toMatch(/print\(|NSLog\(/);
    for (const f of ['src/features/push/pushService.js', 'src/features/sync/appleAuth.js', 'src/features/sync/syncManager.js']) expect(read(f).replace(/\/\/.*$/gm, ''), f).not.toMatch(/console\.(log|info|debug)/);
  });
  it('every push trigger swallows its own errors, so a push problem can never block a message, call, announcement or reward', () => {
    const sql = read('supabase/migrations/011_push.sql');
    const triggers = sql.split(/create or replace function /i).filter((b) => /^public\.push_on_/.test(b));
    expect(triggers).toHaveLength(4);
    for (const b of triggers) expect(b.split(/\nend \$\$;/)[0], b.slice(0, 40)).toMatch(/exception when others then null/);
  });
  it('the Edge Function checks the shared secret before it reads anything, and the secret is only read from the environment', () => {
    const fn = read('supabase/functions/push/index.ts');
    expect(fn.indexOf('safeEqual(')).toBeGreaterThan(-1);
    expect(fn.indexOf('safeEqual(')).toBeLessThan(fn.indexOf('req.json()'));
    expect(fn).not.toMatch(/PUSH_SECRET\s*=\s*['"]/);
    expect(fn).not.toMatch(/BEGIN (EC |RSA )?PRIVATE KEY/);
  });
  it('the notification builder never reads a message body', () => {
    expect(read('supabase/functions/push/lib.js')).not.toMatch(/payload\.(body|text)|p\.(body|text)\b/);
  });
});

describe('account deletion', () => {
  const fn = () => read('supabase/functions/delete-account/index.ts');
  it('the person is whoever the sign-in token says: the function never reads a user id from the request', () => {
    expect(fn()).toMatch(/auth\.getUser\(jwt\)/);
    expect(fn()).not.toMatch(/body\.(userId|user_id|id)\b|\.userId\b/);
    expect(fn().indexOf('getUser(jwt)')).toBeLessThan(fn().indexOf('req.json()'));
    expect(fn()).toMatch(/\.deleteUser\(user\.id\)/);
  });
  it('the database helpers can only be used by the service role (never by signed-in people, admins or visitors)', () => {
    const sql = read('supabase/migrations/012_account_deletion.sql');
    expect(sql).toMatch(/revoke all on function public\.account_delete_prepare\(uuid\), public\.account_delete_cleanup\(text\) from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*\b(authenticated|anon|public)\b/i);
    expect(sql).toMatch(/set search_path/);
  });
  it('the platform JWT switch is off for this function, so the function itself must refuse everything that is not a verified person', () => {
    expect(read('docs/ACCOUNT_DELETION.md')).toMatch(/delete-account --no-verify-jwt/);
    expect(fn()).toMatch(/if \(!jwt\) return json\(401/);
    expect(fn()).toMatch(/whoErr \|\| !who\?\.user\) return json\(401/);
  });
  it('removes only well-formed chat file paths, and Apple keys come only from the environment', () => {
    expect(fn()).toMatch(/safeFilePaths\(paths\)/);
    expect(fn()).not.toMatch(/BEGIN (EC |RSA )?PRIVATE KEY/);
    expect(fn()).not.toMatch(/console\.(log|info)\(/);
  });
  it('a public page explains how to delete an account without signing in (Google Play asks for a web link)', () => {
    const page = read('public/delete-account.html');
    expect(page).toMatch(/Settings/);
    expect(page).not.toMatch(/<script/i);
  });
});

describe('Capacitor settings', () => {
  const cfg = JSON.parse(read('capacitor.config.json'));
  it('loads the bundled app only: no remote server, no plain http, no extra navigation, no debugging', () => {
    expect(cfg.server.url).toBeUndefined();
    expect(cfg.server.allowNavigation).toBeUndefined();
    expect(cfg.server.cleartext).toBe(false);
    expect(cfg.android.allowMixedContent).toBe(false);
    expect(cfg.android.webContentsDebuggingEnabled).toBe(false);
    expect(cfg.loggingBehavior).toBe('none');
  });
  it('the store build has no service worker and does not bundle the audio', () => {
    if (!exists('dist-native/index.html')) return; // run `npm run build:native` first to check this
    expect(exists('dist-native/sw.js')).toBe(false);
    expect(exists('dist-native/audio')).toBe(false);
  });
});

describe('database rules (supabase/migrations)', () => {
  const sql = fs.readdirSync(path.join(root, 'supabase/migrations')).sort().map((f) => read(`supabase/migrations/${f}`)).join('\n');
  it('every table in the public schema has row level security switched on', () => {
    const tables = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(10);
    for (const t of new Set(tables)) expect(sql, `table ${t}`).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`, 'i'));
  });
  it('every security-definer function pins its search_path (prevents function hijacking)', () => {
    const fns = sql.split(/create (?:or replace )?function /i).slice(1).filter((b) => /security definer/i.test(b.split(/\$\$/)[0] + (b.split(/\n/).slice(0, 4).join('\n'))));
    expect(fns.length).toBeGreaterThan(30);
    for (const b of fns) expect(b.split(/\$\$/)[0] + b.split('\n').slice(0, 5).join('\n'), b.slice(0, 60)).toMatch(/set search_path/i);
  });
  it('admin, teacher and chat functions are never granted to anonymous visitors', () => {
    for (const m of sql.matchAll(/grant execute on function([\s\S]*?);/gi)) {
      if (!/\bto\b[^;]*\banon\b/i.test(m[0])) continue;
      expect(m[0], 'anon grant').not.toMatch(/admin_|teacher_|chat|call|reward|start_|send_|my_/i);
    }
  });
  it('tables hold no direct access for signed-in users where the app goes through checked functions', () => {
    for (const t of ['rewards', 'conversations', 'chat_messages', 'calls', 'call_signals', 'chat_reads', 'push_tokens', 'push_config']) expect(sql, t).toMatch(new RegExp(`revoke all on[^;]*public\\.${t}\\b[^;]*from anon, authenticated`, 'i'));
  });
});
