import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../../common/token/token.service';
import { authenticateSocket, WsUser } from '../../common/ws/ws-auth';
import { cryptoRng } from '../../common/rng/provably-fair';
import {
  Card,
  canSplit,
  createShoe,
  handValue,
  isBlackjack,
  isBust,
  playDealer,
  settle,
} from './engine';
import { BlackjackService, SeatResult } from './blackjack.service';

const BETTING_MS = 15_000;
const TURN_MS = 30_000;
const PAYOUT_MS = 6_000;
const MAX_HANDS = 2;

type Phase = 'WAITING' | 'BETTING' | 'PLAYER_TURN' | 'DEALER' | 'PAYOUT';

interface Hand {
  cards: Card[];
  bet: number;
  status: 'PLAYING' | 'STAND' | 'BUST' | 'DONE';
  doubled: boolean;
}
interface Seat {
  userId: string;
  username: string;
  seatIndex: number;
  bet: number;
  hasBet: boolean;
  hands: Hand[];
  activeHand: number;
}
interface Runtime {
  id: string;
  minBet: number;
  maxBet: number;
  maxSeats: number;
  seats: Map<string, Seat>;
  order: string[];
  phase: Phase;
  shoe: Card[];
  dealer: Card[];
  activeUserId?: string;
  roundId?: string;
  timer?: NodeJS.Timeout;
  phaseEndsAt: number;
}

