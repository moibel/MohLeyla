// Tests for the push Edge Function's pure logic (supabase/functions/push/lib.js): what a notification says, who may call it,
// and that the Apple / Google signatures are real (checked with freshly generated keys).
import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { buildNotification, validateRequest, safeEqual, apnsJwt, apnsRequest, fcmAssertion, fcmRequest, isDeadToken } from '../../supabase/functions/push/lib.js';

const subtle = webcrypto.subtle;
const U1 = '11111111-1111-4111-8111-111111111111';
const CONV = '22222222-2222-4222-8222-222222222222';
const pem = (der, label) => `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

describe('notification text', () => {
  it('a chat notification names the sender and the kind of message, in the reader\'s language, and opens that chat', () => {
    expect(buildNotification('chat', { name: 'Sara', conversation: CONV, media: 'text' }, 'en')).toEqual({ title: 'Sara', body: 'sent you a message', url: `/chat/${CONV}`, kind: 'chat' });
    expect(buildNotification('chat', { name: 'سارة', conversation: CONV, media: 'voice' }, 'ar').body).toBe('أرسل لك رسالة صوتية');
    expect(buildNotification('chat', { name: 'Sari', conversation: CONV, media: 'image' }, 'id').body).toBe('mengirim foto kepadamu');
  });
  it('NEVER puts message text in a notification, even if it is passed in by mistake', () => {
    const n = buildNotification('chat', { name: 'Sara', conversation: CONV, media: 'text', body: 'my secret 4711', text: 'my secret 4711' }, 'en');
    expect(JSON.stringify(n)).not.toContain('4711');
  });
  it('a call says who is calling and whether it is video', () => {
    expect(buildNotification('call', { name: 'Tariq', conversation: CONV, media: 'video' }, 'en').body).toBe('is video calling you');
    expect(buildNotification('call', { name: 'Tariq', conversation: CONV, media: 'audio' }, 'en').body).toBe('is calling you');
  });
  it('announcements use the title in the reader\'s language, then English, then any', () => {
    const title = { en: 'Hello', ar: 'مرحبا' };
    expect(buildNotification('announcement', { title }, 'ar').body).toBe('مرحبا');
    expect(buildNotification('announcement', { title }, 'id').body).toBe('Hello');
    expect(buildNotification('announcement', { title: { ar: 'فقط' } }, 'id').body).toBe('فقط');
    expect(buildNotification('announcement', {}, 'en').body).toBe('New announcement');
  });
  it('rewards say what was received, without the reason', () => {
    expect(buildNotification('reward', { kind: 'star', amount: 3, reason: 'secret' }, 'en').body).toBe('You received 3 stars');
    expect(buildNotification('reward', { kind: 'xp', amount: 50 }, 'id').body).toBe('Kamu mendapat 50 XP bonus');
    expect(buildNotification('reward', { kind: 'badge', amount: 1 }, 'en').body).toBe('You received a badge');
    expect(JSON.stringify(buildNotification('reward', { kind: 'star', amount: 1, reason: 'secret' }, 'en'))).not.toContain('secret');
  });
  it('an unknown language falls back to English; names are cleaned and shortened; the link cannot be steered', () => {
    expect(buildNotification('chat', { name: 'A', conversation: CONV }, 'xx').body).toBe('sent you a message');
    const n = buildNotification('chat', { name: `<b>Bob</b>\n\u0007${'x'.repeat(200)}`, conversation: '../../admin' }, 'en');
    expect(n.title).not.toMatch(/[<>\n\u0007]/);
    expect(n.title.length).toBeLessThanOrEqual(60);
    expect(n.url).toBe('/chat'); // a conversation that is not a uuid is ignored
  });
  it('every tap target is an in-app path', () => {
    for (const k of ['chat', 'call', 'announcement', 'reward']) expect(buildNotification(k, { conversation: CONV }, 'en').url).toMatch(/^\/[a-z]/);
  });
});

describe('who may call the function and with what', () => {
  it('accepts a well-formed request and removes duplicate users', () => {
    const r = validateRequest({ kind: 'chat', users: [U1, U1.toUpperCase()], payload: { name: 'x' } });
    expect(r.ok).toBe(true);
    expect(r.value.users).toEqual([U1]);
  });
  it('rejects unknown kinds, empty or huge or malformed user lists, and non-object payloads', () => {
    for (const bad of [null, 'x', { kind: 'spam', users: [U1], payload: {} }, { kind: 'chat', users: [], payload: {} }, { kind: 'chat', users: ['not-a-uuid'], payload: {} },
      { kind: 'chat', users: [U1, "'; drop table x"], payload: {} }, { kind: 'chat', users: Array(5001).fill(U1), payload: {} }, { kind: 'chat', users: [U1], payload: [] }, { kind: 'chat', users: [U1] }])
      expect(validateRequest(bad).ok, JSON.stringify(bad)?.slice(0, 60)).toBe(false);
  });
  it('compares the shared secret without leaking its length or content', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(null, 'abc')).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(true); // both missing: the function itself refuses when no secret is configured
  });
});

describe('Apple push', () => {
  it('signs a real ES256 token Apple can verify, with the key id and team id', async () => {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const p8 = pem(await subtle.exportKey('pkcs8', kp.privateKey), 'PRIVATE KEY');
    const jwt = await apnsJwt({ teamId: 'TEAM123456', keyId: 'KEY1234567', privateKeyPem: p8 }, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(b64u(h))).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(JSON.parse(b64u(c))).toEqual({ iss: 'TEAM123456', iat: 1_700_000_000 });
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64u(s), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
    expect(jwt).not.toMatch(/[+/=]/);
  });
  it('builds the request: right host, topic, priority, and only title/body/url in the payload', () => {
    const n = buildNotification('call', { name: 'Tariq', conversation: CONV, media: 'audio' }, 'en');
    const r = apnsRequest('ab'.repeat(32), n, { topic: 'com.mohleyla.app', jwt: 'J' });
    expect(r.url).toBe(`https://api.push.apple.com/3/device/${'ab'.repeat(32)}`);
    expect(r.headers).toMatchObject({ authorization: 'bearer J', 'apns-topic': 'com.mohleyla.app', 'apns-push-type': 'alert', 'apns-priority': '10' });
    expect(JSON.parse(r.body)).toEqual({ aps: { alert: { title: 'Tariq', body: 'is calling you' }, sound: 'default', 'thread-id': 'call' }, url: `/chat/${CONV}`, kind: 'call' });
    expect(apnsRequest('t', n, { topic: 'x', sandbox: true, jwt: 'J' }).url).toContain('api.sandbox.push.apple.com');
    expect(apnsRequest('t', buildNotification('reward', {}, 'en'), { topic: 'x', jwt: 'J' }).headers['apns-priority']).toBe('5');
  });
});

