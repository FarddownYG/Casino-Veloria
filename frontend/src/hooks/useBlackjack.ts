import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/toast';
import { useSound } from '@/hooks/useSound';
import type { CardData } from '@/components/PlayingCard';

export interface BJHand {
  cards: CardData[];
  bet: number;
  status: string;
  value: number;
}
export interface BJSeat {
  userId: string;
  username: string;
  seat: number;
  bet: number;
  hasBet: boolean;
  activeHand: number;
  hands: BJHand[];
}
export interface BJState {
  tableId: string;
  phase: 'WAITING' | 'BETTING' | 'PLAYER_TURN' | 'DEALER' | 'PAYOUT';
  timer: number;
  activeUserId?: string;
  dealer: CardData[];
  dealerValue?: number;
  seats: BJSeat[];
}

export type BJMove = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT';

export function useBlackjack(tableId: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  const { play } = useSound();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<BJState | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token || !tableId) return;
    const socket = createSocket('/blackjack');
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('table:join', { tableId }));
    socket.on('table:joined', () => setJoined(true));
    socket.on('table:left', () => setJoined(false));
    socket.on('table:state', (s: BJState) => setState(s));
    socket.on('deal', () => play('deal'));
    socket.on('turn', () => play('deal'));
    socket.on('result:seat', (p: { net: number }) => {
      if (p.net > 0) play('win');
      else if (p.net < 0) play('loss');
    });
    socket.on('error', (p: { reason: string }) => toast.error('Blackjack', p.reason));

    return () => {
      socket.emit('table:leave', { tableId });
      socket.disconnect();
      socketRef.current = null;
      setState(null);
      setJoined(false);
    };
  }, [token, tableId, play]);

  const bet = useCallback(
    (amount: number) => socketRef.current?.emit('bet', { tableId, amount }),
    [tableId],
  );
  const action = useCallback(
    (move: BJMove) => socketRef.current?.emit('action', { tableId, move }),
    [tableId],
  );
  const leave = useCallback(() => socketRef.current?.emit('table:leave', { tableId }), [tableId]);

  return { state, joined, bet, action, leave };
}
