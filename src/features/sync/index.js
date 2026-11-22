import { SyncManager } from './syncManager.js';
import { createSupabase, isSyncConfigured, authInUrl } from '../../services/supabaseClient.js';

export const sync = new SyncManager({ createClient: createSupabase, configured: isSyncConfigured(), authInUrl: authInUrl() });
