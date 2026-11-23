// Supabase Edge Function "delete-account": deletes the signed-in person's account and personal data (App Store / Google Play requirement).
// The app calls it with the person's own sign-in token; it cannot be used for anyone else. Setup: docs/ACCOUNT_DELETION.md
// Deploy: supabase functions deploy delete-account          (JWT verification stays ON)
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { BUCKET, appleClientSecret, appleRevokeRequest, appleTokenRequest, chunk, hasAppleIdentity, safeFilePaths, validateBody } from './lib.js';

const env = (k: string) => Deno.env.get(k) || '';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'unauthorised' });
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await db.auth.getUser(jwt); // the person is whoever the token says: never taken from the body
  if (whoErr || !who?.user) return json(401, { error: 'unauthorised' });
  const user = who.user;

  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: 'bad json' }); }
  const v = validateBody(body);
  if (!v.ok) return json(400, { error: v.error });

  // 1. what will disappear (and a refusal when this is the last admin)
  const { data: paths, error: prepErr } = await db.rpc('account_delete_prepare', { p_user: user.id });
  if (prepErr) return json(prepErr.code === '55000' ? 409 : 500, { error: prepErr.code === '55000' ? 'lastAdmin' : 'prepare' });

  // 2. Apple: revoke the Sign in with Apple token (needs the code from a fresh Apple sign-in sheet and the key secrets)
  let appleRevoked: boolean | null = null; // null = not an Apple account
  if (hasAppleIdentity(user)) {
    appleRevoked = false;
    const have = env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_KEY_P8') && env('APPLE_CLIENT_ID');
    if (have && v.value.appleCode) {
      try {
        const secret = await appleClientSecret({ teamId: env('APPLE_TEAM_ID'), keyId: env('APPLE_KEY_ID'), clientId: env('APPLE_CLIENT_ID'), privateKeyPem: env('APPLE_KEY_P8') }, Math.floor(Date.now() / 1000));
        const t = appleTokenRequest(v.value.appleCode, env('APPLE_CLIENT_ID'), secret);
        const tok = await fetch(t.url, { method: 'POST', headers: t.headers, body: t.body });
        const data: any = await tok.json().catch(() => ({}));
        if (!tok.ok || !data.refresh_token) return json(502, { error: 'appleRevoke' }); // nothing deleted yet: the person can try again
        const r = appleRevokeRequest(data.refresh_token, env('APPLE_CLIENT_ID'), secret);
        const rev = await fetch(r.url, { method: 'POST', headers: r.headers, body: r.body });
        if (!rev.ok) return json(502, { error: 'appleRevoke' });
        appleRevoked = true;
      } catch { return json(502, { error: 'appleRevoke' }); }
    }
  }

  // 3. delete the sign-in: every table that points at the user cascades from here
  const { error: delErr } = await db.auth.admin.deleteUser(user.id);
  if (delErr) return json(500, { error: 'delete' });

  // 4. data stored by e-mail address, and the chat files (best effort: the account is already gone, so failures are only logged)
  try { if (user.email) await db.rpc('account_delete_cleanup', { p_email: user.email }); } catch (e) { console.error('cleanup failed', String(e)); }
  let filesRemoved = 0;
  for (const part of chunk(safeFilePaths(paths), 100)) {
    const { data, error } = await db.storage.from(BUCKET).remove(part);
    if (error) console.error('file removal failed', error.message); else filesRemoved += data?.length || 0;
  }
  return json(200, { ok: true, appleRevoked, filesRemoved });
});
