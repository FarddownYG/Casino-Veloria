import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/toast';
import { useSound } from '@/hooks/useSound';
import type { RouletteBet } from '@/types/socket';

export type RoulettePhase = 'BETTING' | 'SPINNING' | 'PAYOUT';

export interface SpinResult {
  number: number;
  color: string;
}

export function useRoulette() {
  const token = useAuthStore((s) => s.accessToken);
  const { play } = useSound();
  const socketRef = useRef<Socket | null>(null);

  const [phase, setPhase] = useState<RoulettePhase>('BETTING');
  const [deadline, setDeadline] = useState(0);
  const [timer, setTimer] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [players, setPlayers] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [spinNonce, setSpinNonce] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [myBets, setMyBets] = useState<RouletteBet[]>([]);
  const [stake, setStake] = useState(0);
  const [lastPayout, setLastPayout] = useState<{ winnings: number; net: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = createSocket('/roulette');
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join', {}));
    socket.on('state', (s: { phase: RoulettePhase; timer: number; history?: number[]; players?: number }) => {
      setPhase(s.phase);
      setDeadline(Date.now() + (s.timer ?? 0));
      if (s.history) setHistory(s.history);
      if (typeof s.players === 'number') setPlayers(s.players);
      if (s.phase === 'BETTING') {
        setMyBets([]);
        setStake(0);
        setResult(null);
        setLastPayout(null);
      }
    });
    socket.on('history', (p: { results: number[] }) => setHistory(p.results));
    socket.on('spin:start', (p: { targetNumber: number; duration: number }) => {
      setPhase('SPINNING');
      setTarget(p.targetNumber);
      setSpinNonce((n) => n + 1);
      setDeadline(Date.now() + (p.duration ?? 6000));
      play('spin');
    });
    socket.on('spin:result', (p: SpinResult) => {
      setResult(p);
      setHistory((h) => [p.number, ...h].slice(0, 20));
    });
    socket.on('payout', (p: { winnings: number; net: number }) => {
      setLastPayout({ winnings: p.winnings, net: p.net });
      if (p.net > 0) toast.gain('Roulette', `+${p.net} VC`);
    });
    socket.on('bet:accepted', (p: { bets: RouletteBet[]; totalStake: number }) => {
      setMyBets(p.bets);
      setStake(p.totalStake);
      play('chip');
    });
    socket.on('bet:rejected', (p: { reason: string }) => toast.error('Mise refusée', p.reason));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, play]);

  // Local countdown.
  useEffect(() => {
    const id = setInterval(() => setTimer(Math.max(0, deadline - Date.now())), 100);
    return () => clearInterval(id);
  }, [deadline]);

  const placeBets = useCallback((bets: RouletteBet[]) => {
    socketRef.current?.emit('bet:place', { bets });
  }, []);
  const clearBets = useCallback(() => socketRef.current?.emit('bet:clear', {}), []);
  const requestSpin = useCallback(() => socketRef.current?.emit('spin:request', {}), []);

  return {
    phase,
    timer,
    history,
    players,
    target,
    spinNonce,
    result,
    myBets,
    stake,
    lastPayout,
    placeBets,
    clearBets,
    requestSpin,
  };
}
