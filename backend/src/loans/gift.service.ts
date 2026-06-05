import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendGiftDto } from './dto/loans.dto';

@Injectable()
export class GiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async send(senderId: string, dto: SendGiftDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { username: dto.recipientUsername, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!recipient) throw new BadRequestException('Recipient not found');
    if (recipient.id === senderId) {
      throw new BadRequestException('You cannot gift yourself');
    }

    const limit = this.config.get<number>('economy.giftDailyLimit') ?? 5000;
    const todaysGifts = await this.prisma.gift.aggregate({
      where: { senderId, createdAt: { gte: this.startOfToday() } },
      _sum: { amount: true },
    });
    const sentToday = todaysGifts._sum.amount ?? 0;
    if (sentToday + dto.amount > limit) {
      throw new BadRequestException(
        `Daily gift limit reached (${sentToday}/${limit} VC sent today)`,
      );
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { balance: true, username: true },
    });
    if (!sender) throw new NotFoundException('User not found');
    if (sender.balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const gift = await this.prisma.gift.create({
      data: {
        senderId,
        recipientId: recipient.id,
        amount: dto.amount,
        message: dto.message,
      },
    });

    await this.balance.transfer({
      fromUserId: senderId,
      toUserId: recipient.id,
      amount: dto.amount,
      fromType: TransactionType.GIFT_SENT,
      toType: TransactionType.GIFT_RECEIVED,
      refId: gift.id,
      description: dto.message ?? `Don à ${recipient.username}`,
    });

    await this.notifications.create({
      userId: recipient.id,
      type: NotificationType.GIFT_RECEIVED,
      title: `Cadeau reçu : +${dto.amount} VC 🎁`,
      body: `${sender.username} vous a fait un don${dto.message ? ` : “${dto.message}”` : ''}.`,
      data: { giftId: gift.id, from: sender.username },
    });

    return gift;
  }

  async history(userId: string) {
    const [sent, received] = await Promise.all([
      this.prisma.gift.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { recipient: { select: { username: true } } },
      }),
      this.prisma.gift.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { sender: { select: { username: true } } },
      }),
    ]);

    const limit = this.config.get<number>('economy.giftDailyLimit') ?? 5000;
    const todaysGifts = await this.prisma.gift.aggregate({
      where: { senderId: userId, createdAt: { gte: this.startOfToday() } },
      _sum: { amount: true },
    });

    return {
      sent,
      received,
      dailyLimit: limit,
      sentToday: todaysGifts._sum.amount ?? 0,
    };
  }
}
