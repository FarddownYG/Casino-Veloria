// Enums mirroring backend/prisma/schema.prisma

export type Role = 'USER' | 'ADMIN';

export type Rank = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';

export type TransactionType =
  | 'SIGNUP_BONUS'
  | 'REFERRAL_BONUS_REFERRER'
  | 'REFERRAL_BONUS_REFERRED'
  | 'DAILY_STREAK'
  | 'BET_PLACED'
  | 'BET_PAYOUT'
  | 'BET_REFUND'
  | 'BANK_LOAN_DISBURSEMENT'
  | 'BANK_LOAN_REPAYMENT'
  | 'BANK_LOAN_INTEREST'
  | 'P2P_LOAN_DISBURSEMENT'
  | 'P2P_LOAN_RECEIVED'
  | 'P2P_LOAN_REPAYMENT_OUT'
  | 'P2P_LOAN_REPAYMENT_IN'
  | 'P2P_LOAN_PENALTY'
  | 'GIFT_SENT'
  | 'GIFT_RECEIVED'
  | 'ADMIN_ADJUSTMENT';

export type GameType = 'ROULETTE' | 'BLACKJACK' | 'POKER';

export type BankLoanStatus = 'ACTIVE' | 'REPAID' | 'DEFAULTED';

export type P2PLoanStatus =
  | 'PROPOSED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REPAID'
  | 'DEFAULTED'
  | 'REJECTED'
  | 'CANCELLED';

export type TableStatus = 'WAITING' | 'IN_PROGRESS' | 'CLOSED';

export type NotificationType =
  | 'GENERIC'
  | 'GAIN'
  | 'LOSS'
  | 'LOAN_RECEIVED'
  | 'LOAN_REPAYMENT_DUE'
  | 'LOAN_OVERDUE'
  | 'P2P_LOAN_OFFER'
  | 'P2P_LOAN_ACCEPTED'
  | 'P2P_LOAN_REJECTED'
  | 'P2P_LOAN_NEGOTIATION'
  | 'GIFT_RECEIVED'
  | 'RANK_UP'
  | 'STREAK_BONUS'
  | 'REFERRAL_REWARD';

// Roulette
export type RouletteBetType =
  | 'STRAIGHT'
  | 'SPLIT'
  | 'STREET'
  | 'CORNER'
  | 'SIXLINE'
  | 'COLUMN'
  | 'DOZEN'
  | 'RED'
  | 'BLACK'
  | 'ODD'
  | 'EVEN'
  | 'LOW'
  | 'HIGH';

export type RoulettePhase = 'BETTING' | 'SPINNING' | 'PAYOUT';
export type RouletteColor = 'RED' | 'BLACK' | 'GREEN';

// Blackjack
export type BlackjackMove = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT';
export type BlackjackPhase = 'WAITING' | 'BETTING' | 'DEALING' | 'PLAYING' | 'DEALER' | 'PAYOUT';
export type BlackjackResult = 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'BUST';

// Poker
export type PokerMove = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALLIN';
export type PokerPhase = 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
