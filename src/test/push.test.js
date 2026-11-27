// Phone-side push logic and Sign in with Apple, tested without a phone: the plugins and the network are replaced by fakes.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PushService, safeAppPath, PUSH_PREF_KEY } from '../features/push/pushService.js';
import { SyncManager } from '../features/sync/syncManager.js';
import { randomNonce, sha256Hex } from '../features/sync/appleAuth.js';

const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const TOKEN = 'a1b2c3d4'.repeat(8);
const CONV = '22222222-2222-4222-8222-222222222222';

/** A fake @capacitor/push-notifications plugin that hands back a token after register(). */
function fakePlugin({ receive = 'prompt', granted = 'granted', token = TOKEN, fail = false } = {}) {
  const listeners = {};
  const p = {
    perm: receive, listeners, registered: 0, channels: [],
    checkPermissions: async () => ({ receive: p.perm }),
    requestPermissions: async () => { p.perm = granted; return { receive: granted }; },
    addListener: async (name, fn) => { listeners[name] = fn; return { remove: () => { delete listeners[name]; } }; },
    register: async () => { p.registered++; setTimeout(() => (fail ? listeners.registrationError?.({ error: 'no' }) : listeners.registration?.({ value: token })), 0); },
    createChannel: async (c) => { p.channels.push(c.id); },
  };
  return p;
}
const make = (plugin, extra = {}) => {
  const rpc = vi.fn(async () => ({ error: null }));
  const svc = new PushService({ isNative: () => true, platform: () => 'ios', loadPlugin: async () => plugin, storage: memStorage(), rpc, getLang: () => 'ar', ...extra });
  return { svc, rpc };
};

