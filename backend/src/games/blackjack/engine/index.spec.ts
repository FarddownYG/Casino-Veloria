import {
  Card,
  Rank,
  Rng,
  createShoe,
  cardValue,
  handValue,
  isBlackjack,
  isBust,
  canSplit,
  dealerShouldHit,
  playDealer,
  settle,
} from './index';

/**
 * Small seeded PRNG (mulberry32) so the shuffle is deterministic in tests.
 * Returns a float in [0, 1).
 */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: build cards by rank (suit varies so we never accidentally dup). */
const SUITS_CYCLE: Card['suit'][] = ['S', 'H', 'D', 'C'];
function hand(...ranks: Rank[]): Card[] {
  return ranks.map((rank, i) => ({ rank, suit: SUITS_CYCLE[i % 4] }));
}

/** A draw function that yields the given cards in order, then throws. */
function sequentialDrawer(cards: Card[]): () => Card {
  let i = 0;
  return () => {
    if (i >= cards.length) {
      throw new Error('drew past the end of the prepared sequence');
    }
    return cards[i++];
  };
}

describe('cardValue', () => {
  it('values number cards by their face number', () => {
    expect(cardValue('2')).toBe(2);
    expect(cardValue('9')).toBe(9);
    expect(cardValue('10')).toBe(10);
  });

  it('values face cards as 10', () => {
    expect(cardValue('J')).toBe(10);
    expect(cardValue('Q')).toBe(10);
    expect(cardValue('K')).toBe(10);
  });

  it('values an ace as 11 (raw)', () => {
    expect(cardValue('A')).toBe(11);
  });
});

