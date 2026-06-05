import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';

export interface LobbyTable {
  id: string;
  type: string;
  name: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
  status: string;
  seated: number;
}

export interface HotStreak {
  username: string;
  amount: number;
  gameType: string;
  id: number;
}

export interface CasinoEarnings {
  totalEarnings: number;
  totalWagered: number;
  roundsPlayed: number;
}

export interface LbEntry {
  rank: number;
  username: string;
  value: number;
  badge: string;
}

export function useLobby() {
  const token = useAuthStore((s) => s.accessToken);
  const [online, setOnline] = useState(0);
  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [streaks, setStreaks] = useState<HotStreak[]>([]);
  const [casino, setCasino] = useState<CasinoEarnings | null>(null);
  const [wealth, setWealth] = useState<LbEntry[]>([]);
  const [gains, setGains] = useState<LbEntry[]>([]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = createSocket('/lobby');
    let counter = 0;

    socket.on('presence', (p: { online: number }) => setOnline(p.online));
    socket.on('tables', (p: { tables: LobbyTable[] }) => setTables(p.tables));
    socket.on('casino:earnings', (p: CasinoEarnings) => setCasino(p));
    socket.on('leaderboard:wealth', (p: { entries: LbEntry[] }) => setWealth(p.entries));
    socket.on('leaderboard:gains', (p: { entries: LbEntry[] }) => setGains(p.entries));
    socket.on('hotstreak', (p: Omit<HotStreak, 'id'>) => {
      setStreaks((prev) => [{ ...p, id: counter++ }, ...prev].slice(0, 8));
    });

    socket.emit('tables:subscribe', {});
    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { online, tables, streaks, casino, wealth, gains };
}
