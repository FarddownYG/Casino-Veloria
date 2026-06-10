import {
  Card,
  Suit,
  HandCategory,
  HandRank,
  createDeck,
  shuffle,
  evaluateFive,
  evaluateBest,
  compareHands,
  rankToString,
  buildSidePots,
} from './index';

/** Seeded mulberry32 RNG for deterministic shuffle tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a 5-card hand from a compact "rank+suit" notation, e.g. "AS", "10H", "2C". */
function hand(...cards: string[]): Card[] {
  return cards.map(parseCard);
}

function parseCard(token: string): Card {
  const suitChar = token.slice(-1) as Suit;
  const rankStr = token.slice(0, -1);
  const rankMap: Record<string, number> = {
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
    T: 10,
    '10': 10,
  };
  const rank = rankMap[rankStr] ?? parseInt(rankStr, 10);
  return { rank, suit: suitChar };
}

describe('rankToString', () => {
  it('maps ranks to names', () => {
    expect(rankToString(14)).toBe('Ace');
    expect(rankToString(13)).toBe('King');
    expect(rankToString(12)).toBe('Queen');
    expect(rankToString(11)).toBe('Jack');
    expect(rankToString(10)).toBe('Ten');
    expect(rankToString(5)).toBe('Five');
    expect(rankToString(2)).toBe('Two');
  });

  it('throws on invalid rank', () => {
    expect(() => rankToString(1)).toThrow();
    expect(() => rankToString(15)).toThrow();
  });
});

describe('createDeck', () => {
  it('has 52 cards with no duplicates', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const seen = new Set(deck.map((c) => `${c.rank}${c.suit}`));
    expect(seen.size).toBe(52);
  });

  it('covers all four suits and ranks 2..14', () => {
    const deck = createDeck();
    for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
      for (let rank = 2; rank <= 14; rank++) {
        expect(
          deck.some((c) => c.rank === rank && c.suit === suit),
        ).toBe(true);
      }
    }
  });
});

