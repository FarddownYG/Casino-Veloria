import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LbEntry } from '@/hooks/useLobby';

interface CasinoStat {
  totalEarnings: number;
  totalWagered: number;
  totalPaidOut: number;
  roundsPlayed: number;
}

export function useLeaderboard() {
  const wealth = useQuery({
    queryKey: ['lb', 'wealth'],
    queryFn: async () => (await api.get<LbEntry[]>('/leaderboard/wealth', { params: { limit: 50 } })).data,
    refetchInterval: 10_000,
  });
  const gains = useQuery({
    queryKey: ['lb', 'gains'],
    queryFn: async () => (await api.get<LbEntry[]>('/leaderboard/gains', { params: { limit: 50 } })).data,
    refetchInterval: 10_000,
  });
  const casino = useQuery({
    queryKey: ['lb', 'casino'],
    queryFn: async () => (await api.get<CasinoStat>('/leaderboard/casino')).data,
    refetchInterval: 10_000,
  });
  return { wealth, gains, casino };
}
