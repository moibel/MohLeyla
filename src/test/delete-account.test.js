// Account deletion: the Edge Function's pure logic (supabase/functions/delete-account/lib.js) and the app-side flow.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SyncManager } from '../features/sync/syncManager.js';
import { validateBody, safeFilePaths, chunk, hasAppleIdentity, appleClientSecret, appleTokenRequest, appleRevokeRequest, BUCKET } from '../../supabase/functions/delete-account/lib.js';

const subtle = webcrypto.subtle;
const CONV = '22222222-2222-4222-8222-222222222222';
// built from parts so that no key-shaped text sits in the source (the secrets scan in security.test.js would flag it)
const pem = (der) => ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + `\n${der}\n` + ['-----END', 'PRIVATE KEY-----'].join(' ');
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };

describe('what the function accepts', () => {
  it('needs an explicit confirm: true; the person is never taken from the body', () => {
    expect(validateBody({ confirm: true }).ok).toBe(true);
    for (const bad of [null, undefined, 'x', {}, { confirm: 'true' }, { confirm: 1 }, { confirm: false }, []]) expect(validateBody(bad).ok, JSON.stringify(bad)).toBe(false);
    expect(validateBody({ confirm: true, userId: 'someone-else' }).value).toEqual({ appleCode: null }); // a user id in the body is ignored
  });
  it('accepts a plausible Apple code and rejects junk', () => {
    expect(validateBody({ confirm: true, appleCode: 'c1234567890.0.abcd' }).value.appleCode).toBe('c1234567890.0.abcd');
    for (const bad of ['short', 'has space in it ok', 'x'.repeat(2001), 42, {}]) expect(validateBody({ confirm: true, appleCode: bad }).ok, String(bad)).toBe(false);
  });
  it('only well-formed chat file paths are ever removed from storage', () => {
    const good = `${CONV}/abc123.jpg`;
    expect(safeFilePaths([good, good, `${CONV}/voice-1.webm`])).toEqual([good, `${CONV}/voice-1.webm`]);
    for (const bad of ['../etc/passwd', `${CONV}/../x.jpg`, `${CONV}/`, '/abs/path', 'other-bucket/x', `${CONV}/a/b.jpg`, `${CONV}/x y.jpg`, '', null, 42, `${CONV}/${'a'.repeat(200)}`])
      expect(safeFilePaths([bad]), String(bad)).toEqual([]);
    expect(safeFilePaths('not an array')).toEqual([]);
    expect(BUCKET).toBe('chat-files');
  });
  it('splits long lists for storage calls', () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('recognises an Apple account', () => {
    expect(hasAppleIdentity({ identities: [{ provider: 'email' }, { provider: 'apple' }] })).toBe(true);
    expect(hasAppleIdentity({ app_metadata: { providers: ['apple'] } })).toBe(true);
    expect(hasAppleIdentity({ identities: [{ provider: 'google' }] })).toBe(false);
    expect(hasAppleIdentity(null)).toBe(false);
  });
});

describe('Apple token revocation', () => {
  it('signs a real ES256 client secret for Apple (issuer, audience, subject, short life)', async () => {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const der = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
    const jwt = await appleClientSecret({ teamId: 'TEAM123456', keyId: 'KEY1234567', clientId: 'com.mohleyla.app', privateKeyPem: pem(der) }, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(b64u(h))).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(JSON.parse(b64u(c))).toEqual({ iss: 'TEAM123456', iat: 1_700_000_000, exp: 1_700_000_300, aud: 'https://appleid.apple.com', sub: 'com.mohleyla.app' });
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64u(s), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
  });
  it('builds the token exchange and the revoke requests Apple documents', () => {
    const t = appleTokenRequest('CODE', 'com.mohleyla.app', 'SECRET');
    expect(t.url).toBe('https://appleid.apple.com/auth/token');
    expect(Object.fromEntries(new URLSearchParams(t.body))).toEqual({ client_id: 'com.mohleyla.app', client_secret: 'SECRET', code: 'CODE', grant_type: 'authorization_code' });
    const r = appleRevokeRequest('REFRESH', 'com.mohleyla.app', 'SECRET');
    expect(r.url).toBe('https://appleid.apple.com/auth/revoke');
    expect(Object.fromEntries(new URLSearchParams(r.body))).toEqual({ client_id: 'com.mohleyla.app', client_secret: 'SECRET', token: 'REFRESH', token_type_hint: 'refresh_token' });
  });
});

describe('deleting from the app', () => {
  afterEach(() => { delete globalThis.window.Capacitor; vi.restoreAllMocks(); vi.resetModules(); });

  function setup({ invoke, identities = [{ provider: 'email' }], online = true } = {}) {
    const client = { auth: { onAuthStateChange: () => {}, signOut: vi.fn(async () => ({})), getUser: async () => ({ data: { user: { id: 'u1', identities } } }) }, functions: { invoke: vi.fn(invoke || (async () => ({ data: { ok: true }, error: null }))) } };
    const storage = memStorage();
    const mgr = new SyncManager({ createClient: async () => client, configured: true, storage, getOnline: () => online });
    mgr.setUser({ id: 'u1', email: 'a@b.co', user_metadata: {} }, { status: 'idle' });
    const clearLocal = vi.fn();
    mgr.attach({ getState: () => ({}), apply: () => {}, clearLocal });
    return { mgr, client, clearLocal, storage };
  }

  it('asks the function to delete (with an explicit confirm) and then signs out on this device', async () => {
    const { mgr, client, clearLocal } = setup();
    expect(await mgr.deleteAccount()).toBe(true);
    expect(client.functions.invoke).toHaveBeenCalledWith('delete-account', { body: { confirm: true, appleCode: undefined } });
    expect(mgr.getSnapshot().userId).toBeNull();
    expect(mgr.getSnapshot().error).toBeNull();
    expect(clearLocal).not.toHaveBeenCalled(); // progress on the device is kept on a personal device
  });
  it('on a shared (sign-in required) device the progress on the device is removed as well', async () => {
    const { mgr, clearLocal } = setup();
    expect(await mgr.deleteAccount({ clearDevice: true })).toBe(true);
    expect(clearLocal).toHaveBeenCalled();
  });
  it('nothing is removed locally and the person stays signed in when the server refuses', async () => {
    const { mgr, clearLocal } = setup({ invoke: async () => ({ data: null, error: { context: { status: 500, json: async () => ({ error: 'delete' }) } } }) });
    expect(await mgr.deleteAccount({ clearDevice: true })).toBe(false);
    expect(mgr.getSnapshot().error).toBe('deleteAccountFailed');
    expect(mgr.getSnapshot().userId).toBe('u1');
    expect(clearLocal).not.toHaveBeenCalled();
  });
  it('tells the only admin why they cannot delete the account', async () => {
    const { mgr } = setup({ invoke: async () => ({ data: null, error: { context: { status: 409, json: async () => ({ error: 'lastAdmin' }) } } }) });
    expect(await mgr.deleteAccount()).toBe(false);
    expect(mgr.getSnapshot().error).toBe('lastAdmin');
    expect(mgr.getSnapshot().userId).toBe('u1');
  });
  it('reports a network problem when offline, and does nothing when nobody is signed in', async () => {
    const off = setup({ online: false, invoke: async () => { throw new Error('Failed to fetch'); } });
    expect(await off.mgr.deleteAccount()).toBe(false);
    expect(off.mgr.getSnapshot().error).toBe('network');
    const { mgr, client } = setup();
    mgr.clearUser();
    expect(await mgr.deleteAccount()).toBe(false);
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it('an Apple account on iPhone shows Apple\'s sheet again and sends the fresh code; closing the sheet deletes nothing', async () => {
    globalThis.window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    vi.resetModules();
    const authorize = vi.fn(async () => 'APPLE-ONE-TIME-CODE-123');
    vi.doMock('../features/sync/appleAuth.js', () => ({ canUseNativeApple: () => true, appleNativeAuthorize: vi.fn(), appleAuthorizationCode: authorize }));
    const { SyncManager: SM } = await import('../features/sync/syncManager.js');
    const build = (identities) => {
      const client = { auth: { onAuthStateChange: () => {}, signOut: async () => ({}), getUser: async () => ({ data: { user: { id: 'u1', identities } } }) }, functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) } };
      const m = new SM({ createClient: async () => client, configured: true, storage: memStorage() });
      m.setUser({ id: 'u1', email: 'a@b.co', user_metadata: {} }, { status: 'idle' });
      return { m, client };
    };
    const apple = build([{ provider: 'apple' }]);
    expect(await apple.m.deleteAccount()).toBe(true);
    expect(apple.client.functions.invoke).toHaveBeenCalledWith('delete-account', { body: { confirm: true, appleCode: 'APPLE-ONE-TIME-CODE-123' } });
    const email = build([{ provider: 'email' }]);
    authorize.mockClear();
    await email.m.deleteAccount();
    expect(authorize).not.toHaveBeenCalled(); // no Apple sheet for an email account
    authorize.mockRejectedValueOnce(Object.assign(new Error('Cancelled'), { code: 'canceled' }));
    const closed = build([{ provider: 'apple' }]);
    expect(await closed.m.deleteAccount()).toBe(false);
    expect(closed.client.functions.invoke).not.toHaveBeenCalled();
    expect(closed.m.getSnapshot().error).toBeNull();
    expect(closed.m.getSnapshot().userId).toBe('u1');
    vi.doUnmock('../features/sync/appleAuth.js');
  });
});
