import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type SupabaseConfigStatus = {
  configured: boolean;
  missing: string[];
};

let browserClient: SupabaseClient | null = null;

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing = [
    { key: 'VITE_SUPABASE_URL', value: SUPABASE_URL },
    { key: 'VITE_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY },
  ]
    .filter(({ value }) => !value)
    .map(({ key }) => key);

  return {
    configured: missing.length === 0,
    missing,
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const status = getSupabaseConfigStatus();

  if (!status.configured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
