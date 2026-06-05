/** Centralised access to Vite env vars. */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:4000';

export const API_BASE = `${API_URL}/api`;

// --- Supabase (Google OAuth) ---
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://ejozdljwafoydynduboe.supabase.co';

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h';

/** Whether Supabase-backed Google sign-in is configured. */
export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
