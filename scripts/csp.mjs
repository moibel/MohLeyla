// The Content-Security-Policy: what the app may load. One definition used by the build (a <meta> tag, so it also protects the store apps),
// the hosting headers (public/_headers, netlify.toml) and the security test, so they cannot drift apart.
//   - scripts only from the app itself (no inline script, no eval): an injected <script> or an attacker's script URL does not run
//   - network only to the app, its Supabase project and (store apps) the audio host
//   - 'unsafe-inline' for STYLES only (React inline style attributes and the boot screen); never for scripts
export function buildCsp({ supabaseUrl = '', audioBase = '', header = false } = {}) {
  const supa = /^https:\/\/[\w.-]+$/.test(supabaseUrl) ? [supabaseUrl, supabaseUrl.replace('https://', 'wss://')] : [];
  const audio = /^https:\/\/[\w.-]+$/.test(audioBase) ? [audioBase] : [];
  const d = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...supa.slice(0, 1), 'https://lh3.googleusercontent.com'], // Google profile pictures
    'media-src': ["'self'", 'blob:', ...supa.slice(0, 1), ...audio],
    'connect-src': ["'self'", ...supa, ...audio],
    'font-src': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  if (header) d['frame-ancestors'] = ["'none'"]; // not allowed in a <meta> tag, so headers only
  return Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}