describe('createShoe', () => {
  it('produces 312 cards for a 6-deck shoe', () => {
    const shoe = createShoe(6, mulberry32(123));
    expect(shoe).toHaveLength(312);
  });

  it('produces 52 cards for a single deck', () => {
    expect(createShoe(1, mulberry32(1))).toHaveLength(52);
  });

  it('contains exactly the right multiset of cards (no missing/extra)', () => {
    const decks = 2;
    const shoe = createShoe(decks, mulberry32(999));
    expect(shoe).toHaveLength(52 * decks);

    const counts = new Map<string, number>();
    for (const c of shoe) {
      const key = `${c.rank}${c.suit}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // 52 distinct cards, each appearing exactly `decks` times.
    expect(counts.size).toBe(52);
    for (const count of counts.values()) {
      expect(count).toBe(decks);
    }
  });

  it('is deterministic for a fixed seed and shuffles (differs from sorted)', () => {
    const a = createShoe(1, mulberry32(42));
    const b = createShoe(1, mulberry32(42));
    expect(a).toEqual(b); // same seed -> identical order

    const sorted = createShoe(1, () => 0); // rng()=0 leaves Fisher-Yates order as built
    expect(a).not.toEqual(sorted); // a real seed actually permutes the deck
  });

  it('throws on invalid deck counts', () => {
    expect(() => createShoe(0, mulberry32(1))).toThrow();
    expect(() => createShoe(-3, mulberry32(1))).toThrow();
    expect(() => createShoe(1.5, mulberry32(1))).toThrow();
  });
});

describe('handValue - hard totals', () => {
  it('sums plain number cards', () => {
    expect(handValue(hand('2', '3', '4'))).toEqual({ total: 9, soft: false });
  });

  it('treats a hard hand with no aces as not soft', () => {
    expect(handValue(hand('10', '7'))).toEqual({ total: 17, soft: false });
    expect(handValue(hand('K', 'Q'))).toEqual({ total: 20, soft: false });
  });
});

describe('handValue - soft totals and ace adjustment', () => {
  it('counts a lone ace as 11 (soft)', () => {
    expect(handValue(hand('A', '6'))).toEqual({ total: 17, soft: true }); // soft 17
  });

  it('counts a blackjack as soft 21', () => {
    expect(handValue(hand('A', 'K'))).toEqual({ total: 21, soft: true });
  });

  it('demotes an ace to 1 to avoid busting (becomes hard)', () => {
    // A(11) + 6 + 10 = 27 -> demote A -> 17 hard.
    expect(handValue(hand('A', '6', '10'))).toEqual({ total: 17, soft: false });
  });

  it('handles A + A + 9 = 21 (one ace 11, one ace 1)', () => {
    // 11 + 11 + 9 = 31; demote one ace -> 21, still one ace at 11 -> soft.
    expect(handValue(hand('A', 'A', '9'))).toEqual({ total: 21, soft: true });
  });

  it('handles two aces alone as 12 soft', () => {
    // 11 + 11 = 22; demote one -> 12, one ace remains 11 -> soft.
    expect(handValue(hand('A', 'A'))).toEqual({ total: 12, soft: true });
  });

  it('demotes all aces when needed (hard low total)', () => {
    // A + A + A + 9 = 11+11+11+9=42; demote all three -> 1+1+1+9 = 12 hard.
    expect(handValue(hand('A', 'A', 'A', '9'))).toEqual({ total: 12, soft: false });
  });

  it('reports empty hand as zero', () => {
    expect(handValue([])).toEqual({ total: 0, soft: false });
  });
});

describe('isBlackjack', () => {
  it('detects a natural (2 cards = 21)', () => {
    expect(isBlackjack(hand('A', 'K'))).toBe(true);
    expect(isBlackjack(hand('A', '10'))).toBe(true);
  });

  it('does NOT count a 3-card 21 as blackjack', () => {
    expect(isBlackjack(hand('7', '7', '7'))).toBe(false);
    expect(isBlackjack(hand('A', '5', '5'))).toBe(false);
  });

  it('is false for non-21 two-card hands', () => {
    expect(isBlackjack(hand('A', '9'))).toBe(false);
    expect(isBlackjack(hand('K', 'Q'))).toBe(false);
  });
});

describe('isBust', () => {
  it('is true above 21', () => {
    expect(isBust(hand('K', 'Q', '5'))).toBe(true); // 25
  });

  it('is false at exactly 21', () => {
    expect(isBust(hand('K', 'Q', 'A'))).toBe(false); // 21 (ace as 1)
  });

  it('is false when an ace rescues the hand from busting', () => {
    expect(isBust(hand('A', '6', '10'))).toBe(false); // 17
  });
});

describe('canSplit', () => {
  it('allows splitting equal ranks', () => {
    expect(canSplit(hand('8', '8'))).toBe(true);
    expect(canSplit(hand('A', 'A'))).toBe(true);
  });

  it('allows splitting two ten-value cards of different rank (K + Q)', () => {
    expect(canSplit(hand('K', 'Q'))).toBe(true);
    expect(canSplit(hand('10', 'J'))).toBe(true);
  });

  it('rejects non-pairs and hands without exactly 2 cards', () => {
    expect(canSplit(hand('8', '9'))).toBe(false);
    expect(canSplit(hand('8'))).toBe(false);
    expect(canSplit(hand('8', '8', '8'))).toBe(false);
  });
});

describe('dealerShouldHit (S17)', () => {
  it('hits on 16 or less', () => {
    expect(dealerShouldHit(hand('10', '6'))).toBe(true); // 16
    expect(dealerShouldHit(hand('7', '5'))).toBe(true); // 12
  });

  it('stands on hard 17', () => {
    expect(dealerShouldHit(hand('10', '7'))).toBe(false); // 17
  });

  it('STANDS on soft 17 (A + 6)', () => {
    expect(dealerShouldHit(hand('A', '6'))).toBe(false); // soft 17 -> stand
  });

  it('stands on 18+', () => {
    expect(dealerShouldHit(hand('10', '8'))).toBe(false); // 18
    expect(dealerShouldHit(hand('A', '7'))).toBe(false); // soft 18
  });
});

describe('playDealer', () => {
  it('draws until reaching 17 or more', () => {
    // Start 10+2=12, draw 5 -> 17, stand.
    const result = playDealer(hand('10', '2'), sequentialDrawer(hand('5')));
    expect(handValue(result).total).toBe(17);
    expect(result).toHaveLength(3);
  });

  it('stands immediately on soft 17 without drawing', () => {
    const drawer = jest.fn(() => ({ rank: '5' as Rank, suit: 'S' as Card['suit'] }));
    const result = playDealer(hand('A', '6'), drawer);
    expect(drawer).not.toHaveBeenCalled();
    expect(result).toEqual(hand('A', '6'));
  });

  it('keeps drawing through a soft hand until it hardens to >=17', () => {
    // A + 2 = soft 13 -> hit; draw 4 -> soft 17... but S17 means stand at soft 17.
    // Use A + 2, draw 3 -> soft 16 -> hit, draw K -> 16 hard (A=1) -> hit, draw 5 -> 21 stand.
    const result = playDealer(
      hand('A', '2'),
      sequentialDrawer(hand('3', 'K', '5')),
    );
    expect(handValue(result).total).toBe(21);
  });

  it('does not mutate the original hand', () => {
    const original = hand('10', '2');
    const copy = [...original];
    playDealer(original, sequentialDrawer(hand('5')));
    expect(original).toEqual(copy);
  });
});

describe('settle - basic outcomes', () => {
  it('WIN when player total beats dealer', () => {
    expect(settle(hand('10', '9'), hand('10', '7'))).toEqual({
      outcome: 'WIN',
      multiplier: 1,
    });
  });

  it('LOSE when dealer total beats player', () => {
    expect(settle(hand('10', '6'), hand('10', '9'))).toEqual({
      outcome: 'LOSE',
      multiplier: -1,
    });
  });

  it('PUSH when totals are equal', () => {
    expect(settle(hand('10', '8'), hand('10', '8'))).toEqual({
      outcome: 'PUSH',
      multiplier: 0,
    });
  });

  it('LOSE when player busts (even if dealer would too)', () => {
    expect(settle(hand('10', '8', '9'), hand('10', '8', '9'))).toEqual({
      outcome: 'LOSE',
      multiplier: -1,
    });
  });

  it('WIN when dealer busts and player stands', () => {
    expect(settle(hand('10', '8'), hand('10', '8', '9'))).toEqual({
      outcome: 'WIN',
      multiplier: 1,
    });
  });
});

describe('settle - blackjack', () => {
  it('pays 3:2 for a player natural', () => {
    expect(settle(hand('A', 'K'), hand('10', '9'))).toEqual({
      outcome: 'BLACKJACK',
      multiplier: 1.5,
    });
  });

  it('PUSH when both have naturals', () => {
    expect(settle(hand('A', 'K'), hand('A', 'Q'))).toEqual({
      outcome: 'PUSH',
      multiplier: 0,
    });
  });

  it('LOSE when only the dealer has a natural', () => {
    expect(settle(hand('10', '9'), hand('A', 'K'))).toEqual({
      outcome: 'LOSE',
      multiplier: -1,
    });
  });

  it('does not treat a 3-card 21 as blackjack (it is a plain WIN vs lower)', () => {
    expect(settle(hand('7', '7', '7'), hand('10', '9'))).toEqual({
      outcome: 'WIN',
      multiplier: 1,
    });
  });

  it('a 3-card 21 PUSHes against a dealer two-card 21 that is also non-natural', () => {
    // dealer 7+7+7 = 21, player 7+7+7 = 21 -> push, neither is a natural.
    expect(settle(hand('7', '7', '7'), hand('8', '6', '7'))).toEqual({
      outcome: 'PUSH',
      multiplier: 0,
    });
  });
});

describe('settle - doubled', () => {
  it('doubles a win to +2', () => {
    expect(settle(hand('10', '9'), hand('10', '7'), { doubled: true })).toEqual({
      outcome: 'WIN',
      multiplier: 2,
    });
  });

  it('doubles a loss to -2', () => {
    expect(settle(hand('10', '6'), hand('10', '9'), { doubled: true })).toEqual({
      outcome: 'LOSE',
      multiplier: -2,
    });
  });

  it('doubles a player-bust loss to -2', () => {
    expect(settle(hand('10', '6', '9'), hand('10', '7'), { doubled: true })).toEqual({
      outcome: 'LOSE',
      multiplier: -2,
    });
  });

  it('push remains 0 even when doubled', () => {
    expect(settle(hand('10', '8'), hand('10', '8'), { doubled: true })).toEqual({
      outcome: 'PUSH',
      multiplier: 0,
    });
  });

  it('a dealer natural beats a doubled player hand for -2', () => {
    expect(settle(hand('10', '6'), hand('A', 'K'), { doubled: true })).toEqual({
      outcome: 'LOSE',
      multiplier: -2,
    });
  });
});

describe('integration: deal from a seeded shoe and settle', () => {
  it('plays a deterministic round end-to-end', () => {
    const shoe = createShoe(6, mulberry32(7));
    let idx = 0;
    const draw = () => shoe[idx++];

    const player: Card[] = [draw(), draw()];
    const dealer: Card[] = [draw(), draw()];
    const finalDealer = playDealer(dealer, draw);

    const result = settle(player, finalDealer);
    // Deterministic given the seed: assert the result is internally consistent.
    expect(['WIN', 'LOSE', 'PUSH', 'BLACKJACK']).toContain(result.outcome);
    if (result.outcome === 'WIN') expect(result.multiplier).toBe(1);
    if (result.outcome === 'LOSE') expect(result.multiplier).toBe(-1);
    if (result.outcome === 'PUSH') expect(result.multiplier).toBe(0);
    if (result.outcome === 'BLACKJACK') expect(result.multiplier).toBe(1.5);
    // Dealer must have stood legally (>=17 or bust).
    expect(handValue(finalDealer).total).toBeGreaterThanOrEqual(17);
  });
});
