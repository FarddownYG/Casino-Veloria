import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GameType } from '@/types';

export interface LobbyTableInfo {
  id: string;
  type: GameType;
  name: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
  status: string;
  seated: number;
  host?: string;
  config?: Record<string, unknown> | null;
}

export interface CreateTableInput {
  type: GameType;
  name: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
  smallBlind?: number;
}

export function useTables(type: GameType) {
  return useQuery({
    queryKey: ['tables', type],
    queryFn: async () => {
      const { data } = await api.get<LobbyTableInfo[]>('/games/tables', { params: { type } });
      return data;
    },
    refetchInterval: 5_000,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTableInput) => {
      const { data } = await api.post<LobbyTableInfo>('/games/tables', input);
      return data;
    },
    onSuccess: (t) => qc.invalidateQueries({ queryKey: ['tables', t.type] }),
  });
}
