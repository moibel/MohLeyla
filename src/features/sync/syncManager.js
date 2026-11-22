// Cloud sync: optional sign-in (email one-time code / magic link) and local-first, conflict-free progress sync.
// The app always works offline and signed out; sync only ever MERGES (see progress/merge.js), it never overwrites
// unless the learner explicitly chooses "replace" when signing in on a device that already has progress.
import { mergeStates, sameSynced, toRemote } from '../progress/merge.js';
import { migrate } from '../progress/engine.js';

export const LINK_KEY = 'mohleyla-sync-link'; // user id whose cloud data this device has already merged
export const HINT_KEY = 'mohleyla-session-hint'; // { userId, email } of the last signed-in user, so reopening offline stays signed in
const DEBOUNCE_MS = 2500;
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
    this.chain = Promise.resolve();
    const hint = this.readHint();
    // `restoring` is true until we know whether a stored session is still valid, so the UI never flashes a sign-in screen.
    this.snapshot = {
      configured: !!configured, status: hint ? 'idle' : 'signedOut', userId: hint?.userId ?? null, email: hint?.email ?? null,
      lastSyncedAt: null, error: null, pendingChoice: false, codeSentTo: null, errorId: 0,
      restoring: !!configured && (!!hint || !!authInUrl),
    };
  }

  readHint() {
    try { const h = JSON.parse(this.storage.getItem(HINT_KEY) || 'null'); return h && h.userId ? h : null; } catch { return null; }
  }
  setUser(user, extra = {}) {
    this.storage.setItem(HINT_KEY, JSON.stringify({ userId: user.id, email: user.email || null }));
    this.set({ userId: user.id, email: user.email || null, ...extra });
  }
  clearUser(extra = {}) {
    this.storage.removeItem(HINT_KEY);
    this.set({ status: 'signedOut', userId: null, email: null, pendingChoice: false, restoring: false, ...extra });
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

  async sendCode(email) {
    const clean = String(email).trim();
    if (!isEmail(clean)) return this.fail('invalidEmail');
    try {
      const c = await this.ensureClient();
      const { error } = await c.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true, emailRedirectTo: typeof location !== 'undefined' ? `${location.origin}/settings` : undefined } });
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

  async signOut() {
    clearTimeout(this.timer);
    try { if (this.client) await this.client.auth.signOut(); } catch { /* ignore: local sign-out below */ }
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

  async _sync(choice) {
    const { userId } = this.snapshot;
    if (!userId || !this.client || !this.api) return;
    if (!this.getOnline()) return this.set({ status: 'offline' });
    if (this.snapshot.pendingChoice && !choice) return;
    this.set({ status: 'syncing', error: null });
    try {
      const { data, error } = await this.client.from('progress').select('state').eq('user_id', userId).maybeSingle();
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
        if (upErr) throw upErr;
      }
      this.storage.setItem(LINK_KEY, userId);
      this.set({ status: 'synced', lastSyncedAt: Date.now(), pendingChoice: false });
    } catch (e) {
      this.set({ status: this.getOnline() ? 'error' : 'offline', error: this.getOnline() ? 'syncFailed' : null, errorId: this.snapshot.errorId + 1 });
    }
  }

  /** Answer to the "this device already has progress" question: 'merge' | 'replace' | 'cancel'. */
  async resolveChoice(choice) {
    if (choice === 'cancel') return this.signOut();
    this.chain = this.chain.then(() => this._sync(choice)).catch(() => {});
    return this.chain;
  }

  /** Permanently deletes this account's cloud progress (the sign-in identity itself can be removed in the Supabase dashboard). */
  async deleteCloudData() {
    const { userId } = this.snapshot;
    if (!userId || !this.client) return false;
    const { error } = await this.client.from('progress').delete().eq('user_id', userId);
    if (error) return this.fail('syncFailed');
    this.storage.removeItem(LINK_KEY);
    return true;
  }
}
