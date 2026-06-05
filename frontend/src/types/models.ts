import type {
  BankLoanStatus,
  GameType,
  NotificationType,
  P2PLoanStatus,
  Rank,
  Role,
  TableStatus,
  TransactionType,
} from './enums';

// ---- Users -----------------------------------------------------------------

/** Private profile returned by /auth/me and /users/me. */
export interface PrivateUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  balance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netGains: number;
  rank: Rank;
  referralCode: string;
  loginStreak: number;
  soundEnabled: boolean;
  marketingConsent: boolean;
  ageVerifiedAt: string | null;
  createdAt: string;
}

/** Public profile returned by /users/:username. */
export interface PublicUser {
  id: string;
  username: string;
  balance: number;
  rank: Rank;
  netGains: number;
  createdAt: string;
}

export interface AuthResponse {
  user: PrivateUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ---- Transactions / history ------------------------------------------------

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  gameType: GameType | null;
  refId: string | null;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface BetHistoryEntry {
  id: string;
  gameType: GameType;
  betType: string;
  stake: number;
  payout: number;
  won: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Loans -----------------------------------------------------------------

export interface BankLoan {
  id: string;
  userId: string;
  principal: number;
  interestAccrued: number;
  amountDue: number;
  amountRepaid: number;
  status: BankLoanStatus;
  dueDate: string;
  daysOverdue: number;
  disbursedAt: string;
  repaidAt: string | null;
  createdAt: string;
}

export interface BankLoanState {
  loan: BankLoan | null;
  eligible: boolean;
  /** Allowed loan amounts to offer (e.g. 500/1000/2500). */
  allowedAmounts: number[];
}

export interface P2PNegotiationEntry {
  by: 'LENDER' | 'BORROWER';
  amount?: number;
  interestRate?: number;
  durationDays?: number;
  at: string;
}

export interface P2PLoan {
  id: string;
  lenderId: string;
  lenderUsername: string;
  borrowerId: string;
  borrowerUsername: string;
  amount: number;
  interestRate: number;
  durationDays: number;
  amountDue: number;
  amountRepaid: number;
  penaltyRate: number;
  status: P2PLoanStatus;
  negotiation: P2PNegotiationEntry[] | null;
  dueDate: string | null;
  acceptedAt: string | null;
  repaidAt: string | null;
  createdAt: string;
}

export interface P2PLoanState {
  incoming: P2PLoan[];
  outgoing: P2PLoan[];
}

export interface Gift {
  id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  recipientUsername: string;
  amount: number;
  message: string | null;
  createdAt: string;
}

export interface GiftState {
  sent: Gift[];
  received: Gift[];
  /** Remaining VC the sender may still gift today (server-computed). */
  remainingToday: number;
  dailyLimit: number;
}

// ---- Referral --------------------------------------------------------------

export interface ReferralEntry {
  username: string;
  rank: Rank;
  joinedAt: string;
  earned: number;
}

export interface ReferralDashboard {
  code: string;
  referralLink: string;
  count: number;
  totalEarned: number;
  referrals: ReferralEntry[];
}

// ---- Leaderboard -----------------------------------------------------------

export interface LeaderboardEntry {
  rank: Rank;
  position: number;
  username: string;
  value: number; // balance for wealth, netGains for gains
}

export interface CasinoEarnings {
  totalEarnings: number;
  totalWagered: number;
  totalPaidOut?: number;
  roundsPlayed: number;
}

// ---- Tables ----------------------------------------------------------------

export interface TableSummary {
  id: string;
  type: GameType;
  name: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
  seatedCount: number;
  status: TableStatus;
  createdByUsername?: string | null;
}

export interface TableDetail extends TableSummary {
  config?: Record<string, unknown> | null;
  state?: Record<string, unknown> | null;
  createdAt: string;
}

// ---- Notifications ---------------------------------------------------------

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

// ---- Streak ----------------------------------------------------------------

export interface StreakStatus {
  loginStreak: number;
  claimed: boolean;
  rewardAmount: number;
  nextClaimAt: string | null;
}
