/**
 * European roulette engine (37 pockets, 0-36). Pure + deterministic.
 *
 * House edge is preserved for any inside selection of a given size because the
 * payout is keyed off the number of covered pockets:
 *   profit multiplier = floor(36 / k) - 1   (vs the fair 37/k - 1).
 */

export type RouletteColor = 'red' | 'black' | 'green';

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

export interface RouletteBet {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
}

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/** Profit multiplier ("x:1"). Total return on a win = stake * (multiplier + 1). */
export const PAYOUTS: Record<RouletteBetType, number> = {
  STRAIGHT: 35,
  SPLIT: 17,
  STREET: 11,
  CORNER: 8,
  SIXLINE: 5,
  COLUMN: 2,
  DOZEN: 2,
  RED: 1,
  BLACK: 1,
  ODD: 1,
  EVEN: 1,
  LOW: 1,
  HIGH: 1,
};

/** Required number of covered pockets for inside / group bets. */
const REQUIRED_COUNT: Partial<Record<RouletteBetType, number>> = {
  STRAIGHT: 1,
  SPLIT: 2,
  STREET: 3,
  CORNER: 4,
  SIXLINE: 6,
  COLUMN: 12,
  DOZEN: 12,
};

export function colorOf(n: number): RouletteColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

/** Server-authoritative covered pockets for even-money / outside bets. */
export function canonicalNumbers(type: RouletteBetType): number[] | null {
  switch (type) {
    case 'RED':
      return [...RED_NUMBERS];
    case 'BLACK':
      return range(1, 36).filter((n) => !RED_NUMBERS.has(n));
    case 'ODD':
      return range(1, 36).filter((n) => n % 2 === 1);
    case 'EVEN':
      return range(1, 36).filter((n) => n % 2 === 0);
    case 'LOW':
      return range(1, 18);
    case 'HIGH':
      return range(19, 36);
    default:
      return null;
  }
}

export interface ValidationResult {
  ok: boolean;
  numbers: number[];
  reason?: string;
}

/**
 * Validates a bet and returns the authoritative covered pockets. For outside
 * bets the client `numbers` are ignored (computed server-side). For inside
 * bets the count is enforced and numbers must be unique within 0-36.
 */
export function validateBet(bet: RouletteBet): ValidationResult {
  if (!Number.isInteger(bet.amount) || bet.amount <= 0) {
    return { ok: false, numbers: [], reason: 'Invalid stake' };
  }

  const canonical = canonicalNumbers(bet.type);
  if (canonical) return { ok: true, numbers: canonical };

  const required = REQUIRED_COUNT[bet.type];
  if (required === undefined) {
    return { ok: false, numbers: [], reason: 'Unknown bet type' };
  }

  const nums = bet.numbers ?? [];
  const unique = new Set(nums);
  if (
    nums.length !== required ||
    unique.size !== required ||
    nums.some((n) => !Number.isInteger(n) || n < 0 || n > 36)
  ) {
    return {
      ok: false,
      numbers: [],
      reason: `${bet.type} must cover exactly ${required} valid pocket(s)`,
    };
  }
  return { ok: true, numbers: [...unique] };
}

export function isWinning(numbers: number[], winning: number): boolean {
  return numbers.includes(winning);
}

/** Returns total return (stake + profit) for a winning bet, else 0. */
export function settleBet(
  type: RouletteBetType,
  coveredNumbers: number[],
  stake: number,
  winning: number,
): number {
  if (!isWinning(coveredNumbers, winning)) return 0;
  return stake * (PAYOUTS[type] + 1);
}

/** Maps a [0,1) float to a pocket 0-36. */
export function pocketFromFloat(x: number): number {
  return Math.min(36, Math.floor(x * 37));
}
