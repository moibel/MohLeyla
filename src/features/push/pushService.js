// Push notifications on the phone (iOS and Android app only). The person turns them on in Settings; the app then asks the phone
// for a notification token and stores it with register_push_token(). Tapping a notification opens the matching screen.
// Everything that touches the phone or the network is passed in, so the logic is unit-tested without a phone (src/test/push.test.js).
import { isNativeApp, nativePlatform } from '../../utils/platform.js';

export const PUSH_PREF_KEY = 'mohleyla-push'; // 'on' when this device should receive notifications

/** Only these in-app paths may be opened from a notification (a tap can never navigate anywhere else). */
export function safeAppPath(url) {
  const u = String(url ?? '');
  return /^\/(chat(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?|notifications)$/i.test(u) ? u : null;
}

export class PushService {
  constructor(env = {}) {
    this.isNative = env.isNative ?? isNativeApp;
    this.platform = env.platform ?? nativePlatform;
    this.loadPlugin = env.loadPlugin ?? (async () => (await import('@capacitor/push-notifications')).PushNotifications);
    this.storage = env.storage ?? (typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem() {}, removeItem() {} });
    this.rpc = env.rpc; // async (name, args) => { error? }
    this.getLang = env.getLang ?? (() => 'en');
    this.token = null;
    this.listenersReady = false;
    this.openers = new Set();
    this.registering = null;
  }

  supported() { return !!this.isNative(); }
  isOn() { try { return this.storage.getItem(PUSH_PREF_KEY) === 'on'; } catch { return false; } }
  setPref(on) { try { on ? this.storage.setItem(PUSH_PREF_KEY, 'on') : this.storage.removeItem(PUSH_PREF_KEY); } catch { /* storage blocked */ } }
  /** Called with an in-app path when the person taps a notification. Returns an unsubscribe function. */
  onOpen(fn) { this.openers.add(fn); return () => this.openers.delete(fn); }

  async setupListeners(plugin) {
    if (this.listenersReady) return;
    this.listenersReady = true;
    await plugin.addListener('pushNotificationActionPerformed', (e) => {
      const path = safeAppPath(e?.notification?.data?.url);
      if (path) this.openers.forEach((fn) => fn(path));
    });
    if (this.platform() === 'android') {
      await plugin.createChannel?.({ id: 'messages', name: 'Messages', importance: 4, visibility: 0 }).catch?.(() => {});
      await plugin.createChannel?.({ id: 'calls', name: 'Calls', importance: 5, visibility: 0 }).catch?.(() => {});
    }
  }

  /** Waits for the phone to hand back its token after register(). */
  waitForToken(plugin, ms = 10000) {
    return new Promise((resolve) => {
      let done = false;
      const handles = [];
      const finish = (v) => { if (done) return; done = true; clearTimeout(timer); handles.forEach((h) => h?.remove?.()); resolve(v); };
      const timer = setTimeout(() => finish(null), ms);
      Promise.resolve(plugin.addListener('registration', (t) => finish(t?.value || null))).then((h) => handles.push(h));
      Promise.resolve(plugin.addListener('registrationError', () => finish(null))).then((h) => handles.push(h));
      plugin.register();
    });
  }

  /** Ask permission (first time), get the token, store it. Returns 'enabled' | 'denied' | 'unsupported' | 'error'. */
  async enable() {
    if (!this.supported()) return 'unsupported';
    try {
      const plugin = await this.loadPlugin();
      await this.setupListeners(plugin);
      let perm = await plugin.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await plugin.requestPermissions();
      if (perm.receive !== 'granted') { this.setPref(false); return 'denied'; }
      const ok = await this.registerToken(plugin);
      if (!ok) return 'error';
      this.setPref(true);
      return 'enabled';
    } catch {
      return 'error';
    }
  }

  async registerToken(plugin) {
    if (this.registering) return this.registering;
    this.registering = (async () => {
      const token = await this.waitForToken(plugin);
      if (!token) return false;
      const res = await this.rpc('register_push_token', { p_token: token, p_platform: this.platform() === 'ios' ? 'ios' : 'android', p_lang: this.getLang() });
      if (res?.error) return false;
      this.token = token;
      return true;
    })().finally(() => { this.registering = null; });
    return this.registering;
  }

  /** On every start / sign-in / language change: if notifications are on, quietly refresh the token (phones change them now and then). */
  async refresh() {
    if (!this.supported() || !this.isOn()) return 'off';
    try {
      const plugin = await this.loadPlugin();
      await this.setupListeners(plugin);
      const perm = await plugin.checkPermissions();
      if (perm.receive !== 'granted') { this.setPref(false); return 'denied'; } // turned off in the phone's own settings
      return (await this.registerToken(plugin)) ? 'enabled' : 'error';
    } catch {
      return 'error';
    }
  }

  /** The person turned notifications off: forget this phone. */
  async disable() {
    this.setPref(false);
    await this.forgetToken();
  }

  /** Sign-out: this phone must stop receiving the signed-out person's notifications (the preference stays for the next sign-in). */
  async forgetToken() {
    const token = this.token;
    this.token = null;
    if (!token || !this.rpc) return;
    try { await this.rpc('unregister_push_token', { p_token: token }); } catch { /* offline: the server also drops tokens the phone rejects */ }
  }
}

let instance = null;
/** The app's single instance; the RPC goes through the signed-in Supabase client. */
export async function getPushService() {
  if (instance) return instance;
  const [{ sync }, { default: i18n }] = await Promise.all([import('../sync/index.js'), import('i18next')]);
  instance = new PushService({
    rpc: async (name, args) => { const c = await sync.ensureClient(); return c.rpc(name, args); },
    getLang: () => (['ar', 'en', 'id'].includes(i18n.language?.slice(0, 2)) ? i18n.language.slice(0, 2) : 'en'),
  });
  return instance;
}
