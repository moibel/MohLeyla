// Cloud sync: optional sign-in (email one-time code / magic link) and local-first, conflict-free progress sync.
// The app always works offline and signed out; sync only ever MERGES (see progress/merge.js), it never overwrites
// unless the learner explicitly chooses "replace" when signing in on a device that already has progress.
import { mergeStates, sameSynced, toRemote } from '../progress/merge.js';
import { migrate } from '../progress/engine.js';
import { profileFromUser, cleanName } from './profile.js';
import { isNativeApp, NATIVE_AUTH_REDIRECT, parseNativeAuthUrl } from '../../utils/platform.js';
import { appleNativeAuthorize, appleAuthorizationCode, canUseNativeApple } from './appleAuth.js';

export const LINK_KEY = 'mohleyla-sync-link'; // user id whose cloud data this device has already merged
export const HINT_KEY = 'mohleyla-session-hint'; // { userId, email, profile } of the last signed-in user, so reopening offline stays signed in
export const NAME_ASKED_KEY = 'mohleyla-name-asked'; // user ids that were already asked for a display name
// Whose progress is on this device. Progress is never merged into a different account: it is set aside for its owner and restored when they return.
export const TERMS_SENT_KEY = 'mohleyla-terms-sent'; // userId:version already recorded in the database
export const OWNER_KEY = 'mohleyla-progress-owner';
export const ASIDE_PREFIX = 'mohleyla-progress-of:';
// supabase-js keeps the session under these keys (storageKey in services/supabaseClient.js). Sign-out removes them itself too.
export const AUTH_KEYS = ['mohleyla-auth', 'mohleyla-auth-user', 'mohleyla-auth-code-verifier'];
const ACCOUNT_CACHES = ['mohleyla-news-v1', 'mohleyla-rewards-v1']; // personal announcements and rewards of the signed-in person
const NATIVE_SIGN_IN_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 2500;
// After a failed sync while online (server hiccup, flaky network) try again by itself, waiting longer each time, then every 5 minutes.
export const RETRY_MS = [5000, 15000, 45000, 120000, 300000];
const hasProgress = (s) => s.xp > 0 || Object.keys(s.completed).length > 0 || Object.keys(s.saved).length > 0;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

function mapAuthError(e, fallback) {
  const status = e && (e.status || e.code);
  const msg = String((e && e.message) || '').toLowerCase();
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'rateLimited';
  if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) return fallback === 'sendFailed' ? 'sendFailed' : 'badCode';
  if (msg.includes('fetch') || msg.includes('network') || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'network';
  return fallback;
}