describe('Google (FCM) push', () => {
  it('signs a real RS256 service-account assertion for the messaging scope', async () => {
    const kp = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const sa = { client_email: 'push@proj.iam.gserviceaccount.com', private_key: pem(await subtle.exportKey('pkcs8', kp.privateKey), 'PRIVATE KEY') };
    const jwt = await fcmAssertion(sa, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(b64u(h))).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(b64u(c))).toEqual({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(await subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, b64u(s), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
  });
  it('builds the request with a channel, high priority for chat, and data the app uses to open the right screen', () => {
    const r = fcmRequest('tok', buildNotification('chat', { name: 'Sara', conversation: CONV }, 'en'), { projectId: 'proj', accessToken: 'AT' });
    expect(r.url).toBe('https://fcm.googleapis.com/v1/projects/proj/messages:send');
    expect(r.headers.authorization).toBe('Bearer AT');
    const m = JSON.parse(r.body).message;
    expect(m).toMatchObject({ token: 'tok', notification: { title: 'Sara', body: 'sent you a message' }, data: { url: `/chat/${CONV}`, kind: 'chat' }, android: { priority: 'HIGH', notification: { channel_id: 'messages' } } });
  });
});

describe('dead tokens', () => {
  it('only permanent "this phone is gone" answers delete a token, never a temporary failure', () => {
    expect(isDeadToken('ios', 410, { reason: 'Unregistered' })).toBe(true);
    expect(isDeadToken('ios', 400, { reason: 'BadDeviceToken' })).toBe(true);
    expect(isDeadToken('ios', 429, { reason: 'TooManyRequests' })).toBe(false);
    expect(isDeadToken('ios', 500, { reason: 'InternalServerError' })).toBe(false);
    expect(isDeadToken('ios', 403, { reason: 'ExpiredProviderToken' })).toBe(false); // our key problem, not the phone's
    expect(isDeadToken('android', 404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
    expect(isDeadToken('android', 400, { error: { status: 'INVALID_ARGUMENT' } })).toBe(false);
    expect(isDeadToken('android', 503, {})).toBe(false);
    expect(isDeadToken('android', 401, null)).toBe(false);
  });
});
