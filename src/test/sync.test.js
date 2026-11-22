import { describe, it, expect, vi } from 'vitest';
import { SyncManager, LINK_KEY } from '../features/sync/syncManager.js';
import { emptyState, applyLessonResult, toggleSaved, migrate } from '../features/progress/engine.js';
import { mergeStates } from '../features/progress/merge.js';

const T = new Date(2026, 4, 10, 12).getTime();
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };

/** In-memory Supabase fake: a shared "server" so two devices can sync through it. */
function makeServer() {
  return { rows: new Map(), calls: { upsert: 0, select: 0, delete: 0 }, failNext: null, codes: new Map(), users: new Map() };
}
function fakeClient(server, { user = 'u1', email = 'a@b.co' } = {}) {
  let listener = null;
  const session = { user: { id: user, email } };
  return {
    auth: {
      onAuthStateChange: (cb) => { listener = cb; },
      getSession: async () => ({ data: { session: server.signedIn?.[user] ? session : null } }),
      signInWithOtp: async ({ email: e }) => {
        if (server.rateLimit) return { error: { status: 429, message: 'email rate limit exceeded' } };
        server.codes.set(e, '123456');
        return { error: null };
      },
      verifyOtp: async ({ email: e, token }) => {
        if (server.codes.get(e) !== token) return { error: { message: 'Token has expired or is invalid' }, data: {} };
        server.signedIn = { ...(server.signedIn || {}), [user]: true };
        listener && listener('SIGNED_IN', session);
        return { data: { session }, error: null };
      },
      signInWithOAuth: async ({ provider, options }) => { server.oauth = { provider, redirectTo: options.redirectTo }; return { error: server.oauthError || null }; },
      signOut: async () => { server.signedIn = {}; listener && listener('SIGNED_OUT', null); },
    },
    from: () => ({
      select: () => ({ eq: (_c, uid) => ({ maybeSingle: async () => {
        server.calls.select++;
        if (server.failNext) { const e = server.failNext; server.failNext = null; return { error: e }; }
        return { data: server.rows.has(uid) ? { state: server.rows.get(uid) } : null, error: null };
      } }) }),
      upsert: async (row) => { server.calls.upsert++; server.rows.set(row.user_id, row.state); return { error: null }; },
      delete: () => ({ eq: async (_c, uid) => { server.calls.delete++; server.rows.delete(uid); return { error: null }; } }),
    }),
  };
}

function device(server, localState, opts = {}) {
  let state = localState;
  const mgr = new SyncManager({ createClient: async () => fakeClient(server, opts), configured: true, storage: opts.storage || memStorage(), getOnline: opts.getOnline });
  mgr.attach({ getState: () => state, apply: (s) => { state = s; } });
  return { mgr, get state() { return state; }, set state(v) { state = v; } };
}
const win = (dev, lessonId, ok = 16) => applyLessonResult(emptyState(dev), { lessonId, itemIds: ['x'], correct: 16, total: 16, firstTryCorrect: ok, now: T }).state;

async function signIn(d, email = 'a@b.co') {
  expect(await d.mgr.sendCode(email)).toBe(true);
  expect(await d.mgr.verifyCode(email, '123 456')).toBe(true);
}

