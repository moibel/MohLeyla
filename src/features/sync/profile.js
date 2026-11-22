// Display profile derived from the auth user. Google supplies full_name/name and avatar_url/picture; email sign-ins can
// store a display_name in the account's user metadata (set from the app). Nothing here is read from the progress document.
export const MAX_NAME = 40;

/** Strip control characters and angle brackets, collapse spaces, limit length. React escapes output anyway. */
export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

export function profileFromUser(user) {
  const m = (user && user.user_metadata) || {};
  const avatar = m.avatar_url || m.picture || '';
  return {
    name: cleanName(m.display_name || m.full_name || m.name || ''),
    email: (user && user.email) || '',
    avatarUrl: typeof avatar === 'string' && /^https:\/\//i.test(avatar) ? avatar : null, // never render non-https image URLs
    createdAt: (user && user.created_at) || null,
  };
}

const emailPrefix = (email) => String(email || '').split('@')[0].replace(/[._+-]+/g, ' ').trim();

/** What to call the learner: their name, else the readable part of their email. */
export const displayName = (profile) => (profile && (profile.name || cleanName(emailPrefix(profile.email)))) || '';

/** One or two letters for the avatar fallback (works for Arabic names too). */
export function initialsOf(name) {
  const parts = cleanName(name).split(' ').filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0];
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
  return (first + second).toUpperCase();
}

/** Stable colour index from a string, so each learner keeps the same avatar colour. */
export function colorIndex(seed, n = 6) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % n;
}
