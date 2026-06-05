import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { setAgeConsent } from '@/lib/cookies';
import type { AuthResponse, PrivateUser } from '@/types';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  referralCode?: string;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export function useAuth() {
  return useAuthStore();
}

export function useIsAuthenticated() {
  return useAuthStore((s) => !!s.accessToken && !!s.user);
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { data } = await api.post<AuthResponse>('/auth/register', input);
      return data;
    },
    onSuccess: (data) => login(data.user, data.accessToken, data.refreshToken),
  });
}

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<AuthResponse>('/auth/login', input);
      return data;
    },
    onSuccess: (data) => login(data.user, data.accessToken, data.refreshToken),
  });
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
      }
    },
    onSettled: () => {
      logout();
      qc.clear();
    },
  });
}

/** Fetch + cache the private profile; keeps the auth store user in sync. */
export function useMe(enabled = true) {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<PrivateUser>('/users/me');
      setUser(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useAgeVerification() {
  const isAuth = useIsAuthenticated();
  return useMutation({
    mutationFn: async () => {
      setAgeConsent();
      if (isAuth) {
        await api.post('/users/me/age-verification').catch(() => undefined);
      }
    },
  });
}
