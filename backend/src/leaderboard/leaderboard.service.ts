import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { CasinoService } from '../economy/casino.service';

const CACHE_TTL = 10; // seconds, per spec

export interface LeaderboardEntry {
  rank: number;
  username: string;
  value: number;
  badge: string;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly casino: CasinoService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch (e) {
      this.logger.warn(`Redis read failed for ${key}: ${(e as Error).message}`);
    }
    const value = await factory();
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL);
    } catch {
      /* cache best-effort */
    }
    return value;
  }

  async getWealth(limit = 50): Promise<LeaderboardEntry[]> {
    return this.cached(`lb:wealth:${limit}`, async () => {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { balance: 'desc' },
        take: limit,
        select: { username: true, balance: true, rank: true },
      });
      return users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        value: u.balance,
        badge: u.rank,
      }));
    });
  }

  async getGains(limit = 50): Promise<LeaderboardEntry[]> {
    return this.cached(`lb:gains:${limit}`, async () => {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { netGains: 'desc' },
        take: limit,
        select: { username: true, netGains: true, rank: true },
      });
      return users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        value: u.netGains,
        badge: u.rank,
      }));
    });
  }

  async getCasino() {
    return this.casino.getStats();
  }
}
