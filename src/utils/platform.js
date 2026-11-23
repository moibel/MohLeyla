// Are we running inside the iOS / Android app (Capacitor) or in a normal browser? The app is the same code either way.
/** 'ios' | 'android' | 'web' */
export const nativePlatform = () => (typeof window !== 'undefined' && window.Capacitor?.getPlatform?.()) || 'web';
export const isNativeApp = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
/** The address social sign-in returns to. In the app this is the app's own link scheme (registered in the iOS and Android projects). */
export const NATIVE_AUTH_REDIRECT = 'com.mohleyla.app://auth';

/**
 * Pull the sign-in result out of the address the app was opened with (com.mohleyla.app://auth#access_token=...&refresh_token=...).
 * Only an exact match on the app's own scheme and host is accepted; anything else returns null.
 */
export function parseNativeAuthUrl(url) {
  try {
    const u = new URL(String(url));
    if (`${u.protocol}//${u.host}` !== NATIVE_AUTH_REDIRECT || u.username || u.password || u.port) return null;
    const p = new URLSearchParams(u.hash.replace(/^#/, '') || u.search);
    const access_token = p.get('access_token');
    const refresh_token = p.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
    const code = p.get('code');
    return code ? { code } : null;
  } catch {
    return null;
  }
}
