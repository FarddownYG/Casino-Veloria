import { create } from 'zustand';
import type { PrivateUser } from '@/types';

const ACCESS_KEY = 'veloria_access_token';
const REFRESH_KEY = 'veloria_refresh_token';
const USER_KEY = 'veloria_user';

interface AuthState {
  user: PrivateUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;

  /** Persist a full login result. */
  login: (user: PrivateUser, accessToken: string, refreshToken: string) => void;
  /** Clear everything (does not call the API). */
  logout: () => void;
  /** Replace tokens (after refresh). */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Update the cached user object (e.g. after settings change / balance sync). */
  setUser: (user: PrivateUser) => void;
  /** Patch a subset of user fields. */
  patchUser: (patch: Partial<PrivateUser>) => void;
  /** Load tokens + user from localStorage on app start. */
  hydrate: () => void;
}

function readUser(): PrivateUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PrivateUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  logout: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    set({ user: next });
  },

  hydrate: () => {
    set({
      accessToken: localStorage.getItem(ACCESS_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: readUser(),
      hydrated: true,
    });
  },
}));

/** Non-reactive token accessor for axios / socket interceptors. */
export const getAccessToken = () => useAuthStore.getState().accessToken;
export const getRefreshToken = () => useAuthStore.getState().refreshToken;
