import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Namespace, Socket } from 'socket.io';
import { TokenService } from '../../common/token/token.service';
import { authenticateSocket, WsUser } from '../../common/ws/ws-auth';
import { seededFloat, SeedPair } from '../../common/rng/provably-fair';
import { colorOf, pocketFromFloat, RouletteBet } from './roulette.engine';
import { RouletteService, UserRoundBets } from './roulette.service';

type Phase = 'BETTING' | 'SPINNING' | 'PAYOUT';

const BETTING_MS = 20_000;
const SPINNING_MS = 6_000;
const PAYOUT_MS = 4_000;
const ROOM = 'roulette';

interface CurrentRound {
  id: string;
  seed: SeedPair;
  nonce: number;
  bets: Map<string, UserRoundBets>;
}

@WebSocketGateway({ namespace: '/roulette', cors: { origin: true, credentials: true } })
export class RouletteGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RouletteGateway.name);

  @WebSocketServer()
  server!: Namespace;

  private phase: Phase = 'BETTING';
  private phaseEndsAt = 0;
  private nonce = 1;
  private round!: CurrentRound;
  private history: number[] = [];
  private loopTimer?: NodeJS.Timeout;

  constructor(
    private readonly tokens: TokenService,
    private readonly roulette: RouletteService,
  ) {}

  async afterInit(): Promise<void> {
    await this.roulette.ensureTable();
    this.history = await this.roulette.history(20);
    this.startBetting();
  }

  handleConnection(client: Socket): void {
    const user = authenticateSocket(client, this.tokens);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
  }

  handleDisconnect(): void {
    /* bets persist for the round even if a client drops */
  }

  // --- Loop ---

  private startBetting(): void {
    this.phase = 'BETTING';
    this.round = {
      id: randomUUID(),
      seed: this.roulette.newSeed(),
      nonce: this.nonce++,
      bets: new Map(),
    };
    this.phaseEndsAt = Date.now() + BETTING_MS;
    this.broadcastState();
    this.loopTimer = setTimeout(() => this.spin(), BETTING_MS);
  }

  private spin(): void {
    if (this.phase !== 'BETTING') return;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.phase = 'SPINNING';
    this.phaseEndsAt = Date.now() + SPINNING_MS;

    // Pre-compute the target so the client animates to the real result.
    const x = seededFloat(this.round.seed.serverSeed, ROOM, this.round.nonce);
    const target = pocketFromFloat(x);
    this.server.to(ROOM).emit('spin:start', {
      targetNumber: target,
      color: colorOf(target),
      spinSeedHash: this.round.seed.serverSeedHash,
      duration: SPINNING_MS,
    });
    this.broadcastState();
    this.loopTimer = setTimeout(() => void this.settle(), SPINNING_MS);
  }

  private async settle(): Promise<void> {
    this.phase = 'PAYOUT';
    const round = this.round;
    try {
      const result = await this.roulette.resolveRound({
        roundId: round.id,
        tableId: ROOM,
        seed: round.seed,
        nonce: round.nonce,
        betsByUser: Array.from(round.bets.values()),
      });

      this.history = [result.number, ...this.history].slice(0, 20);
      this.server.to(ROOM).emit('spin:result', {
        number: result.number,
        color: result.color,
        round: round.id,
      });
      this.server.to(ROOM).emit('history', { results: this.history });

      // Per-user payout messages.
      for (const p of result.payouts) {
        this.server.to(`rl:${p.userId}`).emit('payout', {
          winnings: p.winnings,
          net: p.net,
          balance: p.balance,
          winningBets: p.winningBets,
        });
      }
    } catch (e) {
      this.logger.error(`Settle failed: ${(e as Error).message}`);
    }

    this.phaseEndsAt = Date.now() + PAYOUT_MS;
    this.broadcastState();
    this.loopTimer = setTimeout(() => this.startBetting(), PAYOUT_MS);
  }

  private broadcastState(): void {
    this.server.to(ROOM).emit('state', {
      phase: this.phase,
      timer: Math.max(0, this.phaseEndsAt - Date.now()),
      roundId: this.round?.id,
      seedHash: this.round?.seed.serverSeedHash,
      players: this.server.adapter?.rooms?.get(ROOM)?.size ?? 0,
      bettors: Array.from(this.round?.bets.values() ?? []).map((b) => ({
        username: b.username,
        totalStake: b.totalStake,
      })),
      history: this.history,
    });
  }

  // --- Client events ---

  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() client: Socket): void {
    const user = client.data.user as WsUser;
    client.join(ROOM);
    client.join(`rl:${user.userId}`);
    client.emit('state', {
      phase: this.phase,
      timer: Math.max(0, this.phaseEndsAt - Date.now()),
      roundId: this.round?.id,
      history: this.history,
    });
    client.emit('history', { results: this.history });
  }

  @SubscribeMessage('bet:place')
  async onBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bets: RouletteBet[] },
  ): Promise<void> {
    const user = client.data.user as WsUser;
    if (this.phase !== 'BETTING') {
      client.emit('bet:rejected', { reason: 'Betting is closed' });
      return;
    }
    try {
      const { pricedBets, totalStake, balance } = await this.roulette.placeBets(
        user.userId,
        this.round.id,
        payload?.bets ?? [],
      );
      const existing = this.round.bets.get(user.userId);
      if (existing) {
        existing.bets.push(...pricedBets);
        existing.totalStake += totalStake;
      } else {
        this.round.bets.set(user.userId, {
          userId: user.userId,
          username: user.username,
          bets: pricedBets,
          totalStake,
        });
      }
      const all = this.round.bets.get(user.userId)!;
      client.emit('bet:accepted', {
        bets: all.bets,
        totalStake: all.totalStake,
        balance,
      });
      this.broadcastState();
    } catch (e) {
      client.emit('bet:rejected', { reason: (e as Error).message });
    }
  }

  @SubscribeMessage('bet:clear')
  async onClear(@ConnectedSocket() client: Socket): Promise<void> {
    const user = client.data.user as WsUser;
    if (this.phase !== 'BETTING') {
      client.emit('bet:rejected', { reason: 'Betting is closed' });
      return;
    }
    const existing = this.round.bets.get(user.userId);
    if (!existing || existing.totalStake <= 0) return;
    await this.roulette.refund(user.userId, this.round.id, existing.totalStake);
    this.round.bets.delete(user.userId);
    client.emit('bet:accepted', { bets: [], totalStake: 0 });
    this.broadcastState();
  }

  @SubscribeMessage('spin:request')
  onSpinRequest(@ConnectedSocket() client: Socket): void {
    // Host-triggered early spin (used by the IRL full-screen "Mode Table Réelle").
    if (this.phase === 'BETTING') this.spin();
  }
}