describe('SyncManager', () => {
  it('rejects bad emails, reports rate limits and wrong codes', async () => {
    const server = makeServer();
    const d = device(server, emptyState('a'));
    expect(await d.mgr.sendCode('nope')).toBe(false);
    expect(d.mgr.getSnapshot().error).toBe('invalidEmail');
    server.rateLimit = true;
    expect(await d.mgr.sendCode('a@b.co')).toBe(false);
    expect(d.mgr.getSnapshot().error).toBe('rateLimited');
    server.rateLimit = false;
    await d.mgr.sendCode('a@b.co');
    expect(await d.mgr.verifyCode('a@b.co', '000000')).toBe(false);
    expect(d.mgr.getSnapshot().error).toBe('badCode');
  });
  it('reports "not configured" without ever loading supabase', async () => {
    const createClient = vi.fn();
    const mgr = new SyncManager({ createClient, configured: false });
    expect(await mgr.sendCode('a@b.co')).toBe(false);
    expect(mgr.getSnapshot().error).toBe('notConfigured');
    expect(createClient).not.toHaveBeenCalled();
  });
  it('first sign-in uploads local progress without device id or settings', async () => {
    const server = makeServer();
    const d = device(server, win('phone', 'ar-01'));
    await signIn(d);
    expect(d.mgr.getSnapshot().status).toBe('synced');
    const row = server.rows.get('u1');
    expect(row.xp).toBe(70);
    expect(row.device).toBeUndefined();
    expect(row.settings).toBeUndefined();
  });
  it('a second device pulls the progress and the two converge (XP added once)', async () => {
    const server = makeServer();
    const phone = device(server, win('phone', 'ar-01'));
    await signIn(phone);
    const laptop = device(server, win('laptop', 'en-01', 10)); // 50 XP earned offline on another device, same account
    laptop.mgr.storage.setItem(LINK_KEY, 'u1');
    await signIn(laptop);
    expect(laptop.state.xp).toBe(120);
    expect(Object.keys(laptop.state.completed).sort()).toEqual(['ar-01', 'en-01']);
    await phone.mgr.syncNow();
    expect(phone.state.xp).toBe(120);
    expect(server.rows.get('u1').xp).toBe(120);
  });
  it('does not upload again when nothing changed (no sync loop)', async () => {
    const server = makeServer();
    const d = device(server, win('phone', 'ar-01'));
    await signIn(d);
    const before = server.calls.upsert;
    await d.mgr.syncNow();
    await d.mgr.syncNow();
    expect(server.calls.upsert).toBe(before);
  });
  it('syncs removals: un-saving a word on one device reaches the other', async () => {
    const server = makeServer();
    const a = device(server, toggleSaved(emptyState('a'), 'w1', T));
    await signIn(a);
    const b = device(server, emptyState('b'));
    await signIn(b);
    expect(b.state.saved.w1).toBeDefined();
    b.state = toggleSaved(b.state, 'w1', T + 5000);
    await b.mgr.syncNow();
    await a.mgr.syncNow();
    expect(a.state.saved.w1).toBeUndefined();
  });
  it('asks before mixing progress when a different account signs in on a device that already has progress', async () => {
    const server = makeServer();
    server.rows.set('u2', { ...emptyState('other'), xp: 0, xpLedger: { other: 300 }, completed: { 'id-01': { best: 90, attempts: 1 } } });
    const storage = memStorage();
    storage.setItem(LINK_KEY, 'u1'); // device was last synced with another user
    const d = device(server, win('kid-ipad', 'ar-01'), { user: 'u2', email: 'kid@b.co', storage });
    await signIn(d, 'kid@b.co');
    expect(d.mgr.getSnapshot().pendingChoice).toBe(true);
    expect(server.calls.upsert).toBe(0);
    expect(d.state.xp).toBe(70); // untouched until the learner chooses
    await d.mgr.resolveChoice('merge');
    expect(d.state.xp).toBe(370);
    expect(d.mgr.getSnapshot().pendingChoice).toBe(false);
  });
  it('"replace" discards this device\'s progress for the account\'s; "cancel" signs out and changes nothing', async () => {
    const server = makeServer();
    server.rows.set('u2', { ...emptyState('other'), xpLedger: { other: 300 }, xp: 300 });
    const storage = memStorage(); storage.setItem(LINK_KEY, 'u1');
    const d = device(server, win('kid-ipad', 'ar-01'), { user: 'u2', storage });
    await signIn(d);
    await d.mgr.resolveChoice('replace');
    expect(d.state.xp).toBe(300);
    expect(d.state.device).toBe('kid-ipad');
    const server2 = makeServer();
    server2.rows.set('u2', { ...emptyState('other'), xpLedger: { other: 300 }, xp: 300 });
    const s2 = memStorage(); s2.setItem(LINK_KEY, 'u1');
    const d2 = device(server2, win('kid-ipad', 'ar-01'), { user: 'u2', storage: s2 });
    await signIn(d2);
    await d2.mgr.resolveChoice('cancel');
    expect(d2.mgr.getSnapshot().status).toBe('signedOut');
    expect(d2.state.xp).toBe(70);
    expect(server2.calls.upsert).toBe(0);
  });
  it('offline: marks offline, makes no network calls, keeps local progress', async () => {
    const server = makeServer();
    let online = true;
    const d = device(server, win('phone', 'ar-01'), { getOnline: () => online });
    await signIn(d);
    const selects = server.calls.select;
    online = false;
    await d.mgr.syncNow();
    expect(d.mgr.getSnapshot().status).toBe('offline');
    expect(server.calls.select).toBe(selects);
    expect(d.state.xp).toBe(70);
  });
  it('a server error surfaces as an error status and never changes local progress', async () => {
    const server = makeServer();
    const d = device(server, win('phone', 'ar-01'));
    await signIn(d);
    server.failNext = { message: 'boom' };
    await d.mgr.syncNow();
    expect(d.mgr.getSnapshot()).toMatchObject({ status: 'error', error: 'syncFailed' });
    expect(d.state.xp).toBe(70);
    await d.mgr.syncNow();
    expect(d.mgr.getSnapshot().status).toBe('synced');
  });
  it('deletes cloud data and signs out locally while keeping device progress', async () => {
    const server = makeServer();
    const d = device(server, win('phone', 'ar-01'));
    await signIn(d);
    expect(await d.mgr.deleteCloudData()).toBe(true);
    expect(server.rows.has('u1')).toBe(false);
    await d.mgr.signOut();
    expect(d.mgr.getSnapshot().status).toBe('signedOut');
    expect(d.state.xp).toBe(70);
  });
  it('migrated legacy progress syncs up intact', async () => {
    const server = makeServer();
    const d = device(server, migrate(null, { completed: ['ar-01'], saved: ['a1'], xp: 150 }));
    await signIn(d);
    const remote = server.rows.get('u1');
    expect(remote.xp).toBe(150);
    expect(remote.saved.a1).toBe(0);
    expect(mergeStates(d.state, remote).xp).toBe(150);
  });
});