describe('shuffle', () => {
  it('does not mutate the input deck', () => {
    const deck = createDeck();
    const copy = deck.map((c) => ({ ...c }));
    shuffle(deck, mulberry32(123));
    expect(deck).toEqual(copy);
  });

  it('is deterministic for the same seed', () => {
    const deck = createDeck();
    const a = shuffle(deck, mulberry32(42));
    const b = shuffle(deck, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('produces different orders for different seeds', () => {
    const deck = createDeck();
    const a = shuffle(deck, mulberry32(1));
    const b = shuffle(deck, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('preserves all 52 unique cards', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, mulberry32(999));
    expect(shuffled).toHaveLength(52);
    const seen = new Set(shuffled.map((c) => `${c.rank}${c.suit}`));
    expect(seen.size).toBe(52);
  });
});

describe('evaluateFive - category detection', () => {
  it('detects high card', () => {
    const r = evaluateFive(hand('AS', 'KH', '9D', '5C', '2S'));
    expect(r.category).toBe(HandCategory.HIGH_CARD);
    expect(r.tiebreakers).toEqual([14, 13, 9, 5, 2]);
    expect(r.name).toBe('High Card, Ace');
  });

  it('detects one pair', () => {
    const r = evaluateFive(hand('KS', 'KH', '9D', '5C', '2S'));
    expect(r.category).toBe(HandCategory.PAIR);
    expect(r.tiebreakers).toEqual([13, 9, 5, 2]);
    expect(r.name).toBe('Pair of Kings');
  });

  it('detects two pair', () => {
    const r = evaluateFive(hand('KS', 'KH', '9D', '9C', '2S'));
    expect(r.category).toBe(HandCategory.TWO_PAIR);
    expect(r.tiebreakers).toEqual([13, 9, 2]);
    expect(r.name).toBe('Two Pair, Kings and Nines');
  });

  it('detects three of a kind', () => {
    const r = evaluateFive(hand('7S', '7H', '7D', '9C', '2S'));
    expect(r.category).toBe(HandCategory.THREE_KIND);
    expect(r.tiebreakers).toEqual([7, 9, 2]);
    expect(r.name).toBe('Three of a Kind, Sevens');
  });

  it('detects a straight', () => {
    const r = evaluateFive(hand('9S', '8H', '7D', '6C', '5S'));
    expect(r.category).toBe(HandCategory.STRAIGHT);
    expect(r.tiebreakers).toEqual([9]);
    expect(r.name).toBe('Straight, Nine high');
  });

  it('detects a flush', () => {
    const r = evaluateFive(hand('AH', 'JH', '8H', '5H', '2H'));
    expect(r.category).toBe(HandCategory.FLUSH);
    expect(r.tiebreakers).toEqual([14, 11, 8, 5, 2]);
    expect(r.name).toBe('Flush, Ace high');
  });

  it('detects a full house', () => {
    const r = evaluateFive(hand('KS', 'KH', 'KD', 'TC', 'TS'));
    expect(r.category).toBe(HandCategory.FULL_HOUSE);
    expect(r.tiebreakers).toEqual([13, 10]);
    expect(r.name).toBe('Full House, Kings over Tens');
  });

  it('detects four of a kind', () => {
    const r = evaluateFive(hand('QS', 'QH', 'QD', 'QC', '3S'));
    expect(r.category).toBe(HandCategory.FOUR_KIND);
    expect(r.tiebreakers).toEqual([12, 3]);
    expect(r.name).toBe('Four of a Kind, Queens');
  });

  it('detects a straight flush', () => {
    const r = evaluateFive(hand('9H', '8H', '7H', '6H', '5H'));
    expect(r.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(r.tiebreakers).toEqual([9]);
    expect(r.name).toBe('Straight Flush, Nine high');
  });

  it('detects a royal flush as the top straight flush', () => {
    const r = evaluateFive(hand('AS', 'KS', 'QS', 'JS', 'TS'));
    expect(r.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(r.tiebreakers).toEqual([14]);
    expect(r.name).toBe('Royal Flush');
  });

  it('throws if not exactly 5 cards', () => {
    expect(() => evaluateFive(hand('AS', 'KS', 'QS', 'JS'))).toThrow();
    expect(() =>
      evaluateFive(hand('AS', 'KS', 'QS', 'JS', 'TS', '9S')),
    ).toThrow();
  });
});

describe('wheel straight (A-2-3-4-5)', () => {
  it('treats the wheel as a straight with 5 high', () => {
    const r = evaluateFive(hand('AS', '2H', '3D', '4C', '5S'));
    expect(r.category).toBe(HandCategory.STRAIGHT);
    expect(r.tiebreakers).toEqual([5]);
    expect(r.name).toBe('Straight, Five high');
  });

  it('treats the steel wheel as a straight flush with 5 high', () => {
    const r = evaluateFive(hand('AH', '2H', '3H', '4H', '5H'));
    expect(r.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(r.tiebreakers).toEqual([5]);
    expect(r.name).toBe('Straight Flush, Five high');
  });

  it('ranks the wheel below a six-high straight', () => {
    const wheel = evaluateFive(hand('AS', '2H', '3D', '4C', '5S'));
    const sixHigh = evaluateFive(hand('6S', '5H', '4D', '3C', '2S'));
    expect(compareHands(sixHigh, wheel)).toBeGreaterThan(0);
  });
});

describe('category ordering via compareHands', () => {
  it('orders full house above flush', () => {
    const fullHouse = evaluateFive(hand('KS', 'KH', 'KD', 'TC', 'TS'));
    const flush = evaluateFive(hand('AH', 'JH', '8H', '5H', '2H'));
    expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
    expect(compareHands(flush, fullHouse)).toBeLessThan(0);
  });

  it('orders the full strength chain correctly', () => {
    const ranked: HandRank[] = [
      evaluateFive(hand('AS', 'KH', '9D', '5C', '2S')), // high card
      evaluateFive(hand('KS', 'KH', '9D', '5C', '2S')), // pair
      evaluateFive(hand('KS', 'KH', '9D', '9C', '2S')), // two pair
      evaluateFive(hand('7S', '7H', '7D', '9C', '2S')), // trips
      evaluateFive(hand('9S', '8H', '7D', '6C', '5S')), // straight
      evaluateFive(hand('AH', 'JH', '8H', '5H', '2H')), // flush
      evaluateFive(hand('KS', 'KH', 'KD', 'TC', 'TS')), // full house
      evaluateFive(hand('QS', 'QH', 'QD', 'QC', '3S')), // quads
      evaluateFive(hand('9H', '8H', '7H', '6H', '5H')), // straight flush
    ];
    for (let i = 1; i < ranked.length; i++) {
      expect(compareHands(ranked[i], ranked[i - 1])).toBeGreaterThan(0);
    }
  });
});

describe('kicker and tiebreak comparisons', () => {
  it('breaks a pair tie by kickers', () => {
    const a = evaluateFive(hand('KS', 'KH', 'AD', '5C', '2S'));
    const b = evaluateFive(hand('KS', 'KH', 'QD', '5C', '2S'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('breaks a two-pair tie by higher pair first', () => {
    const a = evaluateFive(hand('AS', 'AH', '2D', '2C', '5S')); // aces & twos
    const b = evaluateFive(hand('KS', 'KH', 'QD', 'QC', '5S')); // kings & queens
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('breaks a two-pair tie by lower pair when higher pair ties', () => {
    const a = evaluateFive(hand('KS', 'KH', 'TD', 'TC', '3S'));
    const b = evaluateFive(hand('KS', 'KH', '9D', '9C', 'AS'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('breaks a two-pair tie by kicker when both pairs tie', () => {
    const a = evaluateFive(hand('KS', 'KH', '9D', '9C', 'AS'));
    const b = evaluateFive(hand('KS', 'KH', '9D', '9C', 'QS'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('breaks a flush tie by descending cards', () => {
    const a = evaluateFive(hand('AH', 'KH', '8H', '5H', '2H'));
    const b = evaluateFive(hand('AH', 'QH', '8H', '5H', '2H'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('reports an exact tie as 0', () => {
    const a = evaluateFive(hand('AS', 'KH', '9D', '5C', '2S'));
    const b = evaluateFive(hand('AD', 'KS', '9H', '5S', '2H'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('breaks a full-house tie by trips then pair', () => {
    const a = evaluateFive(hand('KS', 'KH', 'KD', '2C', '2S'));
    const b = evaluateFive(hand('QS', 'QH', 'QD', 'AC', 'AS'));
    expect(compareHands(a, b)).toBeGreaterThan(0); // kings full beats queens full
  });
});

describe('evaluateBest', () => {
  it('picks the best 5 from 7 cards (flush over two pair)', () => {
    // Five hearts present -> ace-high flush is the best 5.
    const r = evaluateBest(
      hand('AH', 'KH', '8H', '5H', '2H', 'KS', '2S'),
    );
    expect(r.category).toBe(HandCategory.FLUSH);
    expect(r.tiebreakers).toEqual([14, 13, 8, 5, 2]);
  });

  it('finds a straight using board + hole cards from 7', () => {
    const r = evaluateBest(
      hand('9S', '8H', '7D', '6C', '5S', '2H', '2D'),
    );
    expect(r.category).toBe(HandCategory.STRAIGHT);
    expect(r.tiebreakers).toEqual([9]);
  });

  it('finds quads from 7 cards', () => {
    const r = evaluateBest(
      hand('QS', 'QH', 'QD', 'QC', '3S', '7H', '2D'),
    );
    expect(r.category).toBe(HandCategory.FOUR_KIND);
    expect(r.tiebreakers).toEqual([12, 7]);
  });

  it('finds the wheel from 7 cards', () => {
    const r = evaluateBest(
      hand('AS', '2H', '3D', '4C', '5S', 'KH', 'KD'),
    );
    expect(r.category).toBe(HandCategory.STRAIGHT);
    expect(r.tiebreakers).toEqual([5]);
  });

  it('matches evaluateFive when given exactly 5 cards', () => {
    const cards = hand('KS', 'KH', 'KD', 'TC', 'TS');
    expect(evaluateBest(cards)).toEqual(evaluateFive(cards));
  });

  it('works with 6 cards', () => {
    const r = evaluateBest(hand('AS', 'KS', 'QS', 'JS', 'TS', '2H'));
    expect(r.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(r.name).toBe('Royal Flush');
  });

  it('throws on fewer than 5 or more than 7 cards', () => {
    expect(() => evaluateBest(hand('AS', 'KS', 'QS', 'JS'))).toThrow();
    expect(() =>
      evaluateBest(hand('AS', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '7S')),
    ).toThrow();
  });
});

describe('buildSidePots', () => {
  const total = (pots: { amount: number }[]) => pots.reduce((s, p) => s + p.amount, 0);

  it('single pot when everyone matched and nobody folded', () => {
    const pots = buildSidePots([
      { userId: 'a', amount: 100, folded: false },
      { userId: 'b', amount: 100, folded: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligible.sort()).toEqual(['a', 'b']);
  });

  it('creates a side pot for a short all-in', () => {
    // a is all-in for 50; b and c put 100 each.
    const pots = buildSidePots([
      { userId: 'a', amount: 50, folded: false },
      { userId: 'b', amount: 100, folded: false },
      { userId: 'c', amount: 100, folded: false },
    ]);
    expect(total(pots)).toBe(250);
    expect(pots).toHaveLength(2);
    // Main pot: 50*3, all eligible.
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligible.sort()).toEqual(['a', 'b', 'c']);
    // Side pot: remaining 50 from b & c only.
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligible.sort()).toEqual(['b', 'c']);
  });

  it('keeps folded chips as dead money (not eligible to win)', () => {
    const pots = buildSidePots([
      { userId: 'a', amount: 100, folded: true },
      { userId: 'b', amount: 100, folded: false },
      { userId: 'c', amount: 100, folded: false },
    ]);
    expect(total(pots)).toBe(300);
    expect(pots).toHaveLength(1);
    expect(pots[0].eligible.sort()).toEqual(['b', 'c']);
    expect(pots[0].contributors.sort()).toEqual(['a', 'b', 'c']);
  });

  it('marks an uncalled layer (only folded contributors) as not winnable', () => {
    // a bets 100 (live); b folded after putting 20. Top 80 is uncalled.
    const pots = buildSidePots([
      { userId: 'a', amount: 100, folded: false },
      { userId: 'b', amount: 20, folded: true },
    ]);
    expect(total(pots)).toBe(120);
    // 'a' is eligible for everything (sole non-folded contributor at every level).
    for (const pot of pots) expect(pot.eligible).toEqual(['a']);
  });

  it('ignores zero contributions', () => {
    const pots = buildSidePots([
      { userId: 'a', amount: 0, folded: false },
      { userId: 'b', amount: 30, folded: false },
      { userId: 'c', amount: 30, folded: false },
    ]);
    expect(total(pots)).toBe(60);
    expect(pots).toHaveLength(1);
    expect(pots[0].eligible.sort()).toEqual(['b', 'c']);
  });
});