describe('turning notifications on', () => {
  it('asks permission once, gets the token, and stores it with the app language', async () => {
    const plugin = fakePlugin();
    const { svc, rpc } = make(plugin);
    expect(await svc.enable()).toBe('enabled');
    expect(rpc).toHaveBeenCalledWith('register_push_token', { p_token: TOKEN, p_platform: 'ios', p_lang: 'ar' });
    expect(svc.isOn()).toBe(true);
  });
  it('a refusal in the phone\'s permission dialog leaves notifications off and stores nothing', async () => {
    const { svc, rpc } = make(fakePlugin({ granted: 'denied' }));
    expect(await svc.enable()).toBe('denied');
    expect(rpc).not.toHaveBeenCalled();
    expect(svc.isOn()).toBe(false);
  });
  it('does not show the permission dialog again when it was already granted', async () => {
    const plugin = fakePlugin({ receive: 'granted' });
    plugin.requestPermissions = vi.fn(plugin.requestPermissions);
    const { svc } = make(plugin);
    await svc.enable();
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });
  it('reports an error (not success) when the phone gives no token or the server refuses it', async () => {
    expect(await make(fakePlugin({ fail: true })).svc.enable()).toBe('error');
    const { svc } = make(fakePlugin());
    svc.rpc = async () => ({ error: { message: 'nope' } });
    expect(await svc.enable()).toBe('error');
    expect(svc.isOn()).toBe(false);
  });
  it('gives up waiting for a token after the timeout', async () => {
    vi.useFakeTimers();
    const plugin = fakePlugin();
    plugin.register = async () => {}; // never answers
    const { svc } = make(plugin);
    const pending = svc.waitForToken(plugin, 5000);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });
  it('is not available in a browser', async () => {
    const { svc } = make(fakePlugin(), { isNative: () => false });
    expect(svc.supported()).toBe(false);
    expect(await svc.enable()).toBe('unsupported');
    expect(await svc.refresh()).toBe('off');
  });
  it('creates the Android channels for messages and calls', async () => {
    const plugin = fakePlugin();
    const { svc } = make(plugin, { platform: () => 'android', checkConfigured: async () => true });
    await svc.enable();
    expect(plugin.channels.sort()).toEqual(['calls', 'messages']);
  });
  it('an Android build without Firebase offers no notifications and never calls the phone plugin (it would crash)', async () => {
    const plugin = fakePlugin();
    const { svc, rpc } = make(plugin, { platform: () => 'android', checkConfigured: async () => false });
    expect(await svc.available()).toBe(false);
    expect(await svc.enable()).toBe('unsupported');
    svc.setPref(true);
    expect(await svc.refresh()).toBe('off');
    expect(plugin.registered).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('keeping the token fresh and removing it', () => {
  it('refreshes quietly on start only when notifications are on', async () => {
    const plugin = fakePlugin({ receive: 'granted' });
    const { svc, rpc } = make(plugin);
    expect(await svc.refresh()).toBe('off');
    expect(rpc).not.toHaveBeenCalled();
    svc.setPref(true);
    expect(await svc.refresh()).toBe('enabled');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('notices that the person turned notifications off in the phone\'s own settings', async () => {
    const { svc } = make(fakePlugin({ receive: 'denied' }));
    svc.setPref(true);
    expect(await svc.refresh()).toBe('denied');
    expect(svc.isOn()).toBe(false);
  });
  it('turning off (or signing out) removes this phone\'s token on the server', async () => {
    const { svc, rpc } = make(fakePlugin({ receive: 'granted' }));
    await svc.enable();
    rpc.mockClear();
    await svc.disable();
    expect(rpc).toHaveBeenCalledWith('unregister_push_token', { p_token: TOKEN });
    expect(svc.isOn()).toBe(false);
    rpc.mockClear();
    await svc.forgetToken();
    expect(rpc).not.toHaveBeenCalled(); // nothing left to remove
  });
  it('sign-out keeps the preference for the next sign-in but drops the token', async () => {
    const { svc, rpc } = make(fakePlugin({ receive: 'granted' }));
    await svc.enable();
    await svc.forgetToken();
    expect(rpc).toHaveBeenLastCalledWith('unregister_push_token', { p_token: TOKEN });
    expect(svc.isOn()).toBe(true);
  });
  it('a failed removal (offline) does not throw', async () => {
    const { svc } = make(fakePlugin({ receive: 'granted' }));
    await svc.enable();
    svc.rpc = async () => { throw new Error('offline'); };
    await expect(svc.forgetToken()).resolves.toBeUndefined();
  });
});

describe('tapping a notification', () => {
  it('opens the matching in-app screen', async () => {
    const plugin = fakePlugin({ receive: 'granted' });
    const { svc } = make(plugin);
    const opened = [];
    svc.onOpen((p) => opened.push(p));
    await svc.enable();
    plugin.listeners.pushNotificationActionPerformed({ notification: { data: { url: `/chat/${CONV}` } } });
    plugin.listeners.pushNotificationActionPerformed({ notification: { data: { url: '/notifications' } } });
    expect(opened).toEqual([`/chat/${CONV}`, '/notifications']);
  });
  it('never navigates anywhere else, whatever the notification says', () => {
    for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/admin', '/chat/../admin', '/chat/not-a-uuid', '/settings', '', null, undefined, '/chat/' + CONV + '/x'])
      expect(safeAppPath(bad), String(bad)).toBeNull();
    expect(safeAppPath('/chat')).toBe('/chat');
    expect(safeAppPath(`/chat/${CONV}`)).toBe(`/chat/${CONV}`);
  });
  it('the preference key is stable (used by the Settings switch)', () => expect(PUSH_PREF_KEY).toBe('mohleyla-push'));
});

describe('Sign in with Apple', () => {
  afterEach(() => { delete globalThis.window.Capacitor; vi.restoreAllMocks(); });
  const native = (platform) => { globalThis.window.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform }; };

  it('creates a random nonce and hashes it with SHA-256 (what Apple signs into the token)', async () => {
    const a = randomNonce(); const b = randomNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  function manager(clientBits) {
    const client = { auth: { onAuthStateChange: () => {}, signInWithIdToken: vi.fn(async () => ({ data: { session: { user: { id: 'u1', email: 'x@privaterelay.appleid.com', user_metadata: {} } } }, error: null })), updateUser: vi.fn(async () => ({})), signInWithOAuth: vi.fn(async () => ({ error: null })), ...clientBits } };
    const mgr = new SyncManager({ createClient: async () => client, configured: true, storage: memStorage() });
    return { mgr, client };
  }

  it('on the web it uses the Apple redirect', async () => {
    const { mgr, client } = manager();
    expect(await mgr.signInWithApple()).toBe(true);
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: `${location.origin}/` } });
  });
  it('a failed Apple redirect shows the sign-in error', async () => {
    const { mgr } = manager({ signInWithOAuth: async () => ({ error: { message: 'x' } }) });
    expect(await mgr.signInWithApple()).toBe(false);
    expect(mgr.getSnapshot().error).toBe('oauthFailed');
  });
  it('closing the Apple sheet is not an error', async () => {
    native('ios');
    vi.resetModules();
    vi.doMock('../features/sync/appleAuth.js', () => ({ canUseNativeApple: () => true, appleNativeAuthorize: async () => { throw Object.assign(new Error('Cancelled'), { code: 'canceled' }); } }));
    const { SyncManager: SM } = await import('../features/sync/syncManager.js');
    const mgr = new SM({ createClient: async () => ({ auth: { onAuthStateChange: () => {} } }), configured: true, storage: memStorage() });
    expect(await mgr.signInWithApple()).toBe(false);
    expect(mgr.getSnapshot().error).toBeNull();
    vi.doUnmock('../features/sync/appleAuth.js');
  });
  it('on iPhone it signs in with the token and the RAW nonce, and keeps the name Apple gives only once', async () => {
    native('ios');
    vi.resetModules();
    vi.doMock('../features/sync/appleAuth.js', () => ({ canUseNativeApple: () => true, appleNativeAuthorize: async () => ({ identityToken: 'APPLE.JWT.TOKEN', rawNonce: 'raw-nonce', givenName: 'Sara', familyName: 'Ali' }) }));
    const { SyncManager: SM } = await import('../features/sync/syncManager.js');
    const client = { auth: { onAuthStateChange: () => {}, signInWithIdToken: vi.fn(async () => ({ data: { session: { user: { id: 'u1', email: 'a@b.co', user_metadata: {} } } }, error: null })), updateUser: vi.fn(async () => ({})) } };
    const mgr = new SM({ createClient: async () => client, configured: true, storage: memStorage() });
    expect(await mgr.signInWithApple()).toBe(true);
    expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'APPLE.JWT.TOKEN', nonce: 'raw-nonce' });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sara Ali' } });
    vi.doUnmock('../features/sync/appleAuth.js');
  });
  it('does not overwrite a name the person already has', async () => {
    native('ios');
    vi.resetModules();
    vi.doMock('../features/sync/appleAuth.js', () => ({ canUseNativeApple: () => true, appleNativeAuthorize: async () => ({ identityToken: 'T', rawNonce: 'n', givenName: 'Sara', familyName: '' }) }));
    const { SyncManager: SM } = await import('../features/sync/syncManager.js');
    const client = { auth: { onAuthStateChange: () => {}, signInWithIdToken: vi.fn(async () => ({ data: { session: { user: { id: 'u1', user_metadata: { display_name: 'Already Named' } } } }, error: null })), updateUser: vi.fn() } };
    const mgr = new SM({ createClient: async () => client, configured: true, storage: memStorage() });
    await mgr.signInWithApple();
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    vi.doUnmock('../features/sync/appleAuth.js');
  });
  it('a rejected token shows the sign-in error and does not sign in', async () => {
    native('ios');
    vi.resetModules();
    vi.doMock('../features/sync/appleAuth.js', () => ({ canUseNativeApple: () => true, appleNativeAuthorize: async () => ({ identityToken: 'T', rawNonce: 'n', givenName: '', familyName: '' }) }));
    const { SyncManager: SM } = await import('../features/sync/syncManager.js');
    const client = { auth: { onAuthStateChange: () => {}, signInWithIdToken: async () => ({ data: {}, error: { message: 'Nonces mismatch' } }) } };
    const mgr = new SM({ createClient: async () => client, configured: true, storage: memStorage() });
    expect(await mgr.signInWithApple()).toBe(false);
    expect(mgr.getSnapshot().error).toBe('oauthFailed');
    vi.doUnmock('../features/sync/appleAuth.js');
  });
});
