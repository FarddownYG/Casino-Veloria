import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameType, TableStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BalanceService } from '../../economy/balance.service';
import { AppEvents } from '../../common/events/app-events';

@Injectable()
export class PokerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly events: EventEmitter2,
  ) {}

  async getTable(tableId: string) {
    const table = await this.prisma.gameTable.findUnique({ where: { id: tableId } });
    if (!table || table.type !== GameType.POKER) {
      throw new NotFoundException('Poker table not found');
    }
    if (table.status === TableStatus.CLOSED) throw new BadRequestException('Table is closed');
    return table;
  }

  /** Buy in: debit balance, allocate a seat with a chip stack. */
  async buyIn(tableId: string, userId: string, buyIn: number): Promise<{ seat: number; stack: number }> {
    const table = await this.getTable(tableId);
    if (buyIn < table.minBet * 10) {
      throw new BadRequestException(`Minimum buy-in is ${table.minBet * 10} VC`);
    }
    const players = await this.prisma.gamePlayer.findMany({
      where: { tableId, isActive: true },
      select: { seat: true, userId: true, stack: true },
    });
    const existing = players.find((p) => p.userId === userId);
    if (existing) {
      // Reconnect: return the player's real persisted stack (was 0, which wiped
      // the chips of any player who rejoined after a disconnect / server boot).
      return { seat: existing.seat, stack: existing.stack };
    }
    if (players.length >= table.maxSeats) throw new BadRequestException('Table is full');

    await this.balance.adjust({
      userId,
      amount: -buyIn,
      type: TransactionType.BET_PLACED,
      reason: 'Poker buy-in',
      gameType: GameType.POKER,
      refId: tableId,
      description: `Cave poker (${buyIn} VC)`,
      wagered: buyIn,
    });

    const taken = new Set(players.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;

    await this.prisma.gamePlayer.upsert({
      where: { tableId_userId: { tableId, userId } },
      create: { tableId, userId, seat, stack: buyIn, isActive: true },
      update: { isActive: true, seat, stack: buyIn, leftAt: null },
    });
    await this.touch(tableId);
    this.events.emit(AppEvents.TablesChanged, { type: 'POKER' });
    return { seat, stack: buyIn };
  }

  /** Cash out: credit the remaining stack back, record session P/L. */
  async cashOut(tableId: string, userId: string, finalStack: number, buyInTotal: number): Promise<number> {
    const net = finalStack - buyInTotal;
    let balance = 0;
    if (finalStack > 0) {
      const res = await this.balance.adjust({
        userId,
        amount: finalStack,
        type: TransactionType.BET_PAYOUT,
        reason: 'Poker cash-out',
        gameType: GameType.POKER,
        refId: tableId,
        description: `Retrait poker (${finalStack} VC)`,
        won: net > 0 ? net : 0,
        lost: net < 0 ? -net : 0,
        allowNegative: true,
      });
      balance = res.balance;
    }
    await this.prisma.gamePlayer.updateMany({
      where: { tableId, userId },
      data: { isActive: false, stack: 0, leftAt: new Date() },
    });
    await this.touch(tableId);
    this.events.emit(AppEvents.TablesChanged, { type: 'POKER' });
    this.events.emit(AppEvents.LeaderboardDirty, {});
    return balance;
  }

  async syncStack(tableId: string, userId: string, stack: number): Promise<void> {
    await this.prisma.gamePlayer
      .updateMany({ where: { tableId, userId }, data: { stack } })
      .catch(() => null);
  }

  touch(tableId: string): Promise<unknown> {
    return this.prisma.gameTable
      .update({ where: { id: tableId }, data: { lastActivityAt: new Date() } })
      .catch(() => null);
  }
}
