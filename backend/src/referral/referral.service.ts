import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        rewardReferrer: true,
        createdAt: true,
        referred: { select: { username: true, rank: true } },
      },
    });

    const totalEarned = referrals.reduce((sum, r) => sum + r.rewardReferrer, 0);

    return {
      code: user.referralCode,
      count: referrals.length,
      totalEarned,
      referrals: referrals.map((r) => ({
        username: r.referred.username,
        rank: r.referred.rank,
        reward: r.rewardReferrer,
        joinedAt: r.createdAt,
      })),
    };
  }
}