describe('no empty cloud rows', () => {
  it('signing in with no progress anywhere does not create a cloud row', async () => {
    const server = makeServer();
    const d = device(server, emptyState('fresh'));
    await signIn(d);
    expect(d.mgr.getSnapshot().status).toBe('synced');
    expect(server.calls.upsert).toBe(0);
    expect(server.rows.size).toBe(0);
  });
});

describe('required sign-in support', () => {
  it('remembers the signed-in user so reopening (even offline) does not ask again', async () => {
    const server = makeServer();
    const storage = memStorage();
    const d = device(server, win('phone', 'ar-01'), { storage });
    await signIn(d);
    expect(JSON.parse(storage.getItem('mohleyla-session-hint'))).toMatchObject({ userId: 'u1', email: 'a@b.co' });
    // new app start, offline: the manager starts restoring with the remembered user and never falls back to signed-out
    const mgr = new SyncManager({ createClient: async () => { throw new Error('offline'); }, configured: true, storage, getOnline: () => false });
    expect(mgr.getSnapshot()).toMatchObject({ userId: 'u1', restoring: true });
    await mgr.init();
    expect(mgr.getSnapshot()).toMatchObject({ userId: 'u1', restoring: false });
  });
  it('online with no valid session any more: signed out so the sign-in screen appears', async () => {
    const server = makeServer();
    const storage = memStorage();
    storage.setItem('mohleyla-session-hint', JSON.stringify({ userId: 'u1', email: 'a@b.co' }));
    const mgr = new SyncManager({ createClient: async () => fakeClient(server), configured: true, storage });
    expect(mgr.getSnapshot().restoring).toBe(true);
    await mgr.init();
    expect(mgr.getSnapshot()).toMatchObject({ userId: null, status: 'signedOut', restoring: false });
    expect(storage.getItem('mohleyla-session-hint')).toBeNull();
  });
  it('a fresh start with no hint and nothing in the URL is not "restoring"', () => {
    const mgr = new SyncManager({ createClient: async () => ({}), configured: true, storage: memStorage() });
    expect(mgr.getSnapshot()).toMatchObject({ restoring: false, userId: null });
    expect(new SyncManager({ createClient: async () => ({}), configured: true, storage: memStorage(), authInUrl: true }).getSnapshot().restoring).toBe(true);
    expect(new SyncManager({ createClient: async () => ({}), configured: false, storage: memStorage(), authInUrl: true }).getSnapshot().restoring).toBe(false);
  });
  it('signOutAndClear saves to the cloud first, then empties this device', async () => {
    const server = makeServer();
    const d = device(server, win('phone', 'ar-01'));
    let cleared = false;
    d.mgr.attach({ getState: () => d.state, apply: (s) => { d.state = s; }, clearLocal: () => { cleared = true; d.state = emptyState('new'); } });
    await signIn(d);
    d.state = applyLessonResult(d.state, { lessonId: 'en-01', itemIds: ['x'], correct: 16, total: 16, firstTryCorrect: 16, now: T }).state; // not yet synced
    const r = await d.mgr.signOutAndClear();
    expect(r.ok).toBe(true);
    expect(cleared).toBe(true);
    expect(server.rows.get('u1').xp).toBe(140); // the unsynced lesson reached the cloud before the device was cleared
    expect(d.mgr.getSnapshot().status).toBe('signedOut');
    expect(d.mgr.readHint()).toBeNull();
  });
  it('signOutAndClear refuses to discard unsynced progress unless forced', async () => {
    const server = makeServer();
    let online = true;
    const d = device(server, win('phone', 'ar-01'), { getOnline: () => online });
    let cleared = false;
    d.mgr.attach({ getState: () => d.state, apply: (s) => { d.state = s; }, clearLocal: () => { cleared = true; } });
    await signIn(d);
    online = false;
    const r = await d.mgr.signOutAndClear();
    expect(r).toEqual({ ok: false, reason: 'unsynced' });
    expect(cleared).toBe(false);
    expect(d.mgr.getSnapshot().userId).toBe('u1');
    expect((await d.mgr.signOutAndClear({ force: true })).ok).toBe(true);
    expect(cleared).toBe(true);
  });
  it('after clearing, the same account can sign back in on the device and get everything back (XP not lost)', async () => {
    const server = makeServer();
    const storage = memStorage();
    const d = device(server, win('phone', 'ar-01'), { storage });
    await signIn(d);
    d.mgr.attach({ getState: () => d.state, apply: (s) => { d.state = s; }, clearLocal: () => { d.state = emptyState('phone-2'); } });
    await d.mgr.signOutAndClear();
    expect(d.state.xp).toBe(0);
    await signIn(d);
    expect(d.state.xp).toBe(70);
    d.state = applyLessonResult(d.state, { lessonId: 'en-01', itemIds: ['x'], correct: 16, total: 16, firstTryCorrect: 16, now: T }).state;
    await d.mgr.syncNow();
    expect(server.rows.get('u1').xp).toBe(140);
  });
});

describe('Google sign-in', () => {
  it('starts the OAuth redirect back to the site root', async () => {
    const server = makeServer();
    const d = device(server, emptyState('a'));
    expect(await d.mgr.signInWithGoogle()).toBe(true);
    expect(server.oauth.provider).toBe('google');
    expect(server.oauth.redirectTo).toMatch(/\/$/);
  });
  it('reports a translated error when Google sign-in cannot start, and when accounts are not configured', async () => {
    const server = makeServer();
    server.oauthError = { message: 'provider is not enabled' };
    const d = device(server, emptyState('a'));
    expect(await d.mgr.signInWithGoogle()).toBe(false);
    expect(d.mgr.getSnapshot().error).toBe('oauthFailed');
    const off = new SyncManager({ createClient: async () => ({}), configured: false });
    expect(await off.signInWithGoogle()).toBe(false);
    expect(off.getSnapshot().error).toBe('notConfigured');
  });
});
