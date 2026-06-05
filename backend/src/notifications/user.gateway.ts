import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../common/token/token.service';
import { authenticateSocket } from '../common/ws/ws-auth';
import {
  AppEvents,
  BalanceUpdatedEvent,
  NotificationCreatedEvent,
  RankUpEvent,
} from '../common/events/app-events';

/**
 * Per-user realtime channel. Each socket joins room `user:<id>` and receives
 * balance syncs, notifications and rank-ups. Balance is always server-driven.
 */
@WebSocketGateway({ namespace: '/user', cors: { origin: true, credentials: true } })
export class UserGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(UserGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly tokens: TokenService) {}

  handleConnection(client: Socket): void {
    const user = authenticateSocket(client, this.tokens);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.userId = user.userId;
    client.join(`user:${user.userId}`);
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId;
    if (userId) client.leave(`user:${userId}`);
  }

  @OnEvent(AppEvents.BalanceUpdated)
  onBalance(e: BalanceUpdatedEvent): void {
    this.server.to(`user:${e.userId}`).emit('balance:update', {
      balance: e.balance,
      delta: e.delta,
      reason: e.reason,
    });
  }

  @OnEvent(AppEvents.NotificationCreated)
  onNotification(e: NotificationCreatedEvent): void {
    this.server.to(`user:${e.userId}`).emit('notification', e.notification);
  }

  @OnEvent(AppEvents.RankUp)
  onRankUp(e: RankUpEvent): void {
    this.server.to(`user:${e.userId}`).emit('rank:up', { rank: e.rank });
  }
}
