import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionType } from '@prisma/client';

const PRIVATE_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  balance: true,
  totalWagered: true,
  totalWon: true,
  totalLost: true,
  netGains: true,
  rank: true,
  referralCode: true,
  loginStreak: true,
  soundEnabled: true,
  marketingConsent: true,
  ageVerifiedAt: true,
  createdAt: true,
} as const;

const PUBLIC_SELECT = {
  id: true,
  username: true,
  balance: true,
  rank: true,
  netGains: true,
  createdAt: true,
} as const;

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async getPrivateProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PRIVATE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getHistory(username: string, requestingUserId: string, take = 25) {
    const user = await this.prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    // Bets and transactions (loans, gifts, descriptions) are private: only the
    // owner may read their own ledger. Public profile data lives on /:username.
    if (user.id !== requestingUserId) {
      throw new ForbiddenException('History is private');
    }

    const [bets, transactions] = await Promise.all([
      this.prisma.bet.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          gameType: true,
          betType: true,
          stake: true,
          payout: true,
          won: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          gameType: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);
    return { bets, transactions };
  }

  async updateSettings(
    userId: string,
    data: { soundEnabled?: boolean; marketingConsent?: boolean },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: PRIVATE_SELECT,
    });
  }

  async verifyAge(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { ageVerifiedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * RGPD right to erasure: anonymise PII and soft-delete. Ledger rows are kept
   * (legal/audit) but no longer point to identifiable data.
   */
  async deleteAccount(userId: string) {
    const anon = `deleted_${userId.slice(0, 8)}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `${anon}@deleted.veloria`,
        username: anon,
        passwordHash: 'DELETED',
        deletedAt: new Date(),
        soundEnabled: false,
        marketingConsent: false,
      },
    });
    return { success: true };
  }

  /** Updates login streak and awards the daily bonus from day 7 onward. */
  async processLogin(userId: string): Promise<{ streak: number; awarded: boolean; bonus: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true, loginStreak: true, lastStreakRewardAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const today = startOfDay(now);
    let streak = user.loginStreak;

    if (!user.lastLoginAt) {
      streak = 1;
    } else {
      const diffDays = Math.round((today - startOfDay(user.lastLoginAt)) / 86_400_000);
      if (diffDays === 0) {
        // same day — no change
      } else if (diffDays === 1) {
        streak += 1;
      } else {
        streak = 1;
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: now, loginStreak: streak },
    });

    const bonus = this.config.get<number>('economy.dailyStreakBonus') ?? 50;
    const rewardedToday =
      !!user.lastStreakRewardAt &&
      startOfDay(user.lastStreakRewardAt) === today;

    let awarded = false;
    if (streak >= 7 && !rewardedToday) {
      await this.balance.adjust({
        userId,
        amount: bonus,
        type: TransactionType.DAILY_STREAK,
        reason: 'Daily streak bonus',
        description: `Streak de ${streak} jours`,
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastStreakRewardAt: now },
      });
      await this.notifications.create({
        userId,
        type: NotificationType.STREAK_BONUS,
        title: `Bonus de série : +${bonus} VC 🔥`,
        body: `${streak} jours d'affilée ! Continuez pour garder votre série.`,
        data: { streak, bonus },
      });
      awarded = true;
    }

    return { streak, awarded, bonus };
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!user) throw new BadRequestException('Recipient not found');
    return user;
  }
}
