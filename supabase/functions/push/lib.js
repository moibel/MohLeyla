// Pure helpers for the push Edge Function (no network, no Deno-only APIs), so they can be unit-tested in Node (src/test/push-function.test.js).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const KINDS = ['chat', 'call', 'announcement', 'reward'];
export const MAX_USERS = 5000;

const TEXT = {
  en: {
    app: 'MohLeyla',
    chat: { text: 'sent you a message', voice: 'sent you a voice note', image: 'sent you a photo' },
    call: { audio: 'is calling you', video: 'is video calling you' },
    announcement: 'New announcement',
    reward: { star: (n) => (n === 1 ? 'You received a star' : `You received ${n} stars`), xp: (n) => `You received ${n} bonus XP`, badge: () => 'You received a badge' },
  },
  ar: {
    app: 'MohLeyla',
    chat: { text: 'أرسل لك رسالة', voice: 'أرسل لك رسالة صوتية', image: 'أرسل لك صورة' },
    call: { audio: 'يتصل بك', video: 'يتصل بك بالفيديو' },
    announcement: 'إعلان جديد',
    reward: { star: (n) => (n === 1 ? 'حصلت على نجمة' : `حصلت على ${n} نجوم`), xp: (n) => `حصلت على ${n} نقطة خبرة إضافية`, badge: () => 'حصلت على وسام' },
  },
  id: {
    app: 'MohLeyla',
    chat: { text: 'mengirim pesan kepadamu', voice: 'mengirim pesan suara kepadamu', image: 'mengirim foto kepadamu' },
    call: { audio: 'menelponmu', video: 'menelponmu lewat video' },
    announcement: 'Pengumuman baru',
    reward: { star: (n) => (n === 1 ? 'Kamu mendapat satu bintang' : `Kamu mendapat ${n} bintang`), xp: (n) => `Kamu mendapat ${n} XP bonus`, badge: () => 'Kamu mendapat lencana' },
  },
};

/** Remove control and angle-bracket characters, collapse spaces, shorten. */
export const clean = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Is the body of the request something this function should act on? Returns { ok, error, value }. */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (!KINDS.includes(body.kind)) return { ok: false, error: 'unknown kind' };
  if (!Array.isArray(body.users) || body.users.length === 0 || body.users.length > MAX_USERS) return { ok: false, error: 'bad users' };
  if (!body.users.every((u) => typeof u === 'string' && UUID.test(u))) return { ok: false, error: 'bad users' };
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) return { ok: false, error: 'bad payload' };
  return { ok: true, value: { kind: body.kind, users: [...new Set(body.users.map((u) => u.toLowerCase()))], payload: body.payload } };
}

const pickLang = (lang) => (TEXT[lang] ? lang : 'en');
const localized = (obj, lang) => (obj && typeof obj === 'object' ? obj[lang] || obj.en || Object.values(obj).find((v) => typeof v === 'string' && v) : '');

/**
 * The notification for one person (in their language). The text of a chat message is never part of it: only who it is from.
 * Returns { title, body, url, kind } where url is an in-app path the app opens when the notification is tapped.
 */
export function buildNotification(kind, payload, langIn) {
  const lang = pickLang(langIn);
  const T = TEXT[lang];
  const p = payload || {};
  if (kind === 'chat' || kind === 'call') {
    const conv = typeof p.conversation === 'string' && UUID.test(p.conversation) ? p.conversation.toLowerCase() : null;
    const name = clean(p.name, 60) || T.app;
    const what = kind === 'chat' ? T.chat[['text', 'voice', 'image'].includes(p.media) ? p.media : 'text'] : T.call[p.media === 'video' ? 'video' : 'audio'];
    return { title: name, body: what, url: conv ? `/chat/${conv}` : '/chat', kind };
  }
  if (kind === 'announcement') return { title: T.app, body: clean(localized(p.title, lang), 100) || T.announcement, url: '/notifications', kind };
  const n = Math.max(1, Math.min(100000, Number.parseInt(p.amount, 10) || 1));
  const k = ['star', 'xp', 'badge'].includes(p.kind) ? p.kind : 'star';
  return { title: T.app, body: T.reward[k](n), url: '/notifications', kind: 'reward' };
}

/** Constant-time string comparison for the shared secret. */
export function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ''));
  const y = new TextEncoder().encode(String(b ?? ''));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ---------------------------------------------------------------- signing (WebCrypto: works in Deno and Node)
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text64 = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
const pemToDer = (pem) => Uint8Array.from(atob(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));

/** Apple push JWT (ES256). The .p8 key from Apple is a PKCS#8 PEM. Valid for up to an hour; Apple wants a fresh one at least hourly. */
export async function apnsJwt({ teamId, keyId, privateKeyPem }, nowSeconds) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(privateKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const unsigned = `${text64({ alg: 'ES256', kid: keyId })}.${text64({ iss: teamId, iat: nowSeconds })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`; // WebCrypto returns r||s, which is what JWS wants
}

export function apnsRequest(deviceToken, n, { topic, sandbox = false, jwt }) {
  const urgent = n.kind === 'chat' || n.kind === 'call';
  return {
    url: `https://${sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'}/3/device/${deviceToken}`,
    headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': urgent ? '10' : '5', 'apns-expiration': String(Math.floor(Date.now() / 1000) + (n.kind === 'call' ? 60 : 86400)), 'content-type': 'application/json' },
    body: JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: 'default', 'thread-id': n.kind }, url: n.url, kind: n.kind }),
  };
}

/** Google service-account assertion (RS256) to exchange for an access token at https://oauth2.googleapis.com/token. */
export async function fcmAssertion({ client_email, private_key, token_uri = 'https://oauth2.googleapis.com/token' }, nowSeconds) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${text64({ alg: 'RS256', typ: 'JWT' })}.${text64({ iss: client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: token_uri, iat: nowSeconds, exp: nowSeconds + 3600 })}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

export function fcmRequest(deviceToken, n, { projectId, accessToken }) {
  const urgent = n.kind === 'chat' || n.kind === 'call';
  return {
    url: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { token: deviceToken, notification: { title: n.title, body: n.body }, data: { url: n.url, kind: n.kind }, android: { priority: urgent ? 'HIGH' : 'NORMAL', notification: { channel_id: n.kind === 'call' ? 'calls' : 'messages', sound: 'default' } } } }),
  };
}

/** Did the push service say this device token is permanently gone (app removed, token expired)? Then we delete it. */
export function isDeadToken(platform, status, json) {
  if (platform === 'ios') return status === 410 || (status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(json?.reason)) || json?.reason === 'Unregistered';
  const code = json?.error?.details?.find?.((d) => d?.errorCode)?.errorCode;
  return status === 404 || code === 'UNREGISTERED';
}
