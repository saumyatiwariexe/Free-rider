import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy singletons — clients are created on first use, not at module load.
 * This prevents boot-time crashes when env vars are checked before being needed.
 */

let _browserClient: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

/**
 * Browser / client-component client.
 * Uses the anon key — subject to Row-Level Security.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(
      getEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    );
  }
  return _browserClient;
}

/**
 * Server-only admin client.
 * Uses the service-role key — bypasses RLS.
 * NEVER expose this to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      getEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );
  }
  return _adminClient;
}
