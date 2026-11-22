import { SyncManager } from './syncManager.js';
import { createSupabase, isSyncConfigured } from '../../services/supabaseClient.js';

export const sync = new SyncManager({ createClient: createSupabase, configured: isSyncConfigured() });
