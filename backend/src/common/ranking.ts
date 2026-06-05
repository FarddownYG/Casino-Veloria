import { Rank } from '@prisma/client';

/** Rank thresholds based on lifetime gross winnings (totalWon). */
export const RANK_THRESHOLDS: { rank: Rank; min: number }[] = [
  { rank: Rank.DIAMOND, min: 250_000 },
  { rank: Rank.GOLD, min: 50_000 },
  { rank: Rank.SILVER, min: 5_000 },
  { rank: Rank.BRONZE, min: 0 },
];

export function computeRank(totalWon: number): Rank {
  for (const { rank, min } of RANK_THRESHOLDS) {
    if (totalWon >= min) return rank;
  }
  return Rank.BRONZE;
}

const ORDER: Rank[] = [Rank.BRONZE, Rank.SILVER, Rank.GOLD, Rank.DIAMOND];

export function rankIndex(rank: Rank): number {
  return ORDER.indexOf(rank);
}

export function isPromotion(from: Rank, to: Rank): boolean {
  return rankIndex(to) > rankIndex(from);
}
