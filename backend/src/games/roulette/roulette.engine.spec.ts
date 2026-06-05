import {
  PAYOUTS,
  RED_NUMBERS,
  canonicalNumbers,
  colorOf,
  pocketFromFloat,
  settleBet,
  validateBet,
} from './roulette.engine';

describe('roulette engine', () => {
  describe('colorOf', () => {
    it('0 is green', () => expect(colorOf(0)).toBe('green'));
    it('reds are red', () => {
      for (const n of RED_NUMBERS) expect(colorOf(n)).toBe('red');
    });
    it('non-red non-zero are black', () => {
      expect(colorOf(2)).toBe('black');
      expect(colorOf(35)).toBe('black');
    });
  });

  describe('validateBet', () => {
    it('accepts a straight on one number', () => {
      const r = validateBet({ type: 'STRAIGHT', numbers: [17], amount: 10 });
      expect(r.ok).toBe(true);
      expect(r.numbers).toEqual([17]);
    });
    it('rejects a straight with two numbers', () => {
      expect(validateBet({ type: 'STRAIGHT', numbers: [1, 2], amount: 10 }).ok).toBe(false);
    });
    it('rejects a corner with wrong count', () => {
      expect(validateBet({ type: 'CORNER', numbers: [1, 2, 3], amount: 5 }).ok).toBe(false);
    });
    it('rejects non-positive stake', () => {
      expect(validateBet({ type: 'RED', numbers: [], amount: 0 }).ok).toBe(false);
    });
    it('ignores client numbers for outside bets and uses canonical set', () => {
      const r = validateBet({ type: 'RED', numbers: [999], amount: 5 });
      expect(r.ok).toBe(true);
      expect(r.numbers.sort((a, b) => a - b)).toEqual([...RED_NUMBERS].sort((a, b) => a - b));
    });
    it('rejects out-of-range pockets', () => {
      expect(validateBet({ type: 'STRAIGHT', numbers: [37], amount: 5 }).ok).toBe(false);
    });
  });

  describe('canonicalNumbers', () => {
    it('LOW is 1-18', () => expect(canonicalNumbers('LOW')).toHaveLength(18));
    it('HIGH is 19-36', () => expect(canonicalNumbers('HIGH')).toEqual(
      Array.from({ length: 18 }, (_, i) => 19 + i),
    ));
    it('ODD has 18 entries', () => expect(canonicalNumbers('ODD')).toHaveLength(18));
    it('returns null for inside bets', () => expect(canonicalNumbers('STRAIGHT')).toBeNull());
  });

  describe('settleBet', () => {
    it('pays 36x total on a straight hit', () => {
      expect(settleBet('STRAIGHT', [17], 10, 17)).toBe(360);
    });
    it('pays 0 on a miss', () => {
      expect(settleBet('STRAIGHT', [17], 10, 18)).toBe(0);
    });
    it('pays 2x total on red hit', () => {
      expect(settleBet('RED', [...RED_NUMBERS], 50, 1)).toBe(100);
    });
    it('green 0 loses red/black/odd/even', () => {
      expect(settleBet('RED', canonicalNumbers('RED')!, 50, 0)).toBe(0);
      expect(settleBet('EVEN', canonicalNumbers('EVEN')!, 50, 0)).toBe(0);
    });
    it('respects payout table multipliers', () => {
      expect(settleBet('SPLIT', [1, 2], 1, 1)).toBe(PAYOUTS.SPLIT + 1);
    });
  });

  describe('pocketFromFloat', () => {
    it('maps 0 -> 0 and just-under-1 -> 36', () => {
      expect(pocketFromFloat(0)).toBe(0);
      expect(pocketFromFloat(0.99999)).toBe(36);
    });
    it('stays within 0-36 across the range', () => {
      for (let i = 0; i < 1000; i++) {
        const p = pocketFromFloat(i / 1000);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(36);
      }
    });
  });
});
