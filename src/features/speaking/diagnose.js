// Works out WHY the microphone request was refused, so the app can say the right thing and offer the right fix.
//  'policy'    this page was served with a Permissions-Policy that disables the microphone (e.g. an old cached copy)
//  'blocked'   the user (or the browser) blocked the microphone for this site
//  'dismissed' the permission pop-up was closed without choosing; asking again shows it again
//  'unknown'   the browser cannot tell (e.g. Safari)
export async function diagnoseMicBlock(doc = typeof document !== 'undefined' ? document : null, nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    const pp = doc && (doc.permissionsPolicy || doc.featurePolicy);
    if (pp && typeof pp.allowsFeature === 'function' && pp.allowsFeature('microphone') === false) return 'policy';
  } catch { /* ignore */ }
  try {
    if (nav && nav.permissions && nav.permissions.query) {
      const status = await nav.permissions.query({ name: 'microphone' });
      if (status.state === 'denied') return 'blocked';
      if (status.state === 'prompt') return 'dismissed';
    }
  } catch { /* unsupported name: fall through */ }
  return 'unknown';
}