export class SyncManager {
  /** @param {{createClient:()=>Promise<object>, configured:boolean, storage?:Storage, getOnline?:()=>boolean}} deps */
  constructor({ createClient, configured, storage, getOnline, authInUrl } = {}) {
    this.createClient = createClient;
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem() {}, removeItem() {} });
    this.getOnline = getOnline || (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    this.listeners = new Set();
    this.client = null;
    this.clientPromise = null;
    this.api = null; // { getState, apply }
    this.timer = null;
    this.retryTimer = null;
    this.retryIdx = 0;
    this.chain = Promise.resolve();
    this.gen = 0; // bumped whenever the signed-in person changes, so a sync already in flight cannot write the old person's data
    this.nativeListener = null;
    const hint = this.readHint();
    // `restoring` is true until we know whether a stored session is still valid, so the UI never flashes a sign-in screen.
    this.snapshot = {
      configured: !!configured, status: hint ? 'idle' : 'signedOut', userId: hint?.userId ?? null, email: hint?.email ?? null, profile: hint?.profile ?? null, role: hint?.role ?? null,
      lastSyncedAt: null, error: null, pendingChoice: false, codeSentTo: null, errorId: 0, nameAskedAt: 0, editPlan: false,
      restoring: !!configured && (!!hint || !!authInUrl),
    };
  }

  readHint() {
    try { const h = JSON.parse(this.storage.getItem(HINT_KEY) || 'null'); return h && h.userId ? h : null; } catch { return null; }
  }
  setUser(user, extra = {}) {
    if (this.snapshot.userId !== user.id) this.gen++;
    // progress made from now on belongs to this person (only claim an empty device here; existing progress is handled by the sync)
    if (this.api && !this.storage.getItem(OWNER_KEY) && !this.storage.getItem(LINK_KEY) && !hasProgress(this.api.getState())) this.storage.setItem(OWNER_KEY, user.id);
    const profile = profileFromUser(user);
    const role = this.snapshot.userId === user.id ? this.snapshot.role : null; // keep the known role while the same user refreshes
    this.storage.setItem(HINT_KEY, JSON.stringify({ userId: user.id, email: user.email || null, profile, role }));
    this.set({ userId: user.id, email: user.email || null, profile, role, ...extra });
  }
  clearUser(extra = {}) {
    this.gen++;
    this.stopRetry();
    this.storage.removeItem(HINT_KEY);
    this.set({ status: 'signedOut', userId: null, email: null, profile: null, role: null, pendingChoice: false, restoring: false, ...extra });
  }

  /**
   * Ask the database for this user's role (student | teacher | admin). The page uses it only to decide which links to show;
   * every permission is enforced by the database itself, so a wrong or tampered value here gives no extra access.
   */
  async refreshRole() {
    if (!this.snapshot.userId || !this.client) return;
    try {
      const { data, error } = await this.client.rpc('my_role');
      if (error || typeof data !== 'string' || data === this.snapshot.role) return;
      const hint = this.readHint();
      if (hint) this.storage.setItem(HINT_KEY, JSON.stringify({ ...hint, role: data }));
      this.set({ role: data });
    } catch { /* offline or functions not installed: keep the remembered role */ }
  }

  /** Has this user already been asked "What should we call you?" (or skipped)? */
  nameAsked() {
    try { return JSON.parse(this.storage.getItem(NAME_ASKED_KEY) || '[]').includes(this.snapshot.userId); } catch { return false; }
  }
  skipNamePrompt() {
    let list = [];
    try { list = JSON.parse(this.storage.getItem(NAME_ASKED_KEY) || '[]'); } catch { /* ignore */ }
    if (this.snapshot.userId && !list.includes(this.snapshot.userId)) list.push(this.snapshot.userId);
    this.storage.setItem(NAME_ASKED_KEY, JSON.stringify(list));
    this.set({ nameAskedAt: Date.now() }); // notifies subscribers
  }

  /** Save the learner's display name in their account (user metadata), so it follows them to every device. */
  async updateName(name) {
    const clean = cleanName(name);
    if (!clean) return this.fail('nameInvalid');
    try {
      const c = await this.ensureClient();
      const { data, error } = await c.auth.updateUser({ data: { display_name: clean } });
      if (error || !data?.user) return this.fail(mapAuthError(error, 'nameFailed') === 'network' ? 'network' : 'nameFailed');
      this.setUser(data.user, { error: null });
      this.skipNamePrompt();
      return true;
    } catch (e) {
      return this.fail(this.getOnline() ? 'nameFailed' : 'network');
    }
  }

  /** Save the set-up answers (13+, accepted terms, languages, levels) and optionally the display name, in the account. */
  async saveLearning(plan, name = '') {
    const clean = cleanName(name);
    try {
      const c = await this.ensureClient();
      const { data, error } = await c.auth.updateUser({ data: { learning: plan, ...(clean ? { display_name: clean } : {}) } });
      if (error || !data?.user) return this.fail(this.getOnline() ? 'nameFailed' : 'network');
      this.setUser(data.user, { error: null });
      this.skipNamePrompt();
      await this.recordTerms();
      return true;
    } catch {
      return this.fail(this.getOnline() ? 'nameFailed' : 'network');
    }
  }

  /** The database also keeps who accepted which terms (it refuses chat messages without it). Retried after each sync until it succeeds. */
  async recordTerms() {
    const { userId, profile } = this.snapshot;
    const version = profile?.learning?.terms;
    if (!userId || !version || !this.client?.rpc) return;
    const mark = `${userId}:${version}`;
    if (this.storage.getItem(TERMS_SENT_KEY) === mark) return;
    try { if (!(await this.client.rpc('accept_terms', { p_version: version }))?.error) this.storage.setItem(TERMS_SENT_KEY, mark); } catch { /* offline: next time */ }
  }

  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.snapshot;
  set(patch) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((l) => l()); }
  fail(code) { this.set({ error: code, errorId: this.snapshot.errorId + 1 }); return false; }

  /** Connect the app state: `getState()` returns the current progress, `apply(state)` replaces it, `clearLocal()` empties it. */
  attach(api) { this.api = api; }

  async ensureClient() {
    if (!this.snapshot.configured) throw Object.assign(new Error('not configured'), { code: 'notConfigured' });
    if (this.client) return this.client;
    if (!this.clientPromise) {
      this.clientPromise = this.createClient().then((c) => {
        this.client = c;
        c.auth.onAuthStateChange((event, session) => {
          if (this.client !== c) return; // a client that was thrown away by sign-out must not bring its session back
          if (event === 'SIGNED_OUT') this.clearUser();
          else if (session?.user) {
            const first = this.snapshot.userId !== session.user.id || this.snapshot.status === 'signedOut';
            this.setUser(session.user, { status: this.snapshot.status === 'signedOut' ? 'idle' : this.snapshot.status, codeSentTo: null, restoring: false });
            if (first) setTimeout(() => this.syncNow(), 0);
          }
        });
        return c;
      });
    }
    return this.clientPromise;
  }

  /** Restore a stored session (call at startup when one may exist). */
  async init() {
    if (!this.snapshot.configured) return;
    try {
      const c = await this.ensureClient();
      const { data, error } = await c.auth.getSession();
      if (data?.session?.user) {
        this.setUser(data.session.user, { status: 'idle', restoring: false });
        await this.syncNow();
      } else if (this.getOnline() && !error) {
        this.clearUser(); // online and there is no valid session any more: sign in again
      } else {
        this.set({ restoring: false }); // offline: trust the stored sign-in, sync later
      }
    } catch {
      // could not reach the auth server (offline): keep the remembered user so the app stays usable
      if (this.getOnline() && !this.readHint()) this.clearUser();
      else this.set({ restoring: false });
    }
  }

  /** Redirects to Google, then back to the app with a session in the URL (same path as an emailed link). */
  async signInWithGoogle() {
    try {
      const c = await this.ensureClient();
      if (isNativeApp()) return await this.signInWithProviderNative(c, 'google');
      const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/` } });
      if (error) return this.fail(mapAuthError(error, 'oauthFailed') === 'network' ? 'network' : 'oauthFailed');
      return true;
    } catch (e) {
      return this.fail(e.code === 'notConfigured' ? 'notConfigured' : 'oauthFailed');
    }
  }

  /** Apple: the native sheet on iPhone (no browser), the browser redirect elsewhere (needs the Apple "Services ID" set up in Supabase). */
  async signInWithApple() {
    try {
      const c = await this.ensureClient();
      if (isNativeApp() && canUseNativeApple()) {
        const r = await appleNativeAuthorize();
        const { data, error } = await c.auth.signInWithIdToken({ provider: 'apple', token: r.identityToken, nonce: r.rawNonce });
        if (error || !data?.session) return this.fail(mapAuthError(error, 'oauthFailed') === 'network' ? 'network' : 'oauthFailed');
        // Apple only tells us the name the first time: keep it (the person can still change it afterwards).
        const name = cleanName(`${r.givenName} ${r.familyName}`);
        if (name && !profileFromUser(data.session.user).name) await c.auth.updateUser({ data: { full_name: name } }).catch(() => {});
        return true;
      }
      if (isNativeApp()) return await this.signInWithProviderNative(c, 'apple');
      const { error } = await c.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: `${location.origin}/` } });
      if (error) return this.fail(mapAuthError(error, 'oauthFailed') === 'network' ? 'network' : 'oauthFailed');
      return true;
    } catch (e) {
      if (e?.code === 'canceled') return false; // closed the Apple sheet: not an error
      return this.fail(e.code === 'notConfigured' ? 'notConfigured' : mapAuthError(e, 'oauthFailed') === 'network' ? 'network' : 'oauthFailed');
    }
  }

  /** In the app, social sign-in opens the system browser (Google refuses embedded web views) and comes back through the app's own link. */
  async signInWithProviderNative(c, provider) {
    const [{ Browser }, { App }] = await Promise.all([import('@capacitor/browser'), import('@capacitor/app')]);
    const { data, error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true } });
    if (error || !data?.url) return this.fail('oauthFailed');
    // one listener at a time, only while a sign-in is pending. The link carries a one-time code that is useless without the
    // secret this app kept when it started the sign-in (PKCE), so a link made by someone else cannot sign this phone in.
    this.stopNativeListener();
    const handle = await App.addListener('appUrlOpen', async ({ url }) => {
      const result = parseNativeAuthUrl(url);
      if (!result) return; // not our link: ignore it
      this.stopNativeListener();
      await Browser.close().catch(() => {});
      const done = await c.auth.exchangeCodeForSession(result.code);
      if (done.error) this.fail('oauthFailed');
    });
    const timer = setTimeout(() => this.stopNativeListener(), NATIVE_SIGN_IN_MS);
    this.nativeListener = () => { clearTimeout(timer); handle.remove?.(); };
    await Browser.open({ url: data.url });
    return true;
  }

  async sendCode(email) {
    const clean = String(email).trim();
    if (!isEmail(clean)) return this.fail('invalidEmail');
    try {
      const c = await this.ensureClient();
      const { error } = await c.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true, emailRedirectTo: typeof location !== 'undefined' && !isNativeApp() ? `${location.origin}/settings` : undefined } });
      if (error) return this.fail(mapAuthError(error, 'sendFailed'));
      this.set({ codeSentTo: clean, error: null });
      return true;
    } catch (e) {
      return this.fail(e.code === 'notConfigured' ? 'notConfigured' : mapAuthError(e, 'sendFailed'));
    }
  }

  async verifyCode(email, code) {
    try {
      const c = await this.ensureClient();
      const { data, error } = await c.auth.verifyOtp({ email: String(email).trim(), token: String(code).replace(/\s+/g, ''), type: 'email' });
      if (error || !data?.session) return this.fail(mapAuthError(error, 'badCode'));
      this.setUser(data.session.user, { status: 'idle', codeSentTo: null, error: null, restoring: false });
      await this.syncNow();
      return true;
    } catch (e) {
      return this.fail(mapAuthError(e, 'badCode'));
    }
  }

  stopNativeListener() { const stop = this.nativeListener; this.nativeListener = null; stop?.(); }

  stopRetry() { clearTimeout(this.retryTimer); this.retryTimer = null; this.retryIdx = 0; }
  scheduleRetry() {
    clearTimeout(this.retryTimer);
    const wait = RETRY_MS[Math.min(this.retryIdx, RETRY_MS.length - 1)];
    this.retryIdx++;
    this.retryTimer = setTimeout(() => this.syncNow(), wait);
  }

  async signOut() {
    clearTimeout(this.timer);
    // the phone must stop getting this person's notifications (only in the phone apps; the code is not loaded on the web)
    if (isNativeApp()) { try { await (await (await import('../push/pushService.js')).getPushService()).forgetToken(); } catch { /* ignore */ } }
    this.stopNativeListener();
    // 'local' = this device only. If the server cannot be reached the library KEEPS the session, so it is removed here as well.
    const c = this.client;
    let removed = !c;
    try { if (c) removed = !(await c.auth.signOut({ scope: 'local' }))?.error; } catch { removed = false; }
    if (!removed) {
      try { await c.auth.stopAutoRefresh?.(); } catch { /* ignore */ }
      this.client = null;
      this.clientPromise = null;
    }
    for (const k of [...AUTH_KEYS, ...ACCOUNT_CACHES]) this.storage.removeItem(k);
    this.storage.removeItem(LINK_KEY);
    this.clearUser({ lastSyncedAt: null, error: null });
  }

  /**
   * Sign out of a shared/required-sign-in device: make sure the cloud has everything first, then remove the progress from
   * this device so the next person never sees or merges it. Returns { ok } or { ok:false, reason:'unsynced' } so the UI can
   * ask before discarding progress that could not be saved (for example when offline).
   */
  async signOutAndClear({ force = false } = {}) {
    if (!force) {
      await this.syncNow();
      if (this.snapshot.status !== 'synced') return { ok: false, reason: 'unsynced' };
    }
    await this.signOut();
    this.api?.clearLocal?.();
    this.storage.removeItem(OWNER_KEY);
    return { ok: true };
  }

  /** Debounced trigger used after every local change. */
  schedule() {
    if (!this.snapshot.userId || this.snapshot.pendingChoice) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), DEBOUNCE_MS);
  }

  syncNow() {
    this.chain = this.chain.then(() => this._sync()).catch(() => {});
    return this.chain;
  }

  /** Before syncing: set another person's progress aside, and bring back this person's own if it was set aside earlier. */
  separateOwners(userId) {
    const owner = this.storage.getItem(OWNER_KEY) || this.storage.getItem(LINK_KEY);
    if (owner && owner !== userId) {
      const theirs = this.api.getState();
      if (hasProgress(theirs)) this.storage.setItem(ASIDE_PREFIX + owner, JSON.stringify(theirs));
      this.api.clearLocal?.();
      this.storage.removeItem(LINK_KEY);
      this.storage.setItem(OWNER_KEY, userId);
    }
    const aside = this.storage.getItem(ASIDE_PREFIX + userId);
    if (aside) {
      try { this.api.apply(mergeStates(this.api.getState(), migrate(JSON.parse(aside)))); } catch { /* unreadable copy: drop it */ }
      this.storage.removeItem(ASIDE_PREFIX + userId);
      this.storage.setItem(OWNER_KEY, userId);
    }
  }

  async _sync(choice) {
    const { userId } = this.snapshot;
    if (!userId || !this.client || !this.api) return;
    const gen = this.gen;
    const stale = () => gen !== this.gen || this.snapshot.userId !== userId;
    this.separateOwners(userId);
    if (!this.getOnline()) return this.set({ status: 'offline' });
    if (this.snapshot.pendingChoice && !choice) return;
    this.set({ status: 'syncing', error: null });
    try {
      const { data, error } = await this.client.from('progress').select('state').eq('user_id', userId).maybeSingle();
      if (stale()) return;
      if (error) throw error;
      const local = this.api.getState();
      const remote = data?.state ? migrate(data.state) : null;
      const linked = this.storage.getItem(LINK_KEY) === userId;
      if (remote && !linked && !choice && hasProgress(local) && hasProgress(remote)) {
        // Different account than this device last synced with, and both sides have progress: ask first.
        return this.set({ status: 'idle', pendingChoice: true });
      }
      let merged;
      if (choice === 'replace' && remote) merged = { ...remote, device: local.device, settings: local.settings };
      else merged = remote ? mergeStates(local, remote) : local;
      if (!sameSynced(merged, local)) this.api.apply(merged);
      // Never create an empty cloud row for a learner with no progress (fresh sign-in, or right after a reset).
      if ((remote && !sameSynced(merged, remote)) || (!remote && hasProgress(merged))) {
        const { error: upErr } = await this.client.from('progress').upsert({ user_id: userId, state: toRemote(merged), updated_at: new Date().toISOString() });
        if (stale()) return;
        if (upErr) throw upErr;
      }
      this.storage.setItem(LINK_KEY, userId);
      this.storage.setItem(OWNER_KEY, userId);
      this.stopRetry();
      this.set({ status: 'synced', lastSyncedAt: Date.now(), pendingChoice: false });
      this.refreshRole();
      this.recordTerms();
    } catch (e) {
      if (stale()) return;
      const online = this.getOnline();
      this.set({ status: online ? 'error' : 'offline', error: online ? 'syncFailed' : null, errorId: this.snapshot.errorId + 1 });
      if (online && this.snapshot.userId) this.scheduleRetry(); // offline: the 'online' event triggers the next try instead
    }
  }

  /** Answer to the "this device already has progress" question: 'merge' | 'replace' | 'cancel'. */
  async resolveChoice(choice) {
    if (choice === 'cancel') return this.signOut();
    this.chain = this.chain.then(() => this._sync(choice)).catch(() => {});
    return this.chain;
  }

  /** Permanently deletes this account's cloud progress (the sign-in identity itself can be removed in the Supabase dashboard). */
  /**
   * Delete the whole account (sign-in, progress, chats, classes...) through the "delete-account" Edge Function, then sign out here.
   * Returns true when it is gone; false otherwise with an error code in the snapshot (lastAdmin / network / deleteAccountFailed).
   * On iPhone, an Apple account first shows Apple's sheet again: Apple needs a fresh code to revoke its token.
   * Progress that is only on this device is kept unless this device requires sign-in (shared devices): then it is cleared too.
   */
  async deleteAccount({ clearDevice = false } = {}) {
    if (!this.snapshot.userId) return false;
    try {
      const c = await this.ensureClient();
      let appleCode;
      if (isNativeApp() && canUseNativeApple()) {
        const { data } = await c.auth.getUser();
        if ((data?.user?.identities || []).some((i) => i.provider === 'apple')) appleCode = await appleAuthorizationCode();
      }
      const { data, error } = await c.functions.invoke('delete-account', { body: { confirm: true, appleCode } });
      if (error || !data?.ok) {
        const status = error?.context?.status;
        const body = await error?.context?.json?.().catch(() => null);
        if (status === 409 || body?.error === 'lastAdmin') return this.fail('lastAdmin');
        return this.fail(status ? 'deleteAccountFailed' : this.getOnline() ? 'deleteAccountFailed' : 'network');
      }
      this.storage.removeItem(LINK_KEY);
      await this.signOut();
      if (clearDevice) this.api?.clearLocal?.();
      return true;
    } catch (e) {
      if (e?.code === 'canceled') return false; // closed Apple's sheet: nothing was deleted
      return this.fail(this.getOnline() ? 'deleteAccountFailed' : 'network');
    }
  }

  async deleteCloudData() {
    const { userId } = this.snapshot;
    if (!userId || !this.client) return false;
    clearTimeout(this.timer);
    await this.chain; // let a running sync finish first, or its upload could recreate the row after the delete
    const { error } = await this.client.from('progress').delete().eq('user_id', userId);
    if (error) return this.fail('syncFailed');
    this.storage.removeItem(LINK_KEY);
    return true;
  }
}
