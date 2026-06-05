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
import { Card, compareHands, createDeck, evaluateBest, shuffle } from './engine';
import { PokerService } from './poker.service';

const TURN_MS = 30_000;
const SHOWDOWN_MS = 7_000;

type Phase = 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

interface PokerSeat {
  userId: string;
  username: string;
  seatIndex: number;
  stack: number;
  buyInTotal: number;
  hole: Card[];
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  totalBet: number;
  hasActed: boolean;
}

interface Runtime {
  id: string;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
  seats: Map<string, PokerSeat>;
  buttonSeat: number;
  deck: Card[];
  board: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  phase: Phase;
  activeUserId?: string;
  handId?: string;
  timer?: NodeJS.Timeout;
  phaseEndsAt: number;
}

@WebSocketGateway({ namespace: '/poker', cors: { origin: true, credentials: true } })
export class PokerGateway implements OnGatewayConnection {
  private readonly logger = new Logger(PokerGateway.name);
  private readonly rng = cryptoRng();
  private readonly tables = new Map<string, Runtime>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly poker: PokerService,
  ) {}

  handleConnection(client: Socket): void {
    const user = authenticateSocket(client, this.tokens);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
  }

  private room(id: string): string {
    return `pk:${id}`;
  }

  private async runtime(tableId: string): Promise<Runtime> {
    let rt = this.tables.get(tableId);
    if (!rt) {
      const table = await this.poker.getTable(tableId);
      const sb = (table.config as { smallBlind?: number })?.smallBlind ?? Math.max(1, Math.floor(table.minBet / 2));
      rt = {
        id: tableId,
        smallBlind: sb,
        bigBlind: sb * 2,
        maxSeats: table.maxSeats,
        seats: new Map(),
        buttonSeat: -1,
        deck: [],
        board: [],
        pot: 0,
        currentBet: 0,
        minRaise: sb * 2,
        phase: 'WAITING',
        phaseEndsAt: 0,
      };
      this.tables.set(tableId, rt);
    }
    return rt;
  }

  private orderedSeats(rt: Runtime): PokerSeat[] {
    return [...rt.seats.values()].sort((a, b) => a.seatIndex - b.seatIndex);
  }

  // --- membership ---

  @SubscribeMessage('table:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; buyIn: number },
  ): Promise<void> {
    const user = client.data.user as WsUser;
    try {
      const { seat, stack } = await this.poker.buyIn(body.tableId, user.userId, body.buyIn);
      const rt = await this.runtime(body.tableId);
      client.join(this.room(body.tableId));
      client.data.tableId = body.tableId;
      if (!rt.seats.has(user.userId)) {
        rt.seats.set(user.userId, {
          userId: user.userId,
          username: user.username,
          seatIndex: seat,
          stack,
          buyInTotal: body.buyIn,
          hole: [],
          inHand: false,
          folded: false,
          allIn: false,
          streetBet: 0,
          totalBet: 0,
          hasActed: false,
        });
      }
      client.emit('table:joined', { tableId: body.tableId, seat, stack });
      this.broadcastState(rt);
      if (rt.phase === 'WAITING' && this.eligibleCount(rt) >= 2) this.startHand(rt);
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
    const seat = rt?.seats.get(user.userId);
    if (seat) {
      // Fold any live hand, then cash out the remaining stack.
      if (seat.inHand && !seat.folded) {
        seat.folded = true;
        seat.inHand = false;
      }
      await this.poker.cashOut(body.tableId, user.userId, seat.stack, seat.buyInTotal);
      rt!.seats.delete(user.userId);
    } else {
      await this.poker.cashOut(body.tableId, user.userId, 0, 0);
    }
    client.leave(this.room(body.tableId));
    client.emit('table:left', { tableId: body.tableId });
    if (rt) {
      if (rt.activeUserId === user.userId) this.advanceAction(rt, seat?.seatIndex ?? -1);
      this.broadcastState(rt);
    }
  }

  // --- hand flow ---

  private eligibleCount(rt: Runtime): number {
    return [...rt.seats.values()].filter((s) => s.stack > 0).length;
  }

  private startHand(rt: Runtime): void {
    const players = this.orderedSeats(rt).filter((s) => s.stack > 0);
    if (players.length < 2) {
      rt.phase = 'WAITING';
      this.broadcastState(rt);
      return;
    }
    rt.handId = randomUUID();
    rt.deck = shuffle(createDeck(), this.rng);
    rt.board = [];
    rt.pot = 0;
    rt.currentBet = 0;
    rt.minRaise = rt.bigBlind;

    for (const s of players) {
      s.hole = [rt.deck.pop()!, rt.deck.pop()!];
      s.inHand = true;
      s.folded = false;
      s.allIn = false;
      s.streetBet = 0;
      s.totalBet = 0;
      s.hasActed = false;
    }

    // Advance button.
    const seatIndices = players.map((s) => s.seatIndex);
    const nextButton = seatIndices.find((i) => i > rt.buttonSeat) ?? seatIndices[0];
    rt.buttonSeat = nextButton;

    // Blinds (heads-up: button is small blind).
    const sbSeat = this.seatAfter(rt, players, rt.buttonSeat, players.length === 2 ? 0 : 1);
    const bbSeat = this.seatAfter(rt, players, sbSeat.seatIndex, 1);
    this.postBlind(rt, sbSeat, rt.smallBlind);
    this.postBlind(rt, bbSeat, rt.bigBlind);
    rt.currentBet = rt.bigBlind;

    rt.phase = 'PREFLOP';

    // Send private hole cards.
    for (const s of players) {
      this.emitHole(rt, s);
    }

    const firstToAct = this.seatAfter(rt, players, bbSeat.seatIndex, 1);
    this.setActive(rt, firstToAct);
    this.broadcastState(rt);
  }

  private seatAfter(rt: Runtime, players: PokerSeat[], fromSeat: number, steps: number): PokerSeat {
    const ordered = players;
    let idx = ordered.findIndex((s) => s.seatIndex === fromSeat);
    if (idx < 0) idx = 0;
    let s = ordered[idx];
    for (let i = 0; i < steps; i++) {
      idx = (idx + 1) % ordered.length;
      s = ordered[idx];
    }
    return s;
  }

  private postBlind(rt: Runtime, seat: PokerSeat, amount: number): void {
    const put = Math.min(amount, seat.stack);
    seat.stack -= put;
    seat.streetBet = put;
    seat.totalBet += put;
    rt.pot += put;
    if (seat.stack === 0) seat.allIn = true;
    void this.poker.syncStack(rt.id, seat.userId, seat.stack);
  }

  private setActive(rt: Runtime, seat: PokerSeat): void {
    rt.activeUserId = seat.userId;
    rt.phaseEndsAt = Date.now() + TURN_MS;
    this.clearTimer(rt);
    rt.timer = setTimeout(() => {
      // Timeout: check if possible else fold.
      const s = rt.seats.get(rt.activeUserId ?? '');
      if (s) this.handleAction(rt, s, s.streetBet === rt.currentBet ? 'CHECK' : 'FOLD');
    }, TURN_MS);
    this.server.to(this.room(rt.id)).emit('turn', { userId: seat.userId, seat: seat.seatIndex, timer: TURN_MS });
  }

  @SubscribeMessage('action')
  onAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; move: string; amount?: number },
  ): void {
    const user = client.data.user as WsUser;
    const rt = this.tables.get(body.tableId);
    if (!rt || rt.activeUserId !== user.userId) {
      client.emit('error', { reason: 'Not your turn' });
      return;
    }
    const seat = rt.seats.get(user.userId);
    if (!seat) return;
    this.handleAction(rt, seat, body.move, body.amount);
  }

  private handleAction(rt: Runtime, seat: PokerSeat, move: string, amount?: number): void {
    if (!seat.inHand || seat.folded || seat.allIn) return;
    this.clearTimer(rt);
    const toCall = rt.currentBet - seat.streetBet;

    switch (move) {
      case 'FOLD':
        seat.folded = true;
        seat.inHand = false;
        break;
      case 'CHECK':
        if (toCall > 0) return this.setActive(rt, seat); // illegal, re-prompt
        break;
      case 'CALL': {
        const put = Math.min(toCall, seat.stack);
        this.commit(rt, seat, put);
        break;
      }
      case 'RAISE': {
        const target = amount ?? rt.currentBet + rt.minRaise;
        const put = Math.min(target - seat.streetBet, seat.stack);
        if (put <= toCall) return this.setActive(rt, seat); // not a valid raise
        this.commit(rt, seat, put);
        if (seat.streetBet > rt.currentBet) {
          rt.minRaise = seat.streetBet - rt.currentBet;
          rt.currentBet = seat.streetBet;
          this.reopenAction(rt, seat);
        }
        break;
      }
      case 'ALLIN': {
        this.commit(rt, seat, seat.stack);
        if (seat.streetBet > rt.currentBet) {
          rt.minRaise = Math.max(rt.minRaise, seat.streetBet - rt.currentBet);
          rt.currentBet = seat.streetBet;
          this.reopenAction(rt, seat);
        }
        break;
      }
      default:
        return this.setActive(rt, seat);
    }

    seat.hasActed = true;
    this.server.to(this.room(rt.id)).emit('action:applied', {
      seat: seat.seatIndex,
      userId: seat.userId,
      move,
      amount,
      pot: rt.pot,
      stack: seat.stack,
    });
    this.broadcastState(rt);
    this.progress(rt);
  }

  private commit(rt: Runtime, seat: PokerSeat, amount: number): void {
    const put = Math.max(0, Math.min(amount, seat.stack));
    seat.stack -= put;
    seat.streetBet += put;
    seat.totalBet += put;
    rt.pot += put;
    if (seat.stack === 0) seat.allIn = true;
    void this.poker.syncStack(rt.id, seat.userId, seat.stack);
  }

  private reopenAction(rt: Runtime, raiser: PokerSeat): void {
    for (const s of rt.seats.values()) {
      if (s.inHand && !s.folded && !s.allIn && s.userId !== raiser.userId) s.hasActed = false;
    }
  }

  private liveSeats(rt: Runtime): PokerSeat[] {
    return this.orderedSeats(rt).filter((s) => s.inHand && !s.folded);
  }

  private progress(rt: Runtime): void {
    const live = this.liveSeats(rt);
    if (live.length <= 1) {
      this.endHand(rt, live);
      return;
    }
    const canAct = live.filter((s) => !s.allIn);
    const roundDone = canAct.every((s) => s.hasActed && s.streetBet === rt.currentBet);
    if (roundDone) {
      this.nextStreet(rt);
      return;
    }
    // Find next actor after the current one.
    this.advanceAction(rt, rt.seats.get(rt.activeUserId ?? '')?.seatIndex ?? -1);
  }

  private advanceAction(rt: Runtime, fromSeat: number): void {
    const live = this.liveSeats(rt).filter((s) => !s.allIn);
    if (live.length === 0) return;
    const ordered = this.orderedSeats(rt);
    const start = ordered.findIndex((s) => s.seatIndex === fromSeat);
    for (let i = 1; i <= ordered.length; i++) {
      const s = ordered[(start + i) % ordered.length];
      if (s.inHand && !s.folded && !s.allIn && (!s.hasActed || s.streetBet < rt.currentBet)) {
        this.setActive(rt, s);
        return;
      }
    }
    // No one left to act → round complete.
    this.nextStreet(rt);
  }

  private nextStreet(rt: Runtime): void {
    this.clearTimer(rt);
    for (const s of rt.seats.values()) {
      s.streetBet = 0;
      s.hasActed = false;
    }
    rt.currentBet = 0;
    rt.minRaise = rt.bigBlind;

    if (rt.phase === 'PREFLOP') {
      rt.board.push(rt.deck.pop()!, rt.deck.pop()!, rt.deck.pop()!);
      rt.phase = 'FLOP';
    } else if (rt.phase === 'FLOP') {
      rt.board.push(rt.deck.pop()!);
      rt.phase = 'TURN';
    } else if (rt.phase === 'TURN') {
      rt.board.push(rt.deck.pop()!);
      rt.phase = 'RIVER';
    } else {
      this.endHand(rt, this.liveSeats(rt));
      return;
    }

    this.server.to(this.room(rt.id)).emit('street', { phase: rt.phase, board: rt.board });

    // If only one player can still act, run it out to showdown.
    const canAct = this.liveSeats(rt).filter((s) => !s.allIn);
    if (canAct.length <= 1 && this.liveSeats(rt).length > 1) {
      this.broadcastState(rt);
      setTimeout(() => this.nextStreet(rt), 1200);
      return;
    }

    const first = this.firstToActPostflop(rt);
    if (first) this.setActive(rt, first);
    this.broadcastState(rt);
  }

  private firstToActPostflop(rt: Runtime): PokerSeat | undefined {
    const ordered = this.orderedSeats(rt);
    const start = ordered.findIndex((s) => s.seatIndex === rt.buttonSeat);
    for (let i = 1; i <= ordered.length; i++) {
      const s = ordered[(start + i) % ordered.length];
      if (s.inHand && !s.folded && !s.allIn) return s;
    }
    return undefined;
  }

  private endHand(rt: Runtime, live: PokerSeat[]): void {
    this.clearTimer(rt);
    rt.phase = 'SHOWDOWN';
    rt.activeUserId = undefined;

    let winners: PokerSeat[] = [];
    let revealed: { userId: string; hole: Card[]; hand: string }[] = [];

    if (live.length === 1) {
      winners = live;
    } else {
      // Showdown: best 5 of 7 (single main pot — side pots simplified).
      let best = null as ReturnType<typeof evaluateBest> | null;
      for (const s of live) {
        const rank = evaluateBest([...s.hole, ...rt.board]);
        revealed.push({ userId: s.userId, hole: s.hole, hand: rank.name });
        if (!best || compareHands(rank, best) > 0) {
          best = rank;
          winners = [s];
        } else if (best && compareHands(rank, best) === 0) {
          winners.push(s);
        }
      }
    }

    const share = Math.floor(rt.pot / winners.length);
    let remainder = rt.pot - share * winners.length;
    for (const w of winners) {
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      w.stack += amt;
      void this.poker.syncStack(rt.id, w.userId, w.stack);
    }

    this.server.to(this.room(rt.id)).emit('showdown', {
      board: rt.board,
      pot: rt.pot,
      winners: winners.map((w) => ({ userId: w.userId, username: w.username })),
      revealed,
    });

    rt.pot = 0;
    rt.phaseEndsAt = Date.now() + SHOWDOWN_MS;
    this.broadcastState(rt);

    rt.timer = setTimeout(() => {
      // Drop busted players, deal next hand.
      for (const s of [...rt.seats.values()]) {
        s.inHand = false;
        s.hole = [];
      }
      if (this.eligibleCount(rt) >= 2) this.startHand(rt);
      else {
        rt.phase = 'WAITING';
        this.broadcastState(rt);
      }
    }, SHOWDOWN_MS);
  }

  // --- chat / reactions ---

  @SubscribeMessage('chat')
  onChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; message: string },
  ): void {
    const user = client.data.user as WsUser;
    if (!body.message || body.message.length > 200) return;
    this.server.to(this.room(body.tableId)).emit('chat', {
      username: user.username,
      message: body.message,
      ts: Date.now(),
    });
  }

  @SubscribeMessage('reaction')
  onReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId: string; emoji: string },
  ): void {
    const user = client.data.user as WsUser;
    this.server.to(this.room(body.tableId)).emit('reaction', {
      username: user.username,
      emoji: body.emoji,
    });
  }

  // --- emit ---

  private emitHole(rt: Runtime, seat: PokerSeat): void {
    for (const [, socket] of this.server.sockets.sockets) {
      if (socket.data?.user?.userId === seat.userId && socket.data?.tableId === rt.id) {
        socket.emit('hole:cards', { cards: seat.hole });
      }
    }
  }

  private clearTimer(rt: Runtime): void {
    if (rt.timer) {
      clearTimeout(rt.timer);
      rt.timer = undefined;
    }
  }

  private broadcastState(rt: Runtime): void {
    this.server.to(this.room(rt.id)).emit('table:state', {
      tableId: rt.id,
      phase: rt.phase,
      board: rt.board,
      pot: rt.pot,
      currentBet: rt.currentBet,
      buttonSeat: rt.buttonSeat,
      activeUserId: rt.activeUserId,
      timer: Math.max(0, rt.phaseEndsAt - Date.now()),
      blinds: { small: rt.smallBlind, big: rt.bigBlind },
      seats: this.orderedSeats(rt).map((s) => ({
        userId: s.userId,
        username: s.username,
        seat: s.seatIndex,
        stack: s.stack,
        streetBet: s.streetBet,
        inHand: s.inHand,
        folded: s.folded,
        allIn: s.allIn,
        hasCards: s.hole.length > 0 && !s.folded,
      })),
    });
  }
}
