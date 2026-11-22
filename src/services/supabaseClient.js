// Supabase is optional: without these two build-time variables the app runs purely locally and hides account features.
// The anon (public) key is designed to be shipped to browsers; data is protected by row-level security (supabase/schema.sql).
// NEVER put a service_role key here.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const AUTH_STORAGE_KEY = 'mohleyla-auth';
export const isSyncConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
/** Build-time switch (VITE_REQUIRE_SIGN_IN=true): every learner must sign in with their own email before using the app. */
export const REQUIRE_SIGN_IN = import.meta.env.VITE_REQUIRE_SIGN_IN === 'true' && isSyncConfigured();
export const authInUrl = () => typeof location !== 'undefined' && /access_token=|[?&]code=|type=magiclink/.test(location.hash + location.search);

/** Loads supabase-js on demand (kept out of the main bundle). */
export async function createSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
  });
}

/** True when a session is stored or an auth redirect is in the URL, i.e. we should connect at startup. */
export function shouldConnectAtStartup() {
  try {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) return true;
  } catch { /* storage blocked */ }
  return typeof location !== 'undefined' && /access_token=|[?&]code=|type=magiclink/.test(location.hash + location.search);
}
