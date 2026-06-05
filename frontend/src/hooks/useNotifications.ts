import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppNotification } from '@/types';

interface NotificationsResponse {
  items: AppNotification[];
  unread: number;
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<NotificationsResponse>('/notifications');
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkNotifications() {
  const qc = useQueryClient();
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return { markRead, markAll };
}
