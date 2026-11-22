// Fails the build check when the files needed for the first screen grow past a budget, or when the (large, optional)
// Supabase library sneaks into them. Run after `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist');
// js was 150 kB until the lesson index reached 240 lessons (about 11 kB more of titles and item ids on the first screen); now 160 kB.
const BUDGET = { js: 160 * 1024, css: 15 * 1024 }; // gzip bytes
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
if (!refs.length) { console.error('check-bundle-size: no assets found in dist/index.html (run npm run build first)'); process.exit(1); }

let js = 0; let css = 0; const problems = [];
for (const ref of new Set(refs)) {
  const buf = fs.readFileSync(path.join(dist, ref));
  const gz = zlib.gzipSync(buf).length;
  if (ref.endsWith('.css')) css += gz; else js += gz;
  if (buf.includes('@supabase/supabase-js')) problems.push(`${ref} contains the Supabase library: it must stay a lazily loaded chunk`);
}
const kb = (n) => (n / 1024).toFixed(1) + ' kB';
console.log(`First-screen assets (gzip): JS ${kb(js)} of ${kb(BUDGET.js)}, CSS ${kb(css)} of ${kb(BUDGET.css)}`);
if (js > BUDGET.js) problems.push(`JavaScript for the first screen is ${kb(js)}, over the ${kb(BUDGET.js)} budget`);
if (css > BUDGET.css) problems.push(`CSS for the first screen is ${kb(css)}, over the ${kb(BUDGET.css)} budget`);
if (problems.length) { console.error('Bundle budget failed:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('Bundle budget OK.');
