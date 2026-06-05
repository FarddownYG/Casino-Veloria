import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameType, TableStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppEvents } from '../../common/events/app-events';
import { CreateTableDto } from './dto/tables.dto';

const EMPTY_TTL_MS = 3 * 60 * 1000; // auto-remove after 3 min empty

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateTableDto) {
    if (dto.type === GameType.ROULETTE) {
      throw new BadRequestException('Roulette uses the shared table');
    }
    if (dto.maxBet < dto.minBet) {
      throw new BadRequestException('maxBet must be >= minBet');
    }
    const table = await this.prisma.gameTable.create({
      data: {
        type: dto.type,
        name: dto.name,
        minBet: dto.minBet,
        maxBet: dto.maxBet,
        maxSeats: dto.maxSeats,
        createdById: userId,
        status: TableStatus.WAITING,
        config:
          dto.type === GameType.POKER
            ? { smallBlind: dto.smallBlind ?? Math.max(1, Math.floor(dto.minBet / 2)) }
            : {},
      },
    });
    this.events.emit(AppEvents.TablesChanged, { type: dto.type });
    return table;
  }

  async list(type?: GameType) {
    const tables = await this.prisma.gameTable.findMany({
      where: {
        status: { not: TableStatus.CLOSED },
        isPersistent: false,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true } }, createdBy: { select: { username: true } } },
    });
    return tables.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      minBet: t.minBet,
      maxBet: t.maxBet,
      maxSeats: t.maxSeats,
      status: t.status,
      seated: t._count.players,
      host: t.createdBy?.username,
      config: t.config,
    }));
  }

  async get(id: string) {
    const table = await this.prisma.gameTable.findUnique({
      where: { id },
      include: {
        players: {
          where: { isActive: true },
          include: { user: { select: { username: true, rank: true } } },
        },
      },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  /** BullMQ cleanup job: close tables empty for more than 3 minutes. */
  async closeEmptyTables(): Promise<{ closed: number }> {
    const cutoff = new Date(Date.now() - EMPTY_TTL_MS);
    const candidates = await this.prisma.gameTable.findMany({
      where: {
        isPersistent: false,
        status: { not: TableStatus.CLOSED },
        lastActivityAt: { lt: cutoff },
      },
      include: { _count: { select: { players: { where: { isActive: true } } } } },
    });

    let closed = 0;
    for (const t of candidates) {
      if (t._count.players === 0) {
        await this.prisma.gameTable.update({
          where: { id: t.id },
          data: { status: TableStatus.CLOSED },
        });
        closed++;
      }
    }
    if (closed > 0) this.events.emit(AppEvents.TablesChanged, { type: 'ALL' });
    return { closed };
  }

  touch(id: string): Promise<unknown> {
    return this.prisma.gameTable.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });
  }
}
