/**
 * Pure, framework-free Blackjack engine.
 *
 * No imports from NestJS, Prisma, or any node_modules package. Every function
 * is a deterministic pure function (the only source of nondeterminism is the
 * caller-supplied RNG / draw callback).
 *
 * Rules implemented (standard Vegas):
 *   - Dealer hits on 16 or less, STANDS on soft 17 ("S17").
 *   - Blackjack pays 3:2.
 *   - Regular win pays 1:1, push returns the stake.
 *   - Double doubles the stake and draws exactly one card (handled by caller;
 *     `settle` adjusts the payout when `opts.doubled` is set).
 *   - Split is allowed on any pair of equal rank value.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** RNG returning a float in [0, 1). */
export type Rng = () => number;

const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

/**
 * Build a freshly shuffled shoe of `decks` standard 52-card decks.
 * Uses a Fisher-Yates shuffle driven by the supplied RNG, so the result is
 * deterministic for a given RNG sequence.
 */
export function createShoe(decks: number, rng: Rng): Card[] {
  if (!Number.isInteger(decks) || decks < 1) {
    throw new Error(`createShoe: decks must be a positive integer, got ${decks}`);
  }

  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }

  // Fisher-Yates shuffle.
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }

  return shoe;
}

/**
 * Raw value of a single rank. Aces are 11 here; the soft/hard adjustment is
 * resolved in `handValue`. Face cards (J/Q/K) and 10 are worth 10.
 */
export function cardValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 11;
    case 'K':
    case 'Q':
    case 'J':
    case '10':
      return 10;
    default:
      return Number(rank);
  }
}

/**
 * Best total for a hand without busting if possible.
 *
 * Each ace starts as 11 and is demoted to 1 (subtracting 10) while the total
 * exceeds 21. `soft` is true when at least one ace is still counted as 11 in
 * the returned total.
 */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === 'A') {
      aces++;
    }
  }

  // Demote aces from 11 to 1 while we are over 21 and still have an ace at 11.
  let acesAsEleven = aces;
  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven--;
  }

  return { total, soft: acesAsEleven > 0 };
}

/** True only for a natural: exactly two cards totalling 21. */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** True when the best achievable total still exceeds 21. */
export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

/**
 * A hand can be split when it has exactly two cards of equal *value*.
 * Two ten-value cards (e.g. K + Q) count as a splittable pair, matching the
 * common casino rule where rank value, not face, determines pairing.
 */
export function canSplit(cards: Card[]): boolean {
  return cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank);
}

/**
 * Dealer drawing rule: hit on 16 or less, stand on 17 or more — including
 * SOFT 17 (S17). Returns true if the dealer must draw another card.
 */
export function dealerShouldHit(cards: Card[]): boolean {
  const { total } = handValue(cards);
  return total <= 16;
}

/**
 * Play out the dealer's hand, drawing cards until they must stand.
 * Does not mutate the input hand; returns a new array.
 */
export function playDealer(hand: Card[], drawNext: () => Card): Card[] {
  const result = [...hand];
  while (dealerShouldHit(result)) {
    result.push(drawNext());
  }
  return result;
}

export type Outcome = 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK';

/**
 * Determine the outcome and profit multiplier relative to the original stake.
 *
 * Multipliers (profit, not including the returned stake):
 *   - WIN:        +1   (doubled: +2)
 *   - LOSE:       -1   (doubled: -2)
 *   - PUSH:        0
 *   - BLACKJACK:  +1.5 (a natural cannot be doubled, so never affected)
 *
 * Natural blackjack is resolved before any other comparison: a player natural
 * that the dealer ties (dealer also natural) is a PUSH; otherwise it pays 3:2.
 */
export function settle(
  player: Card[],
  dealer: Card[],
  opts?: { doubled?: boolean },
): { outcome: Outcome; multiplier: number } {
  const doubled = opts?.doubled === true;
  const factor = doubled ? 2 : 1;

  const playerBJ = isBlackjack(player);
  const dealerBJ = isBlackjack(dealer);

  // Naturals are settled first and are not subject to the double multiplier
  // (you cannot double a two-card 21).
  if (playerBJ || dealerBJ) {
    if (playerBJ && dealerBJ) {
      return { outcome: 'PUSH', multiplier: 0 };
    }
    if (playerBJ) {
      return { outcome: 'BLACKJACK', multiplier: 1.5 };
    }
    // Dealer has a natural, player does not.
    return { outcome: 'LOSE', multiplier: -1 * factor };
  }

  // Player busts: immediate loss regardless of the dealer.
  if (isBust(player)) {
    return { outcome: 'LOSE', multiplier: -1 * factor };
  }

  // Dealer busts and player did not: player wins.
  if (isBust(dealer)) {
    return { outcome: 'WIN', multiplier: 1 * factor };
  }

  const playerTotal = handValue(player).total;
  const dealerTotal = handValue(dealer).total;

  if (playerTotal > dealerTotal) {
    return { outcome: 'WIN', multiplier: 1 * factor };
  }
  if (playerTotal < dealerTotal) {
    return { outcome: 'LOSE', multiplier: -1 * factor };
  }
  return { outcome: 'PUSH', multiplier: 0 };
}
