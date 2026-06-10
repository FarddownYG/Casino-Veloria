import type {
  BlackjackPhase,
  BlackjackResult,
  GameType,
  NotificationType,
  PokerMove,
  PokerPhase,
  Rank,
  RouletteBetType,
  RouletteColor,
  RoulettePhase,
} from './enums';
import type { LeaderboardEntry, TableSummary } from './models';

/**
 * NOTE: Only `RouletteBet` and the `/user` payloads below are imported at
 * runtime; they mirror the live gateway emits. The per-game *state* payloads
 * (blackjack/poker `table:state`, etc.) are a design reference and the
 * authoritative, runtime-accurate shapes live in the corresponding hooks
 * (useBlackjack `BJState`, usePoker `PKState`). Treat those state types here as
 * illustrative and verify against the gateway before relying on them.
 */

// ===========================================================================
// /user namespace
// ===========================================================================
export interface BalanceUpdatePayload {
  balance: number;
  delta: number;
  reason: string;
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface RankUpPayload {
  rank: Rank;
}

export interface TransactionPayload {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  gameType?: GameType | null;
  description?: string | null;
  createdAt: string;
}

// ===========================================================================
// /lobby namespace
// ===========================================================================
export interface PresencePayload {
  online: number;
}

export interface HotStreakPayload {
  username: string;
  amount: number;
  gameType: GameType;
}

export interface TablesPayload {
  tables: TableSummary[];
}

export interface CasinoEarningsPayload {
  totalEarnings: number;
  totalWagered: number;
  roundsPlayed: number;
}

export interface LeaderboardPayload {
  entries: LeaderboardEntry[];
}

// ===========================================================================
// /roulette namespace
// ===========================================================================
export interface RouletteBet {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
}

export interface RouletteBettor {
  username: string;
  totalStake: number;
}

export interface RouletteStatePayload {
  phase: RoulettePhase;
  timer: number;
  players: number; // count of connected clients in the room
  bettors?: RouletteBettor[];
  history: number[];
  roundId?: string;
  seedHash?: string;
}

export interface RouletteBetAcceptedPayload {
  bets: RouletteBet[];
  totalStake: number;
  balance: number;
}

export interface RouletteBetRejectedPayload {
  reason: string;
}

export interface RouletteSpinStartPayload {
  targetNumber: number;
  color: RouletteColor;
  spinSeedHash: string;
  duration: number;
}

export interface RouletteSpinResultPayload {
  number: number;
  color: RouletteColor;
  round: string; // round id (UUID)
}

export interface RoulettePayoutPayload {
  winnings: number;
  net: number;
  balance: number;
  winningBets: RouletteBet[];
}

export interface RouletteHistoryPayload {
  results: number[];
}

// ===========================================================================
// /blackjack namespace
// ===========================================================================
export interface PlayingCard {
  rank: string; // 'A','2'..'10','J','Q','K'
  suit: 'S' | 'H' | 'D' | 'C';
  hidden?: boolean;
}

export interface BlackjackSeat {
  seat: number;
  userId: string | null;
  username: string | null;
  rank?: Rank;
  stack: number;
  bet: number;
  hand: PlayingCard[];
  handValue?: number;
  isActive: boolean;
  result?: BlackjackResult;
}

export interface BlackjackDealer {
  hand: PlayingCard[];
  handValue?: number;
}

export interface BlackjackTableInfo {
  id: string;
  name: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
}

export interface BlackjackStatePayload {
  table: BlackjackTableInfo;
  seats: BlackjackSeat[];
  dealer: BlackjackDealer;
  phase: BlackjackPhase;
  activeSeat: number | null;
  timer: number;
}

export interface BlackjackDealPayload {
  hands: { seat: number; hand: PlayingCard[] }[];
  dealerUp: PlayingCard;
}

export interface BlackjackTurnPayload {
  seat: number;
  timer: number;
}

export interface BlackjackResultPayload {
  outcomes: { seat: number; result: BlackjackResult; payout: number }[];
  dealer: BlackjackDealer;
}

export interface GameErrorPayload {
  reason: string;
}

// ===========================================================================
// /poker namespace
// ===========================================================================
export interface PokerSeat {
  seat: number;
  userId: string | null;
  username: string | null;
  rank?: Rank;
  stack: number;
  bet: number; // current street contribution
  folded: boolean;
  allIn: boolean;
  isActive: boolean;
  isDealer?: boolean;
  cards?: PlayingCard[]; // only present for self / at showdown
}

export interface PokerBlinds {
  small: number;
  big: number;
}

export interface PokerTableInfo {
  id: string;
  name: string;
  maxSeats: number;
}

export interface PokerStatePayload {
  table: PokerTableInfo;
  seats: PokerSeat[];
  board: PlayingCard[];
  pot: number;
  blinds: PokerBlinds;
  activeSeat: number | null;
  phase: PokerPhase;
}

export interface PokerHoleCardsPayload {
  cards: PlayingCard[];
}

export interface PokerActionAppliedPayload {
  seat: number;
  move: PokerMove;
  amount: number;
  pot: number;
}

export interface PokerStreetPayload {
  phase: 'FLOP' | 'TURN' | 'RIVER';
  board: PlayingCard[];
}

export interface PokerShowdownPayload {
  hands: { seat: number; cards: PlayingCard[]; description?: string }[];
  winners: number[];
  pot: number;
}

export interface PokerChatPayload {
  username: string;
  message: string;
  ts: number;
}

export interface PokerReactionPayload {
  username: string;
  emoji: string;
}
