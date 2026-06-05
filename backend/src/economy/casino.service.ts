import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppEvents, CasinoUpdatedEvent } from '../common/events/app-events';

const GLOBAL_ID = 'global';

@Injectable()
export class CasinoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async getStats() {
    return this.prisma.casinoStat.upsert({
      where: { id: GLOBAL_ID },
      create: { id: GLOBAL_ID },
      update: {},
    });
  }

  /**
   * Records the house result of a settled round. `wagered` is the total staked
   * by players, `paidOut` is the total returned to them. House earnings is the
   * net difference (sum of net player losses).
   */
  async recordRound(wagered: number, paidOut: number, rounds = 1): Promise<void> {
    const stat = await this.prisma.casinoStat.upsert({
      where: { id: GLOBAL_ID },
      create: {
        id: GLOBAL_ID,
        totalEarnings: wagered - paidOut,
        totalWagered: wagered,
        totalPaidOut: paidOut,
        roundsPlayed: rounds,
      },
      update: {
        totalEarnings: { increment: wagered - paidOut },
        totalWagered: { increment: wagered },
        totalPaidOut: { increment: paidOut },
        roundsPlayed: { increment: rounds },
      },
    });

    const payload: CasinoUpdatedEvent = {
      totalEarnings: stat.totalEarnings,
      totalWagered: stat.totalWagered,
      totalPaidOut: stat.totalPaidOut,
      roundsPlayed: stat.roundsPlayed,
    };
    this.events.emit(AppEvents.CasinoUpdated, payload);
  }
}
