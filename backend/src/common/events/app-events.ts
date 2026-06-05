import { Rank } from '@prisma/client';

/** Domain event names used by the in-process EventEmitter for realtime fan-out. */
export const AppEvents = {
  BalanceUpdated: 'balance.updated',
  NotificationCreated: 'notification.created',
  RankUp: 'rank.up',
  CasinoUpdated: 'casino.updated',
  LeaderboardDirty: 'leaderboard.dirty',
  HotStreak: 'hotstreak',
  TablesChanged: 'tables.changed',
} as const;

export interface BalanceUpdatedEvent {
  userId: string;
  balance: number;
  delta: number;
  reason: string;
}

export interface NotificationCreatedEvent {
  userId: string;
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: unknown;
    createdAt: Date;
  };
}

export interface RankUpEvent {
  userId: string;
  rank: Rank;
}

export interface CasinoUpdatedEvent {
  totalEarnings: number;
  totalWagered: number;
  totalPaidOut: number;
  roundsPlayed: number;
}

export interface HotStreakEvent {
  username: string;
  amount: number;
  gameType: string;
}

export interface TablesChangedEvent {
  type: string;
}
