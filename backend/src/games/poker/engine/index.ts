/**
 * Pure, framework-free Texas Hold'em hand evaluator.
 *
 * ZERO imports from node_modules — every function below is a pure function.
 * Shuffling is deterministic given an injected RNG.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';

export interface Card {
  /** 2..14, where 14 = Ace, 13 = King, 12 = Queen, 11 = Jack. */
  rank: number;
  suit: Suit;
}

export type Rng = () => number;

export enum HandCategory {
  HIGH_CARD = 1,
  PAIR,
  TWO_PAIR,
  THREE_KIND,
  STRAIGHT,
  FLUSH,
  FULL_HOUSE,
  FOUR_KIND,
  STRAIGHT_FLUSH,
}

export interface HandRank {
  category: HandCategory;
  /** Descending significance, used to break ties within the same category. */
  tiebreakers: number[];
  /** Human readable, e.g. "Full House, Kings over Tens". */
  name: string;
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

const RANK_NAMES: Record<number, string> = {
  14: 'Ace',
  13: 'King',
  12: 'Queen',
  11: 'Jack',
  10: 'Ten',
  9: 'Nine',
  8: 'Eight',
  7: 'Seven',
  6: 'Six',
  5: 'Five',
  4: 'Four',
  3: 'Three',
  2: 'Two',
};

/** 14 -> "Ace", 13 -> "King", ... 2 -> "Two". */
export function rankToString(rank: number): string {
  const name = RANK_NAMES[rank];
  if (name === undefined) {
    throw new Error(`Invalid rank: ${rank}`);
  }
  return name;
}

/** Plural form for hand names, e.g. "Kings", "Sixes". */
function rankPlural(rank: number): string {
  const name = rankToString(rank);
  if (name === 'Six') {
    return 'Sixes';
  }
  return `${name}s`;
}

/** A fresh, ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Returns a shuffled copy of `deck` using a Fisher-Yates shuffle driven by the
 * injected RNG. The input deck is not mutated, so the shuffle is deterministic
 * for a given RNG sequence.
 */
export function shuffle(deck: Card[], rng: Rng): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Compare two HandRanks. Returns >0 if `a` beats `b`, <0 if `b` beats `a`,
 * and 0 for an exact tie.
 */
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) {
      return av - bv;
    }
  }
  return 0;
}

/**
 * Detect a straight from a descending, deduplicated array of ranks.
 * Returns the high card of the straight, or 0 if none.
 *
 * Handles the wheel A-2-3-4-5: Ace counts low and the straight's high card is 5.
 */
function detectStraightHigh(uniqueDescRanks: number[]): number {
  // Standard straights: scan for 5 consecutive descending ranks.
  for (let i = 0; i + 4 < uniqueDescRanks.length; i++) {
    const top = uniqueDescRanks[i];
    let consecutive = true;
    for (let k = 1; k < 5; k++) {
      if (uniqueDescRanks[i + k] !== top - k) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      return top;
    }
  }
  // Wheel: A-2-3-4-5. Ace (14) plays low; the straight's high card is 5.
  const hasWheel =
    uniqueDescRanks.includes(14) &&
    uniqueDescRanks.includes(5) &&
    uniqueDescRanks.includes(4) &&
    uniqueDescRanks.includes(3) &&
    uniqueDescRanks.includes(2);
  if (hasWheel) {
    return 5;
  }
  return 0;
}

/** Evaluate exactly 5 cards into a HandRank. */
export function evaluateFive(cards: Card[]): HandRank {
  if (cards.length !== 5) {
    throw new Error(`evaluateFive expects exactly 5 cards, got ${cards.length}`);
  }

  const ranks = cards.map((c) => c.rank).sort((x, y) => y - x); // descending
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Count occurrences per rank.
  const counts = new Map<number, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  const uniqueDescRanks = Array.from(counts.keys()).sort((x, y) => y - x);
  const straightHigh = detectStraightHigh(uniqueDescRanks);
  const isStraight = straightHigh !== 0;

  // Group ranks by their count, then sort: higher count first, then higher rank.
  // This ordering yields correct tiebreakers for pairs/trips/quads + kickers.
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const countPattern = groups.map((g) => g[1]); // e.g. [2,2,1] for two pair

  // Straight flush (includes royal flush as the highest straight flush).
  if (isStraight && isFlush) {
    const tiebreakers = [straightHigh];
    let name: string;
    if (straightHigh === 14) {
      name = 'Royal Flush';
    } else {
      name = `Straight Flush, ${rankToString(straightHigh)} high`;
    }
    return { category: HandCategory.STRAIGHT_FLUSH, tiebreakers, name };
  }

  // Four of a kind.
  if (countPattern[0] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return {
      category: HandCategory.FOUR_KIND,
      tiebreakers: [quad, kicker],
      name: `Four of a Kind, ${rankPlural(quad)}`,
    };
  }

  // Full house.
  if (countPattern[0] === 3 && countPattern[1] === 2) {
    const trips = groups[0][0];
    const pair = groups[1][0];
    return {
      category: HandCategory.FULL_HOUSE,
      tiebreakers: [trips, pair],
      name: `Full House, ${rankPlural(trips)} over ${rankPlural(pair)}`,
    };
  }

  // Flush.
  if (isFlush) {
    return {
      category: HandCategory.FLUSH,
      tiebreakers: ranks.slice(),
      name: `Flush, ${rankToString(ranks[0])} high`,
    };
  }

  // Straight.
  if (isStraight) {
    return {
      category: HandCategory.STRAIGHT,
      tiebreakers: [straightHigh],
      name: `Straight, ${rankToString(straightHigh)} high`,
    };
  }

  // Three of a kind.
  if (countPattern[0] === 3) {
    const trips = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]); // descending
    return {
      category: HandCategory.THREE_KIND,
      tiebreakers: [trips, ...kickers],
      name: `Three of a Kind, ${rankPlural(trips)}`,
    };
  }

  // Two pair.
  if (countPattern[0] === 2 && countPattern[1] === 2) {
    const highPair = groups[0][0];
    const lowPair = groups[1][0];
    const kicker = groups[2][0];
    return {
      category: HandCategory.TWO_PAIR,
      tiebreakers: [highPair, lowPair, kicker],
      name: `Two Pair, ${rankPlural(highPair)} and ${rankPlural(lowPair)}`,
    };
  }

  // One pair.
  if (countPattern[0] === 2) {
    const pair = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]); // descending
    return {
      category: HandCategory.PAIR,
      tiebreakers: [pair, ...kickers],
      name: `Pair of ${rankPlural(pair)}`,
    };
  }

  // High card.
  return {
    category: HandCategory.HIGH_CARD,
    tiebreakers: ranks.slice(),
    name: `High Card, ${rankToString(ranks[0])}`,
  };
}

/** All 5-card combinations of the given indices count. */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];
  const recurse = (start: number): void => {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

/**
 * Evaluate the best 5-card hand from 5..7 cards by checking every 5-card combo.
 */
export function evaluateBest(cards: Card[]): HandRank {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateBest expects 5..7 cards, got ${cards.length}`);
  }
  if (cards.length === 5) {
    return evaluateFive(cards);
  }

  let best: HandRank | null = null;
  for (const combo of combinations(cards.length, 5)) {
    const hand = evaluateFive(combo.map((i) => cards[i]));
    if (best === null || compareHands(hand, best) > 0) {
      best = hand;
    }
  }
  // cards.length is guaranteed 6 or 7 here, so at least one combo exists.
  return best as HandRank;
}
