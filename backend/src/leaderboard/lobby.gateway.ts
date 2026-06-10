import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Namespace, Socket } from 'socket.io';
import { TableStatus } from '@prisma/client';
import { TokenService } from '../common/token/token.service';
import { authenticateSocket } from '../common/ws/ws-auth';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  AppEvents,
  CasinoUpdatedEvent,
  HotStreakEvent,
} from '../common/events/app-events';
import { LeaderboardService } from './leaderboard.service';

/**
 * Lobby realtime: online presence, casino-earnings ticker, hot streaks, live
 * leaderboards and the public table list.
 */
@WebSocketGateway({ namespace: '/lobby', cors: { origin: true, credentials: true } })
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LobbyGateway.name);
  private readonly onlineUsers = new Set<string>();

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = authenticateSocket(client, this.tokens);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.userId = user.userId;
    this.onlineUsers.add(user.userId);
    this.broadcastPresence();

    // Bootstrap the new client.
    const [casino, wealth, gains] = await Promise.all([
      this.leaderboard.getCasino(),
      this.leaderboard.getWealth(20),
      this.leaderboard.getGains(20),
    ]);
    client.emit('casino:earnings', {
      totalEarnings: casino.totalEarnings,
      totalWagered: casino.totalWagered,
      roundsPlayed: casino.roundsPlayed,
    });
    client.emit('leaderboard:wealth', { entries: wealth });
    client.emit('leaderboard:gains', { entries: gains });
    await this.sendTables(client);
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId;
    if (userId) {
      // Only drop presence when no other socket for this user remains.
      const stillConnected = Array.from(this.server.sockets.values()).some(
        (s) => s.id !== client.id && s.data?.userId === userId,
      );
      if (!stillConnected) this.onlineUsers.delete(userId);
      this.broadcastPresence();
    }
  }

  private broadcastPresence(): void {
    this.server.emit('presence', { online: this.onlineUsers.size });
  }

  private async sendTables(target: Socket | Namespace): Promise<void> {
    const tables = await this.prisma.gameTable.findMany({
      where: { status: { not: TableStatus.CLOSED }, isPersistent: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        name: true,
        minBet: true,
        maxBet: true,
        maxSeats: true,
        status: true,
        // Active seats only (see TablesService.list) so the lobby never shows
        // phantom occupants from players who already left.
        _count: { select: { players: { where: { isActive: true } } } },
      },
    });
    const summaries = tables.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      minBet: t.minBet,
      maxBet: t.maxBet,
      maxSeats: t.maxSeats,
      status: t.status,
      seated: t._count.players,
    }));
    target.emit('tables', { tables: summaries });
  }

  @SubscribeMessage('tables:subscribe')
  onTablesSubscribe(client: Socket) {
    return this.sendTables(client);
  }

  @OnEvent(AppEvents.CasinoUpdated)
  onCasino(e: CasinoUpdatedEvent): void {
    this.server.emit('casino:earnings', {
      totalEarnings: e.totalEarnings,
      totalWagered: e.totalWagered,
      roundsPlayed: e.roundsPlayed,
    });
  }

  @OnEvent(AppEvents.HotStreak)
  onHotStreak(e: HotStreakEvent): void {
    this.server.emit('hotstreak', e);
  }

  @OnEvent(AppEvents.TablesChanged)
  async onTablesChanged(): Promise<void> {
    await this.sendTables(this.server);
  }

  @OnEvent(AppEvents.LeaderboardDirty)
  async onLeaderboardDirty(): Promise<void> {
    const [wealth, gains] = await Promise.all([
      this.leaderboard.getWealth(20),
      this.leaderboard.getGains(20),
    ]);
    this.server.emit('leaderboard:wealth', { entries: wealth });
    this.server.emit('leaderboard:gains', { entries: gains });
  }
}
