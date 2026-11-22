import { useState } from 'react';
import { displayName, initialsOf, colorIndex } from '../features/sync/profile.js';

/** Profile picture (Google photo when there is one) with a coloured-initials fallback that also covers a broken image. */
export default function Avatar({ profile, size = 36, className = '' }) {
  const [broken, setBroken] = useState(false);
  const name = displayName(profile);
  const style = { inlineSize: size, blockSize: size, fontSize: Math.round(size * 0.4) };
  if (profile?.avatarUrl && !broken) {
    return <img className={`avatar ${className}`} style={style} src={profile.avatarUrl} alt="" width={size} height={size} referrerPolicy="no-referrer" decoding="async" onError={() => setBroken(true)} data-testid="avatar-img" />;
  }
  return <span className={`avatar avatar-c${colorIndex(profile?.email || name)} ${className}`} style={style} aria-hidden="true" data-testid="avatar-initials">{initialsOf(name)}</span>;
}
