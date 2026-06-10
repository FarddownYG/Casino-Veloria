import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, Prisma, Rank, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeRank, isPromotion } from '../common/ranking';
import { AppEvents, BalanceUpdatedEvent, RankUpEvent } from '../common/events/app-events';

export interface AdjustParams {
  userId: string;
  amount: number; // signed; negative = debit
  type: TransactionType;
  reason?: string;
  gameType?: Prisma.TransactionCreateInput['gameType'];
  refId?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  // Lifetime-aggregate increments (drive leaderboards + ranks).
  wagered?: number;
  won?: number;
  lost?: number;
  allowNegative?: boolean;
  // Optional parent transaction: when provided, the ledger writes join it so a
  // caller (e.g. register) can make the whole operation atomic. Realtime events
  // still fire after exec() returns.
  tx?: Prisma.TransactionClient;
}

export interface AdjustResult {
  balance: number;
  transactionId: string;
}

@Injectable()
export class BalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.balance;
  }

  /**
   * The single chokepoint for balance mutations. Atomically updates the
   * balance + lifetime aggregates + rank, writes an immutable ledger row, then
   * fans out realtime events. Throws on insufficient funds (unless allowed).
   */
  async adjust(p: AdjustParams): Promise<AdjustResult> {
    const exec = async (
      tx: Prisma.TransactionClient,
    ): Promise<{ newBalance: number; transactionId: string; prevRank: Rank; newRank: Rank }> => {
      // Atomic, conditional balance mutation. The increment AND the
      // sufficient-funds guard happen in a single UPDATE, so two concurrent
      // adjust() calls can never read the same balance and clobber each other
      // (the classic read-modify-write "lost update" race). The aggregate
      // columns reference their pre-update value on the right-hand side, so
      // netGains stays consistent with the new totalWon/totalLost.
      const wonInc = p.won ?? 0;
      const lostInc = p.lost ?? 0;
      const wageredInc = p.wagered ?? 0;
      const allowNegative = p.allowNegative ?? false;

      const rows = await tx.$queryRaw<
        { balance: number; totalWon: number; rank: Rank }[]
      >(Prisma.sql`
        UPDATE "users"
           SET "balance"      = "balance"      + ${p.amount},
               "totalWon"     = "totalWon"     + ${wonInc},
               "totalLost"    = "totalLost"    + ${lostInc},
               "totalWagered" = "totalWagered" + ${wageredInc},
               "netGains"     = ("totalWon" + ${wonInc}) - ("totalLost" + ${lostInc})
         WHERE "id" = ${p.userId}
           AND (${allowNegative} OR "balance" + ${p.amount} >= 0)
         RETURNING "balance", "totalWon", "rank"
      `);

      if (rows.length === 0) {
        // No row updated: either the user is gone or the balance guard failed.
        const exists = await tx.user.findUnique({
          where: { id: p.userId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('User not found');
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = rows[0].balance;
      const prevRank = rows[0].rank;
      const newRank = computeRank(rows[0].totalWon);
      if (newRank !== prevRank) {
        await tx.user.update({ where: { id: p.userId }, data: { rank: newRank } });
      }

      const transaction = await tx.transaction.create({
        data: {
          userId: p.userId,
          type: p.type,
          amount: p.amount,
          balanceAfter: newBalance,
          gameType: p.gameType ?? null,
          refId: p.refId,
          description: p.description,
          metadata: p.metadata,
        },
      });

      return { newBalance, transactionId: transaction.id, prevRank, newRank };
    };
    const outcome = p.tx ? await exec(p.tx) : await this.prisma.$transaction(exec);

    const balanceEvent: BalanceUpdatedEvent = {
      userId: p.userId,
      balance: outcome.newBalance,
      delta: p.amount,
      reason: p.reason ?? p.type,
    };
    this.events.emit(AppEvents.BalanceUpdated, balanceEvent);

    if (isPromotion(outcome.prevRank, outcome.newRank)) {
      const rankEvent: RankUpEvent = { userId: p.userId, rank: outcome.newRank };
      this.events.emit(AppEvents.RankUp, rankEvent);
      await this.notifications.create({
        userId: p.userId,
        type: NotificationType.RANK_UP,
        title: 'Nouveau rang débloqué !',
        body: `Félicitations, vous êtes maintenant ${outcome.newRank} 🏆`,
        data: { rank: outcome.newRank },
      });
    }

    return { balance: outcome.newBalance, transactionId: outcome.transactionId };
  }

  /**
   * Atomic two-party transfer (P2P loans, gifts). Both legs and both ledger
   * rows commit together. Aggregates are untouched (transfers aren't wagers).
   */
  async transfer(params: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    fromType: TransactionType;
    toType: TransactionType;
    refId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<{ fromBalance: number; toBalance: number }> {
    if (params.amount <= 0) throw new BadRequestException('Amount must be positive');

    const result = await this.prisma.$transaction(async (tx) => {
      // Debit the sender atomically with a balance guard (prevents an overdraft
      // race under concurrency), then credit the recipient. Both legs and both
      // ledger rows commit together.
      const fromRows = await tx.$queryRaw<{ balance: number }[]>(Prisma.sql`
        UPDATE "users"
           SET "balance" = "balance" - ${params.amount}
         WHERE "id" = ${params.fromUserId} AND "balance" >= ${params.amount}
         RETURNING "balance"
      `);
      if (fromRows.length === 0) {
        const exists = await tx.user.findUnique({
          where: { id: params.fromUserId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Sender not found');
        throw new BadRequestException('Insufficient balance');
      }

      const toRows = await tx.$queryRaw<{ balance: number }[]>(Prisma.sql`
        UPDATE "users"
           SET "balance" = "balance" + ${params.amount}
         WHERE "id" = ${params.toUserId}
         RETURNING "balance"
      `);
      if (toRows.length === 0) throw new NotFoundException('Recipient not found');

      const fromBalance = fromRows[0].balance;
      const toBalance = toRows[0].balance;

      await tx.transaction.create({
        data: {
          userId: params.fromUserId,
          type: params.fromType,
          amount: -params.amount,
          balanceAfter: fromBalance,
          refId: params.refId,
          description: params.description,
          metadata: params.metadata,
        },
      });
      await tx.transaction.create({
        data: {
          userId: params.toUserId,
          type: params.toType,
          amount: params.amount,
          balanceAfter: toBalance,
          refId: params.refId,
          description: params.description,
          metadata: params.metadata,
        },
      });

      return { fromBalance, toBalance };
    });

    this.events.emit(AppEvents.BalanceUpdated, {
      userId: params.fromUserId,
      balance: result.fromBalance,
      delta: -params.amount,
      reason: params.fromType,
    } as BalanceUpdatedEvent);
    this.events.emit(AppEvents.BalanceUpdated, {
      userId: params.toUserId,
      balance: result.toBalance,
      delta: params.amount,
      reason: params.toType,
    } as BalanceUpdatedEvent);

    return result;
  }
}
