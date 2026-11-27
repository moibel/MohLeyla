// Supabase Edge Function "purge-files": permanently removes chat files that are older than 90 days, belong to a removed
// message, or were uploaded but never sent (24 hours), and old call connection messages. Needs migration 014.
// Called once a day by the database (pg_cron + pg_net, snippet at the end of 014_security_hardening.sql) with a shared secret.
// Setup:  supabase secrets set PURGE_SECRET=<24 or more random characters>
// Deploy: supabase functions deploy purge-files --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { BUCKET, authorised, purge } from './lib.js';

const env = (k: string) => Deno.env.get(k) || '';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!authorised(req.headers.get('x-purge-secret'), env('PURGE_SECRET'))) return json(401, { error: 'unauthorised' });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const stats = await purge({
    list: (limit: number) => db.rpc('expired_chat_files', { p_limit: limit }),
    remove: (paths: string[]) => db.storage.from(BUCKET).remove(paths),
  });
  if (stats.error) console.error('file purge failed at', stats.error);

  const { data: signals, error: sigErr } = await db.rpc('purge_call_signals');
  if (sigErr) console.error('signal purge failed', sigErr.message);
  return json(stats.error || sigErr ? 500 : 200, { ...stats, signals: signals ?? 0 });
});
