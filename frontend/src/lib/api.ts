import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE } from './env';
import { getAccessToken, getRefreshToken, useAuthStore } from '@/store/auth';
import type { RefreshResponse } from '@/types';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token to every request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// Single-flight refresh to avoid stampedes when many requests 401 at once.
let refreshPromise: Promise<string | null> | null = null;

async function refreshTokens(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Use a bare axios call so we don't recurse through this interceptor.
    const { data } = await axios.post<RefreshResponse>(`${API_BASE}/auth/refresh`, {
      refreshToken,
    });
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;
    const status = error.response?.status;

    // Don't try to refresh the refresh/login endpoints themselves.
    const url = original?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/auth/login');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      refreshPromise = refreshPromise ?? refreshTokens();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an axios error. */
export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (data?.error) return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
