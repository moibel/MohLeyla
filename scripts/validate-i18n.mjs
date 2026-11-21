// Checks that ar/en/id UI resources have identical keys (modulo plural suffixes), placeholders, and script rules.
import ar from '../src/i18n/ar/ui.js';
import en from '../src/i18n/en/ui.js';
import id from '../src/i18n/id/ui.js';

const PLURAL = /_(zero|one|two|few|many|other)$/;
const errors = [];
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) v.forEach((s, i) => (out[`${key}[${i}]`] = s));
    else if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
const bases = (flat) => new Set(Object.keys(flat).map((k) => k.replace(PLURAL, '')));
const L = { ar: flatten(ar), en: flatten(en), id: flatten(id) };
const all = new Set([...bases(L.ar), ...bases(L.en), ...bases(L.id)]);
const ph = (s) => (String(s).match(/{{\s*\w+\s*}}/g) || []).map((x) => x.replace(/\s/g, '')).sort().join(',');

for (const lang of ['ar', 'en', 'id']) {
  const have = bases(L[lang]);
  for (const b of all) if (!have.has(b)) errors.push(`[${lang}] missing key: ${b}`);
  for (const [k, v] of Object.entries(L[lang])) {
    if (typeof v !== 'string' || !v.trim()) errors.push(`[${lang}] empty value: ${k}`);
    const hasAr = /[؀-ۿ]/.test(v);
    if (lang !== 'ar' && hasAr) errors.push(`[${lang}] Arabic script in ${k}`);
    if (lang === 'ar' && !hasAr && !/^(app\.name|app\.footer|settings\.version)/.test(k) && !/^\{\{/.test(v)) {
      // allow strings made only of placeholders / brand
      if (!/MohLeyla|^\W*\{\{/.test(v)) errors.push(`[ar] no Arabic script in ${k}: ${v}`);
    }
  }
}
// placeholder parity (non-plural keys; plural keys compared against 'other')
for (const b of all) {
  const get = (lang) => L[lang][b] ?? L[lang][b + '_other'];
  const sets = ['ar', 'en', 'id'].map((l) => [l, get(l) !== undefined ? ph(get(l)) : null]);
  const ref = sets.find(([, s]) => s !== null)?.[1];
  for (const [l, s] of sets) if (s !== null && s !== ref && !PLURAL.test(b)) {
    // plural phrases such as "one day" legitimately omit {{count}}; compare only for non-plural bases
    if (!(L[l][b + '_one'] || L[l][b + '_other'])) errors.push(`[${l}] placeholder mismatch in ${b}`);
  }
}
// arabic must define all 6 plural forms wherever it defines any
for (const b of [...bases(L.ar)]) {
  const forms = ['zero', 'one', 'two', 'few', 'many', 'other'].filter((f) => L.ar[`${b}_${f}`] !== undefined);
  if (forms.length && forms.length !== 6) errors.push(`[ar] incomplete plural forms for ${b}: ${forms.join(',')}`);
}
console.log(`i18n keys: ${all.size} base keys across 3 languages.`);
if (errors.length) { console.error(errors.map((e) => ' - ' + e).join('\n')); process.exit(1); }
console.log('i18n OK.');
