import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Supabase client used purely as the Google identity provider. After the OAuth
 * redirect we hand the Supabase access token to our own backend (`/auth/google`),
 * which issues the VELORIA session — Supabase is not used for app data.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  },
});

export const PENDING_REF_KEY = 'veloria_pending_ref';
