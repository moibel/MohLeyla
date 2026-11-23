// Supabase Edge Function "push": sends the notification for one event to the phones of the people it concerns.
// Called by the database (pg_net, see supabase/migrations/011_push.sql) with a shared secret; nobody else can use it.
// Deploy: supabase functions deploy push --no-verify-jwt     (set the secrets first: docs/PUSH_NOTIFICATIONS.md)
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { apnsJwt, apnsRequest, buildNotification, fcmAssertion, fcmRequest, isDeadToken, safeEqual, validateRequest } from './lib.js';

const env = (k: string) => Deno.env.get(k) || '';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let apnsCache: { jwt: string; at: number } | null = null;
let fcmCache: { token: string; at: number } | null = null;

async function apnsToken() {
  const now = Math.floor(Date.now() / 1000);
  if (apnsCache && now - apnsCache.at < 2400) return apnsCache.jwt; // reuse for 40 minutes (Apple: refresh between 20 and 60)
  const jwt = await apnsJwt({ teamId: env('APNS_TEAM_ID'), keyId: env('APNS_KEY_ID'), privateKeyPem: env('APNS_KEY_P8') }, now);
  apnsCache = { jwt, at: now };
  return jwt;
}

async function fcmAccess(sa: any) {
  const now = Math.floor(Date.now() / 1000);
  if (fcmCache && now - fcmCache.at < 3000) return fcmCache.token;
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await fcmAssertion(sa, now) }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('could not get a Google access token');
  fcmCache = { token: data.access_token, at: now };
  return fcmCache.token;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!env('PUSH_SECRET') || !safeEqual(req.headers.get('x-push-secret'), env('PUSH_SECRET'))) return json(401, { error: 'unauthorised' });

  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: 'bad json' }); }
  const v = validateRequest(body);
  if (!v.ok) return json(400, { error: v.error });
  const { kind, users, payload } = v.value;

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const tokens: { token: string; platform: string; lang: string }[] = [];
  for (let i = 0; i < users.length; i += 200) {
    const { data, error } = await db.from('push_tokens').select('token, platform, lang').in('user_id', users.slice(i, i + 200));
    if (error) return json(500, { error: 'lookup failed' });
    tokens.push(...(data || []));
  }

  const topic = env('APNS_TOPIC') || 'com.mohleyla.app';
  const sandbox = env('APNS_ENV') === 'sandbox';
  const haveApns = !!(env('APNS_KEY_P8') && env('APNS_KEY_ID') && env('APNS_TEAM_ID'));
  let sa: any = null;
  try { sa = env('FCM_SERVICE_ACCOUNT') ? JSON.parse(env('FCM_SERVICE_ACCOUNT')) : null; } catch { sa = null; }

  const stats = { sent: 0, removed: 0, failed: 0, skipped: 0 };
  const dead: string[] = [];
  const sendOne = async (t: { token: string; platform: string; lang: string }) => {
    try {
      const n = buildNotification(kind, payload, t.lang);
      let req2; let platform = t.platform;
      if (platform === 'ios') {
        if (!haveApns) { stats.skipped++; return; }
        req2 = apnsRequest(t.token, n, { topic, sandbox, jwt: await apnsToken() });
      } else {
        if (!sa) { stats.skipped++; return; }
        req2 = fcmRequest(t.token, n, { projectId: sa.project_id, accessToken: await fcmAccess(sa) });
      }
      const res = await fetch(req2.url, { method: 'POST', headers: req2.headers, body: req2.body });
      if (res.ok) { stats.sent++; return; }
      let detail: unknown = null;
      try { detail = await res.json(); } catch { /* no body */ }
      if (isDeadToken(platform, res.status, detail)) dead.push(t.token); else stats.failed++;
    } catch { stats.failed++; }
  };

  for (let i = 0; i < tokens.length; i += 20) await Promise.all(tokens.slice(i, i + 20).map(sendOne));
  if (dead.length) { await db.from('push_tokens').delete().in('token', dead); stats.removed = dead.length; }
  return json(200, stats);
});
