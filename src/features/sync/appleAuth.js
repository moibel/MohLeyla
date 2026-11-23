// Sign in with Apple, native iOS side. Apple signs a token that contains the SHA-256 of a one-time random value (the nonce);
// Supabase checks that token against the raw value. That stops a stolen token from being replayed in another sign-in.
import { nativePlatform } from '../../utils/platform.js';

export const canUseNativeApple = () => nativePlatform() === 'ios';

export function randomNonce(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Opens Apple's sign-in sheet. Resolves { identityToken, rawNonce, givenName, familyName }; rejects with code 'canceled' if the person closes it. */
export async function appleNativeAuthorize() {
  const { registerPlugin } = await import('@capacitor/core');
  const AppleSignIn = registerPlugin('AppleSignIn');
  const rawNonce = randomNonce();
  const res = await AppleSignIn.authorize({ nonce: await sha256Hex(rawNonce) });
  return { identityToken: res.identityToken, rawNonce, givenName: res.givenName || '', familyName: res.familyName || '' };
}
