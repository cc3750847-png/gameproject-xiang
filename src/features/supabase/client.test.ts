import { describe, expect, it, vi } from 'vitest';

describe('supabase client configuration', () => {
  it('reports missing env vars without exposing secrets', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { getSupabaseConfigStatus } = await import('./client');

    expect(getSupabaseConfigStatus()).toEqual({
      configured: false,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    });
  });

  it('accepts public Supabase frontend env vars', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');

    const { getSupabaseConfigStatus } = await import('./client');

    expect(getSupabaseConfigStatus()).toEqual({ configured: true, missing: [] });
  });
});
