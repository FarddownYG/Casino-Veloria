import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { useSound } from '@/hooks/useSound';
import { celebrate } from '@/lib/celebrate';
import { toast } from '@/components/ui/toast';
import type {
  BalanceUpdatePayload,
  NotificationPayload,
  RankUpPayload,
} from '@/types/socket';
import { RANK_META } from '@/lib/ranks';
import { formatVC } from '@/lib/utils';

const NOTIF_TOAST_VARIANT: Record<string, 'default' | 'loan' | 'gift' | 'rank' | 'gain'> = {
  LOAN_RECEIVED: 'loan',
  LOAN_REPAYMENT_DUE: 'loan',
  LOAN_OVERDUE: 'loan',
  P2P_LOAN_OFFER: 'loan',
  P2P_LOAN_ACCEPTED: 'loan',
  GIFT_RECEIVED: 'gift',
  RANK_UP: 'rank',
  STREAK_BONUS: 'gain',
  REFERRAL_REWARD: 'gift',
};

/**
 * Connects to the per-user namespace and keeps the cached balance, notifications
 * and rank in sync. Drives win confetti / sounds. Mount once near the root when
 * authenticated.
 */
export function useUserSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const patchUser = useAuthStore((s) => s.patchUser);
  const qc = useQueryClient();
  const { play } = useSound();

  useEffect(() => {
    if (!accessToken) return;
    const socket: Socket = createSocket('/user');

    socket.on('balance:update', (p: BalanceUpdatePayload) => {
      patchUser({ balance: p.balance });
      const isWin = p.delta > 0 && /win|gain/i.test(p.reason);
      if (isWin) {
        celebrate(p.delta >= 1000 ? 'big' : 'small');
        play('win');
        toast.gain('Gain !', `+${formatVC(p.delta)} VC`);
      } else if (p.delta < 0 && /bet|mise|roulette|blackjack|poker/i.test(p.reason)) {
        play('chip');
      }
      qc.invalidateQueries({ queryKey: ['me'] });
    });

    socket.on('notification', (n: NotificationPayload) => {
      play('notify');
      toast.show({
        title: n.title,
        description: n.body,
        variant: NOTIF_TOAST_VARIANT[n.type] ?? 'default',
      });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('rank:up', (p: RankUpPayload) => {
      patchUser({ rank: p.rank });
      celebrate('big');
      toast.show({
        title: 'Nouveau rang !',
        description: `Vous êtes désormais ${RANK_META[p.rank]?.label ?? p.rank}`,
        variant: 'rank',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, patchUser, qc, play]);
}
