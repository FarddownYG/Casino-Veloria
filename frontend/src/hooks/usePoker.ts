import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/toast';
import { useSound } from '@/hooks/useSound';
import type { CardData } from '@/components/PlayingCard';

export interface PKSeat {
  userId: string;
  username: string;
  seat: number;
  stack: number;
  streetBet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  hasCards: boolean;
}
export interface PKState {
  tableId: string;
  phase: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
  board: CardData[];
  pot: number;
  currentBet: number;
  buttonSeat: number;
  activeUserId?: string;
  timer: number;
  blinds: { small: number; big: number };
  seats: PKSeat[];
}
export interface ChatMsg {
  username: string;
  message: string;
  ts: number;
}
export interface Showdown {
  winners: { userId: string; username: string }[];
  revealed: { userId: string; hole: CardData[]; hand: string }[];
  pot: number;
}
export type PKMove = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALLIN';

export function usePoker(tableId: string | null, buyIn: number | null) {
  const token = useAuthStore((s) => s.accessToken);
  const { play } = useSound();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<PKState | null>(null);
  const [hole, setHole] = useState<CardData[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [reactions, setReactions] = useState<{ id: number; username: string; emoji: string }[]>([]);
  const [showdown, setShowdown] = useState<Showdown | null>(null);

  useEffect(() => {
    if (!token || !tableId || !buyIn) return;
    const socket = createSocket('/poker');
    socketRef.current = socket;
    let rid = 0;

    socket.on('connect', () => socket.emit('table:join', { tableId, buyIn }));
    socket.on('table:state', (s: PKState) => {
      setState(s);
      if (s.phase === 'PREFLOP') setShowdown(null);
    });
    socket.on('hole:cards', (p: { cards: CardData[] }) => {
      setHole(p.cards);
      play('deal');
    });
    socket.on('street', () => play('deal'));
    socket.on('action:applied', () => play('chip'));
    socket.on('showdown', (p: Showdown) => {
      setShowdown(p);
      play('win');
    });
    socket.on('chat', (m: ChatMsg) => setChat((c) => [...c, m].slice(-50)));
    socket.on('reaction', (p: { username: string; emoji: string }) =>
      setReactions((r) => [...r, { ...p, id: rid++ }].slice(-6)),
    );
    socket.on('error', (p: { reason: string }) => toast.error('Poker', p.reason));

    return () => {
      socket.emit('table:leave', { tableId });
      socket.disconnect();
      socketRef.current = null;
      setState(null);
      setHole([]);
      setChat([]);
      setShowdown(null);
    };
  }, [token, tableId, buyIn, play]);

  const act = useCallback(
    (move: PKMove, amount?: number) => socketRef.current?.emit('action', { tableId, move, amount }),
    [tableId],
  );
  const sendChat = useCallback(
    (message: string) => socketRef.current?.emit('chat', { tableId, message }),
    [tableId],
  );
  const react = useCallback(
    (emoji: string) => socketRef.current?.emit('reaction', { tableId, emoji }),
    [tableId],
  );
  const leave = useCallback(() => socketRef.current?.emit('table:leave', { tableId }), [tableId]);

  return { state, hole, chat, reactions, showdown, act, sendChat, react, leave };
}
