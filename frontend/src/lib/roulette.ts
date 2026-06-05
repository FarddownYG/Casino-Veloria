import type { RouletteBetType, RouletteColor } from '@/types';

// European single-zero wheel order (clockwise).
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function colorOf(n: number): RouletteColor {
  if (n === 0) return 'GREEN';
  return RED_NUMBERS.has(n) ? 'RED' : 'BLACK';
}

export function colorClass(n: number): string {
  const c = colorOf(n);
  if (c === 'GREEN') return 'bg-roulette-green';
  return c === 'RED' ? 'bg-roulette-red' : 'bg-roulette-black';
}

/** Payout multiplier (winnings = stake * multiplier; net = stake * (multiplier-1)). */
export const PAYOUT_MULTIPLIER: Record<RouletteBetType, number> = {
  STRAIGHT: 36,
  SPLIT: 18,
  STREET: 12,
  CORNER: 9,
  SIXLINE: 6,
  COLUMN: 3,
  DOZEN: 3,
  RED: 2,
  BLACK: 2,
  ODD: 2,
  EVEN: 2,
  LOW: 2,
  HIGH: 2,
};

export const BET_TYPE_LABEL: Record<RouletteBetType, string> = {
  STRAIGHT: 'Plein',
  SPLIT: 'Cheval',
  STREET: 'Transversale',
  CORNER: 'Carré',
  SIXLINE: 'Sixain',
  COLUMN: 'Colonne',
  DOZEN: 'Douzaine',
  RED: 'Rouge',
  BLACK: 'Noir',
  ODD: 'Impair',
  EVEN: 'Pair',
  LOW: 'Manque (1-18)',
  HIGH: 'Passe (19-36)',
};

/** The number grid as displayed on the betting board (3 rows x 12 columns). */
export const BOARD_ROWS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export function numbersForOutside(type: RouletteBetType): number[] {
  const all = Array.from({ length: 36 }, (_, i) => i + 1);
  switch (type) {
    case 'RED':
      return all.filter((n) => RED_NUMBERS.has(n));
    case 'BLACK':
      return all.filter((n) => !RED_NUMBERS.has(n));
    case 'ODD':
      return all.filter((n) => n % 2 === 1);
    case 'EVEN':
      return all.filter((n) => n % 2 === 0);
    case 'LOW':
      return all.filter((n) => n <= 18);
    case 'HIGH':
      return all.filter((n) => n >= 19);
    default:
      return [];
  }
}

export function dozenNumbers(index: 0 | 1 | 2): number[] {
  const start = index * 12 + 1;
  return Array.from({ length: 12 }, (_, i) => start + i);
}

export function columnNumbers(index: 0 | 1 | 2): number[] {
  // column 0 -> 1,4,7...; matches BOARD_ROWS bottom row order
  const start = index + 1;
  return Array.from({ length: 12 }, (_, i) => start + i * 3);
}

/** Angle (degrees) of a pocket centre on the wheel, 0 at top, clockwise. */
export function pocketAngle(n: number): number {
  const idx = WHEEL_ORDER.indexOf(n);
  if (idx < 0) return 0;
  return (idx / WHEEL_ORDER.length) * 360;
}
