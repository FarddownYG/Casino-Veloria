import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameType, TableStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BalanceService } from '../../economy/balance.service';
import { CasinoService } from '../../economy/casino.service';
import { AppEvents } from '../../common/events/app-events';
import { Card, Outcome } from './engine';

export interface SeatResult {
  userId: string;
  username: string;
  bet: number;
  returned: number; // total credited back (0 on loss, stake on push, more on win)
  outcome: Outcome;
}

@Injectable()
export class BlackjackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly casino: CasinoService,
    private readonly events: EventEmitter2,
  ) {}

  async getTable(tableId: string) {
    const table = await this.prisma.gameTable.findUnique({ where: { id: tableId } });
    if (!table || table.type !== GameType.BLACKJACK) {
      throw new NotFoundException('Blackjack table not found');
    }
    if (table.status === TableStatus.CLOSED) {
      throw new BadRequestException('Table is closed');
    }
    return table;
  }

  async claimSeat(tableId: string, userId: string): Promise<number> {
    const table = await this.getTable(tableId);
    const players = await this.prisma.gamePlayer.findMany({
      where: { tableId, isActive: true },
      select: { seat: true, userId: true },
    });
    const mine = players.find((p) => p.userId === userId);
    if (mine) return mine.seat;
    if (players.length >= table.maxSeats) {
      throw new BadRequestException('Table is full');
    }
    const taken = new Set(players.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;

    await this.prisma.gamePlayer.upsert({
      where: { tableId_userId: { tableId, userId } },
      create: { tableId, userId, seat, isActive: true },
      update: { isActive: true, seat, leftAt: null },
    });
    await this.touch(tableId);
    this.events.emit(AppEvents.TablesChanged, { type: 'BLACKJACK' });
    return seat;
  }

  async leaveSeat(tableId: string, userId: string): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { tableId, userId },
      data: { isActive: false, leftAt: new Date() },
    });
    await this.touch(tableId);
    this.events.emit(AppEvents.TablesChanged, { type: 'BLACKJACK' });
  }

  async debitBet(userId: string, tableId: string, amount: number): Promise<number> {
    const { balance } = await this.balance.adjust({
      userId,
      amount: -amount,
      type: TransactionType.BET_PLACED,
      reason: 'Blackjack bet',
      gameType: GameType.BLACKJACK,
      refId: tableId,
      description: `Mise blackjack (${amount} VC)`,
      wagered: amount,
    });
    return balance;
  }

  async settleSeat(
    userId: string,
    roundId: string,
    bet: number,
    returned: number,
  ): Promise<number> {
    const net = returned - bet;
    const { balance } = await this.balance.adjust({
      userId,
      amount: returned,
      type: TransactionType.BET_PAYOUT,
      reason: returned > bet ? 'Blackjack win' : 'Blackjack result',
      gameType: GameType.BLACKJACK,
      refId: roundId,
      description: `Blackjack: ${returned > 0 ? `+${returned}` : 'perdu'} VC`,
      won: net > 0 ? net : 0,
      lost: net < 0 ? -net : 0,
      allowNegative: true,
    });
    return balance;
  }

  /** Persists a finished round and books the house result. */
  async recordRound(
    tableId: string,
    roundId: string,
    dealer: Card[],
    results: SeatResult[],
  ): Promise<void> {
    await this.prisma.gameRound.create({
      data: {
        id: roundId,
        gameType: GameType.BLACKJACK,
        tableId,
        serverSeed: 'shoe',
        serverSeedHash: 'shoe',
        result: { dealer, results } as object,
        bets: {
          create: results.map((r) => ({
            userId: r.userId,
            gameType: GameType.BLACKJACK,
            betType: r.outcome,
            selection: {} as object,
            stake: r.bet,
            payout: r.returned,
            won: r.returned > r.bet,
          })),
        },
      },
    });

    const wagered = results.reduce((s, r) => s + r.bet, 0);
    const paidOut = results.reduce((s, r) => s + r.returned, 0);
    await this.casino.recordRound(wagered, paidOut);
    this.events.emit(AppEvents.LeaderboardDirty, {});
    await this.touch(tableId);
  }

  touch(tableId: string): Promise<unknown> {
    return this.prisma.gameTable
      .update({ where: { id: tableId }, data: { lastActivityAt: new Date() } })
      .catch(() => null);
  }
}
