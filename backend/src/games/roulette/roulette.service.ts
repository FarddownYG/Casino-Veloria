import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BalanceService } from '../../economy/balance.service';
import { CasinoService } from '../../economy/casino.service';
import { AppEvents, HotStreakEvent } from '../../common/events/app-events';
import {
  generateServerSeed,
  seededFloat,
  SeedPair,
} from '../../common/rng/provably-fair';
import {
  colorOf,
  pocketFromFloat,
  RouletteBet,
  RouletteBetType,
  settleBet,
  validateBet,
} from './roulette.engine';

const ROULETTE_TABLE_ID = 'roulette-main';
const HOT_STREAK_THRESHOLD = 1000;

export interface PricedBet {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
}

export interface UserRoundBets {
  userId: string;
  username: string;
  bets: PricedBet[];
  totalStake: number;
}

export interface UserPayout {
  userId: string;
  username: string;
  totalStake: number;
  winnings: number;
  net: number;
  balance: number;
  winningBets: PricedBet[];
}

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly casino: CasinoService,
    private readonly events: EventEmitter2,
  ) {}

  async ensureTable(): Promise<string> {
    await this.prisma.gameTable.upsert({
      where: { id: ROULETTE_TABLE_ID },
      create: {
        id: ROULETTE_TABLE_ID,
        type: GameType.ROULETTE,
        name: 'Roulette Européenne',
        isPersistent: true,
        minBet: 1,
        maxBet: 100_000,
        maxSeats: 9999,
      },
      update: {},
    });
    return ROULETTE_TABLE_ID;
  }

  newSeed(): SeedPair {
    return generateServerSeed();
  }

  /** Validates + prices a batch of bets, debits the total stake. */
  async placeBets(
    userId: string,
    roundId: string,
    rawBets: RouletteBet[],
  ): Promise<{ pricedBets: PricedBet[]; totalStake: number; balance: number }> {
    if (!Array.isArray(rawBets) || rawBets.length === 0) {
      throw new BadRequestException('No bets provided');
    }
    if (rawBets.length > 50) {
      throw new BadRequestException('Too many bets');
    }

    const pricedBets: PricedBet[] = [];
    let totalStake = 0;
    for (const bet of rawBets) {
      const v = validateBet(bet);
      if (!v.ok) throw new BadRequestException(v.reason ?? 'Invalid bet');
      pricedBets.push({ type: bet.type, numbers: v.numbers, amount: bet.amount });
      totalStake += bet.amount;
    }
    if (totalStake <= 0) throw new BadRequestException('Invalid total stake');

    const { balance } = await this.balance.adjust({
      userId,
      amount: -totalStake,
      type: TransactionType.BET_PLACED,
      reason: 'Roulette bet',
      gameType: GameType.ROULETTE,
      refId: roundId,
      description: `Mise roulette (${totalStake} VC)`,
      wagered: totalStake,
      metadata: { bets: pricedBets as unknown as object },
    });

    return { pricedBets, totalStake, balance };
  }

  /**
   * Resolves a round: derives the winning pocket from the committed seed,
   * persists the round + bets, pays winners, books the house result.
   */
  async resolveRound(params: {
    roundId: string;
    tableId: string;
    seed: SeedPair;
    nonce: number;
    betsByUser: UserRoundBets[];
  }): Promise<{ number: number; color: string; payouts: UserPayout[] }> {
    const { roundId, tableId, seed, nonce, betsByUser } = params;
    const clientSeed = tableId;
    const x = seededFloat(seed.serverSeed, clientSeed, nonce);
    const winning = pocketFromFloat(x);
    const color = colorOf(winning);

    // Persist the round (id == the pre-committed roundId).
    await this.prisma.gameRound.create({
      data: {
        id: roundId,
        gameType: GameType.ROULETTE,
        tableId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed,
        nonce,
        result: { number: winning, color },
      },
    });

    const payouts: UserPayout[] = [];
    let totalWagered = 0;
    let totalPaidOut = 0;

    for (const ub of betsByUser) {
      let winnings = 0;
      const winningBets: PricedBet[] = [];
      const betRows: Prisma.BetCreateManyInput[] = [];

      for (const b of ub.bets) {
        const ret = settleBet(b.type, b.numbers, b.amount, winning);
        const won = ret > 0;
        if (won) {
          winnings += ret;
          winningBets.push(b);
        }
        betRows.push({
          roundId,
          userId: ub.userId,
          gameType: GameType.ROULETTE,
          betType: b.type,
          selection: { numbers: b.numbers } as object,
          stake: b.amount,
          payout: ret,
          won,
        });
      }

      await this.prisma.bet.createMany({ data: betRows });

      totalWagered += ub.totalStake;
      totalPaidOut += winnings;
      const net = winnings - ub.totalStake;

      // Credit winnings (if any) and record win/loss aggregates.
      const { balance } = await this.balance.adjust({
        userId: ub.userId,
        amount: winnings,
        type: TransactionType.BET_PAYOUT,
        reason: winnings > 0 ? 'Roulette win' : 'Roulette result',
        gameType: GameType.ROULETTE,
        refId: roundId,
        description:
          winnings > 0
            ? `Gain roulette (${winnings} VC) — n°${winning}`
            : `Perte roulette — n°${winning}`,
        won: net > 0 ? net : 0,
        lost: net < 0 ? -net : 0,
        allowNegative: true,
      });

      payouts.push({
        userId: ub.userId,
        username: ub.username,
        totalStake: ub.totalStake,
        winnings,
        net,
        balance,
        winningBets,
      });

      if (net >= HOT_STREAK_THRESHOLD) {
        const hot: HotStreakEvent = {
          username: ub.username,
          amount: net,
          gameType: 'ROULETTE',
        };
        this.events.emit(AppEvents.HotStreak, hot);
      }
    }

    await this.casino.recordRound(totalWagered, totalPaidOut);
    this.events.emit(AppEvents.LeaderboardDirty, {});

    return { number: winning, color, payouts };
  }

  /** Refunds a user's pending stake for the current round (bet:clear). */
  async refund(userId: string, roundId: string, totalStake: number): Promise<void> {
    if (totalStake <= 0) return;
    await this.balance.adjust({
      userId,
      amount: totalStake,
      type: TransactionType.BET_REFUND,
      reason: 'Roulette bet cleared',
      gameType: GameType.ROULETTE,
      refId: roundId,
      description: `Annulation mise roulette (${totalStake} VC)`,
      wagered: -totalStake,
    });
  }

  async history(limit = 20): Promise<number[]> {
    const rounds = await this.prisma.gameRound.findMany({
      where: { gameType: GameType.ROULETTE },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { result: true },
    });
    return rounds.map((r) => (r.result as { number: number }).number);
  }
}
