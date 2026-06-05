import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, Prisma, TransactionType } from '@prisma/client';
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
    const outcome = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: p.userId },
        select: {
          balance: true,
          totalWagered: true,
          totalWon: true,
          totalLost: true,
          rank: true,
        },
      });
      if (!user) throw new NotFoundException('User not found');

      const newBalance = user.balance + p.amount;
      if (newBalance < 0 && !p.allowNegative) {
        throw new BadRequestException('Insufficient balance');
      }

      const totalWon = user.totalWon + (p.won ?? 0);
      const totalLost = user.totalLost + (p.lost ?? 0);
      const totalWagered = user.totalWagered + (p.wagered ?? 0);
      const netGains = totalWon - totalLost;
      const newRank = computeRank(totalWon);

      await tx.user.update({
        where: { id: p.userId },
        data: {
          balance: newBalance,
          totalWon,
          totalLost,
          totalWagered,
          netGains,
          rank: newRank,
        },
      });

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

      return { newBalance, transactionId: transaction.id, prevRank: user.rank, newRank };
    });

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
      const from = await tx.user.findUnique({
        where: { id: params.fromUserId },
        select: { balance: true },
      });
      if (!from) throw new NotFoundException('Sender not found');
      if (from.balance < params.amount) {
        throw new BadRequestException('Insufficient balance');
      }
      const to = await tx.user.findUnique({
        where: { id: params.toUserId },
        select: { balance: true },
      });
      if (!to) throw new NotFoundException('Recipient not found');

      const fromBalance = from.balance - params.amount;
      const toBalance = to.balance + params.amount;

      await tx.user.update({ where: { id: params.fromUserId }, data: { balance: fromBalance } });
      await tx.user.update({ where: { id: params.toUserId }, data: { balance: toBalance } });

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
