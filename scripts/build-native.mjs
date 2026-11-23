// Builds the web app for the iOS / Android shells into dist-native/ and copies it into the native projects.
//   - no service worker (the app itself is the install), and the 50 MB of audio is NOT bundled: clips are fetched on demand from the website.
//   - the Supabase address and public key come from .env.production as usual.
// Usage: npm run build:native            (then: npm run ios   or   npm run android)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const AUDIO_HOST = process.env.NATIVE_AUDIO_BASE || 'https://mohleyla.pages.dev';
if (!/^https:\/\/[\w.-]+$/.test(AUDIO_HOST)) { console.error('NATIVE_AUDIO_BASE must be an https origin, got: ' + AUDIO_HOST); process.exit(1); }
const env = { ...process.env, VITE_NATIVE: 'true', VITE_AUDIO_BASE: AUDIO_HOST };
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env }); if (r.status !== 0) process.exit(r.status || 1); };

run('node', ['scripts/build-manifest.mjs']);
run('npx', ['vite', 'build', '--outDir', 'dist-native', '--emptyOutDir']);
fs.rmSync('dist-native/audio', { recursive: true, force: true });
const size = (d) => fs.readdirSync(d, { recursive: true }).reduce((n, f) => { try { const s = fs.statSync(`${d}/${f}`); return n + (s.isFile() ? s.size : 0); } catch { return n; } }, 0);
console.log(`dist-native ready (${(size('dist-native') / 1048576).toFixed(1)} MB, audio streamed from ${AUDIO_HOST}).`);
if (process.argv.includes('--sync')) run('npx', ['cap', 'sync']);
