// Pure helpers for the delete-account Edge Function (unit-tested in src/test/delete-account.test.js).

export const BUCKET = 'chat-files';
const FILE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,120}$/;

/** The request must say "confirm: true" and may carry the one-time code from Apple's sign-in sheet. */
export function validateBody(body) {
  if (!body || typeof body !== 'object' || body.confirm !== true) return { ok: false, error: 'confirm' };
  const code = body.appleCode;
  if (code !== undefined && code !== null && (typeof code !== 'string' || code.length < 10 || code.length > 2000 || /\s/.test(code))) return { ok: false, error: 'appleCode' };
  return { ok: true, value: { appleCode: code || null } };
}

/** Only well-formed chat file paths (<conversation uuid>/<file name>) are ever sent to storage for removal. */
export const safeFilePaths = (paths) => (Array.isArray(paths) ? [...new Set(paths.filter((p) => typeof p === 'string' && FILE_PATH.test(p)))] : []);

export const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

export const hasAppleIdentity = (user) => !!(user?.identities || []).some((i) => i?.provider === 'apple') || (user?.app_metadata?.providers || []).includes('apple');

// ---------------------------------------------------------------- Apple token revocation (App Store rule: deleting an account must revoke Sign in with Apple)
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text64 = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
const pemToDer = (pem) => Uint8Array.from(atob(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));

/** The "client secret" Apple wants: a short-lived ES256 token signed with your Sign in with Apple key. */
export async function appleClientSecret({ teamId, keyId, clientId, privateKeyPem }, nowSeconds) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(privateKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const unsigned = `${text64({ alg: 'ES256', kid: keyId })}.${text64({ iss: teamId, iat: nowSeconds, exp: nowSeconds + 300, aud: 'https://appleid.apple.com', sub: clientId })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

const form = (o) => new URLSearchParams(o).toString();
export const appleTokenRequest = (code, clientId, clientSecret) => ({ url: 'https://appleid.apple.com/auth/token', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }) });
export const appleRevokeRequest = (refreshToken, clientId, clientSecret) => ({ url: 'https://appleid.apple.com/auth/revoke', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ client_id: clientId, client_secret: clientSecret, token: refreshToken, token_type_hint: 'refresh_token' }) });
