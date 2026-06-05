/** Centralised access to Vite env vars. */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:4000';

export const API_BASE = `${API_URL}/api`;