@WebSocketGateway({ namespace: '/blackjack', cors: { origin: true, credentials: true } })
export class BlackjackGateway implements OnGatewayConnection {
  private readonly logger = new Logger(BlackjackGateway.name);
  private readonly rng = cryptoRng();
  private readonly tables = new Map<string, Runtime>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly blackjack: BlackjackService,
  ) {}

  handleConnection(client: Socket): void {
    const user = authenticateSocket(client, this.tokens);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
  }

  private room(tableId: string): string {
    return `bj:${tableId}`;
  }

  private async runtime(tableId: string): Promise<Runtime> {
    let rt = this.tables.get(tableId);
    if (!rt) {
      const table = await this.blackjack.getTable(tableId);
      rt = {
        id: tableId,
        minBet: table.minBet,
        maxBet: table.maxBet,
        maxSeats: table.maxSeats,
        seats: new Map(),
        order: [],
        phase: 'WAITING',
        shoe: createShoe(6, this.rng),
        dealer: [],
        phaseEndsAt: 0,
      };
      this.tables.set(tableId, rt);
    }
    return rt;
  }

  private draw(rt: Runtime): Card {
    if (rt.shoe.length < 15) rt.shoe = createShoe(6, this.rng);
    return rt.shoe.pop()!;
  }

  // --- events ---

  @SubscribeMessage('table:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string },
  ): Promise<void> {
    const user = client.data.user as WsUser;
    try {
      const seatIndex = await this.blackjack.claimSeat(body.tableId, user.userId);
      const rt = await this.runtime(body.tableId);
      client.join(this.room(body.tableId));
      client.data.tableId = body.tableId;
      if (!rt.seats.has(user.userId)) {
        rt.seats.set(user.userId, {
          userId: user.userId,
          username: user.username,
          seatIndex,
          bet: 0,
          hasBet: false,
          hands: [],
          activeHand: 0,
        });
      }
      client.emit('table:joined', { tableId: body.tableId, seat: seatIndex });
      this.emitState(rt);
      if (rt.phase === 'WAITING') this.startBetting(rt);
    } catch (e) {
      client.emit('error', { reason: (e as Error).message });
    }
  }

  @SubscribeMessage('table:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string },
  ): Promise<void> {
    const user = client.data.user as WsUser;
    const rt = this.tables.get(body.tableId);
    await this.blackjack.leaveSeat(body.tableId, user.userId);
    client.leave(this.room(body.tableId));
    if (rt) {
      rt.seats.delete(user.userId);
      client.emit('table:left', { tableId: body.tableId });
      this.emitState(rt);
    }
  }

  @SubscribeMessage('bet')
  async onBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; amount: number },
  ): Promise<void> {
    const user = client.data.user as WsUser;
    const rt = this.tables.get(body.tableId);
    if (!rt || rt.phase !== 'BETTING') {
      client.emit('error', { reason: 'Not in betting phase' });
      return;
    }
    const seat = rt.seats.get(user.userId);
    if (!seat || seat.hasBet) return;
    if (body.amount < rt.minBet || body.amount > rt.maxBet) {
      client.emit('error', { reason: `Bet must be ${rt.minBet}-${rt.maxBet} VC` });
      return;
    }
    try {
      await this.blackjack.debitBet(user.userId, rt.id, body.amount);
      seat.bet = body.amount;
      seat.hasBet = true;
      this.emitState(rt);
      const bettors = [...rt.seats.values()].filter((s) => s.hasBet).length;
      const seated = rt.seats.size;
      if (bettors === seated) this.deal(rt);
    } catch (e) {
      client.emit('error', { reason: (e as Error).message });
    }
  }

  @SubscribeMessage('action')
  onAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; move: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' },
  ): void {
    const user = client.data.user as WsUser;
    const rt = this.tables.get(body.tableId);
    if (!rt || rt.phase !== 'PLAYER_TURN' || rt.activeUserId !== user.userId) {
      client.emit('error', { reason: 'Not your turn' });
      return;
    }
    void this.applyAction(rt, user, body.move, client);
  }

  // --- flow ---

  private startBetting(rt: Runtime): void {
    if (rt.seats.size === 0) {
      rt.phase = 'WAITING';
      this.emitState(rt);
      return;
    }
    rt.phase = 'BETTING';
    rt.roundId = randomUUID();
    rt.dealer = [];
    rt.activeUserId = undefined;
    for (const s of rt.seats.values()) {
      s.bet = 0;
      s.hasBet = false;
      s.hands = [];
      s.activeHand = 0;
    }
    rt.phaseEndsAt = Date.now() + BETTING_MS;
    this.emitState(rt);
    this.clearTimer(rt);
    rt.timer = setTimeout(() => this.deal(rt), BETTING_MS);
  }

  private deal(rt: Runtime): void {
    this.clearTimer(rt);
    const bettors = [...rt.seats.values()]
      .filter((s) => s.hasBet)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    if (bettors.length === 0) {
      this.startBetting(rt);
      return;
    }
    rt.order = bettors.map((s) => s.userId);
    for (const s of bettors) {
      s.hands = [{ cards: [this.draw(rt), this.draw(rt)], bet: s.bet, status: 'PLAYING', doubled: false }];
      s.activeHand = 0;
    }
    rt.dealer = [this.draw(rt), this.draw(rt)];
    rt.phase = 'PLAYER_TURN';

    // Naturals auto-resolve.
    for (const s of bettors) {
      if (isBlackjack(s.hands[0].cards)) s.hands[0].status = 'DONE';
    }
    this.server.to(this.room(rt.id)).emit('deal', {
      dealerUp: rt.dealer[0],
      seats: bettors.map((s) => ({ userId: s.userId, hands: s.hands })),
    });
    this.advanceToNextActionable(rt, -1);
  }

  private currentSeat(rt: Runtime): Seat | undefined {
    return rt.activeUserId ? rt.seats.get(rt.activeUserId) : undefined;
  }

  private startTurn(rt: Runtime): void {
    rt.phase = 'PLAYER_TURN';
    rt.phaseEndsAt = Date.now() + TURN_MS;
    this.emitState(rt);
    const seat = this.currentSeat(rt);
    if (seat) {
      this.server.to(this.room(rt.id)).emit('turn', {
        seat: seat.seatIndex,
        userId: seat.userId,
        activeHand: seat.activeHand,
        timer: TURN_MS,
      });
    }
    this.clearTimer(rt);
    rt.timer = setTimeout(() => {
      // Auto-stand on timeout.
      const s = this.currentSeat(rt);
      if (s && s.hands[s.activeHand]) s.hands[s.activeHand].status = 'STAND';
      this.advanceHand(rt);
    }, TURN_MS);
  }

  private async applyAction(
    rt: Runtime,
    user: WsUser,
    move: string,
    client: Socket,
  ): Promise<void> {
    const seat = this.currentSeat(rt);
    if (!seat || seat.userId !== user.userId) return;
    const hand = seat.hands[seat.activeHand];
    if (!hand || hand.status !== 'PLAYING') return;
    this.clearTimer(rt);

    if (move === 'HIT') {
      hand.cards.push(this.draw(rt));
      if (isBust(hand.cards)) hand.status = 'BUST';
      if (hand.status === 'PLAYING' && handValue(hand.cards).total === 21) hand.status = 'STAND';
    } else if (move === 'STAND') {
      hand.status = 'STAND';
    } else if (move === 'DOUBLE') {
      if (hand.cards.length !== 2) {
        client.emit('error', { reason: 'Can only double on first two cards' });
        return this.startTurn(rt);
      }
      try {
        await this.blackjack.debitBet(user.userId, rt.id, hand.bet);
      } catch (e) {
        client.emit('error', { reason: (e as Error).message });
        return this.startTurn(rt);
      }
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(this.draw(rt));
      hand.status = isBust(hand.cards) ? 'BUST' : 'STAND';
    } else if (move === 'SPLIT') {
      if (!canSplit(hand.cards) || seat.hands.length >= MAX_HANDS) {
        client.emit('error', { reason: 'Cannot split' });
        return this.startTurn(rt);
      }
      try {
        await this.blackjack.debitBet(user.userId, rt.id, hand.bet);
      } catch (e) {
        client.emit('error', { reason: (e as Error).message });
        return this.startTurn(rt);
      }
      const [c1, c2] = hand.cards;
      const newHand: Hand = { cards: [c2, this.draw(rt)], bet: hand.bet, status: 'PLAYING', doubled: false };
      hand.cards = [c1, this.draw(rt)];
      seat.hands.splice(seat.activeHand + 1, 0, newHand);
    }

    if (hand.status === 'PLAYING') {
      this.startTurn(rt);
    } else {
      this.advanceHand(rt);
    }
  }

  private advanceHand(rt: Runtime): void {
    const seat = this.currentSeat(rt);
    if (seat) {
      // Move to next playable hand of this seat.
      for (let i = seat.activeHand + 1; i < seat.hands.length; i++) {
        if (seat.hands[i].status === 'PLAYING') {
          seat.activeHand = i;
          this.startTurn(rt);
          return;
        }
      }
    }
    const fromIndex = rt.order.indexOf(rt.activeUserId ?? '');
    this.advanceToNextActionable(rt, fromIndex);
  }

  private advanceToNextActionable(rt: Runtime, fromIndex: number): void {
    for (let i = fromIndex + 1; i < rt.order.length; i++) {
      const seat = rt.seats.get(rt.order[i]);
      if (!seat) continue;
      const idx = seat.hands.findIndex((h) => h.status === 'PLAYING');
      if (idx >= 0) {
        seat.activeHand = idx;
        rt.activeUserId = seat.userId;
        this.startTurn(rt);
        return;
      }
    }
    void this.dealerPhase(rt);
  }

  private async dealerPhase(rt: Runtime): Promise<void> {
    this.clearTimer(rt);
    rt.phase = 'DEALER';
    rt.activeUserId = undefined;

    // Only run the dealer if at least one player hand survived.
    const anyAlive = [...rt.seats.values()].some((s) =>
      s.hands.some((h) => h.status !== 'BUST'),
    );
    if (anyAlive) {
      rt.dealer = playDealer(rt.dealer, () => this.draw(rt));
    }
    this.server.to(this.room(rt.id)).emit('dealer', { cards: rt.dealer });
    await this.settleRound(rt);
  }

  private async settleRound(rt: Runtime): Promise<void> {
    const roundId = rt.roundId ?? randomUUID();
    const results: SeatResult[] = [];

    for (const userId of rt.order) {
      const seat = rt.seats.get(userId);
      if (!seat) continue;
      let totalBet = 0;
      let totalReturn = 0;
      let netOutcome: SeatResult['outcome'] = 'PUSH';
      for (const hand of seat.hands) {
        totalBet += hand.bet;
        const { outcome, multiplier } = settle(hand.cards, rt.dealer);
        let returned = 0;
        if (outcome === 'PUSH') returned = hand.bet;
        else if (outcome !== 'LOSE') returned = hand.bet + Math.round(hand.bet * multiplier);
        totalReturn += returned;
        netOutcome = outcome;
      }
      const balance = await this.blackjack.settleSeat(userId, roundId, totalBet, totalReturn);
      results.push({
        userId,
        username: seat.username,
        bet: totalBet,
        returned: totalReturn,
        outcome: totalReturn > totalBet ? 'WIN' : totalReturn === totalBet ? 'PUSH' : netOutcome,
      });
      this.server.to(this.room(rt.id)).emit('result:seat', {
        userId,
        bet: totalBet,
        returned: totalReturn,
        net: totalReturn - totalBet,
        balance,
      });
    }

    if (results.length > 0) {
      await this.blackjack.recordRound(rt.id, roundId, rt.dealer, results);
    }
    this.server.to(this.room(rt.id)).emit('result', { dealer: rt.dealer, outcomes: results });

    rt.phase = 'PAYOUT';
    rt.phaseEndsAt = Date.now() + PAYOUT_MS;
    this.emitState(rt);
    this.clearTimer(rt);
    rt.timer = setTimeout(() => this.startBetting(rt), PAYOUT_MS);
  }

  private clearTimer(rt: Runtime): void {
    if (rt.timer) {
      clearTimeout(rt.timer);
      rt.timer = undefined;
    }
  }

  private emitState(rt: Runtime): void {
    const inPlay = rt.phase === 'PLAYER_TURN' || rt.phase === 'DEALER';
    const dealer =
      rt.phase === 'DEALER' || rt.phase === 'PAYOUT'
        ? rt.dealer
        : rt.dealer.length
          ? [rt.dealer[0], { rank: '?', suit: '?' }]
          : [];
    this.server.to(this.room(rt.id)).emit('table:state', {
      tableId: rt.id,
      phase: rt.phase,
      timer: Math.max(0, rt.phaseEndsAt - Date.now()),
      activeUserId: rt.activeUserId,
      dealer,
      dealerValue: inPlay ? undefined : rt.dealer.length ? handValue(rt.dealer).total : 0,
      seats: [...rt.seats.values()]
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map((s) => ({
          userId: s.userId,
          username: s.username,
          seat: s.seatIndex,
          bet: s.bet,
          hasBet: s.hasBet,
          activeHand: s.activeHand,
          hands: s.hands.map((h) => ({
            cards: h.cards,
            bet: h.bet,
            status: h.status,
            value: handValue(h.cards).total,
          })),
        })),
    });
  }
}
