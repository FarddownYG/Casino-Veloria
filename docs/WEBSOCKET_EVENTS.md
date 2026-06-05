# VELORIA — WebSocket Events Map

Transport: **Socket.IO** (NestJS gateways). Auth via `auth.token` (access JWT)
in the connection handshake. Each domain uses a namespace.

```
const socket = io("http://localhost:4000/roulette", { auth: { token } });
```

## Namespaces
| Namespace      | Purpose |
|----------------|---------|
| `/lobby`       | Online presence, hot streaks, table list, casino-earnings ticker |
| `/roulette`    | Shared multiplayer European roulette |
| `/blackjack`   | Player-created blackjack tables |
| `/poker`       | Texas Hold'em tables |
| `/user`        | Per-user: balance sync, notifications, rank-ups |

---

## `/user` (private room `user:<id>`)
Server → client:
- `balance:update` `{ balance, delta, reason }`
- `notification` `{ id, type, title, body, data, createdAt }`
- `rank:up` `{ rank }`
- `transaction` `{ ...Transaction }`

## `/lobby`
Server → client:
- `presence` `{ online: number }`
- `hotstreak` `{ username, amount, gameType }`
- `tables` `{ tables: TableSummary[] }`
- `casino:earnings` `{ totalEarnings, totalWagered, roundsPlayed }`
- `leaderboard:wealth` / `leaderboard:gains` `{ entries }`
Client → server:
- `tables:subscribe` `{ type? }`

## `/roulette`
Client → server:
- `join` `{}` → joins the shared table room
- `bet:place` `{ bets: RouletteBet[] }`  (validated, debited server-side)
- `bet:clear` `{}`  (only during betting window)
- `spin:request` `{}`  (host / auto timer triggers; server is authority)
Server → client:
- `state` `{ phase: 'BETTING'|'SPINNING'|'PAYOUT', timer, players, history }`
- `bet:accepted` `{ bets, totalStake, balance }`
- `bet:rejected` `{ reason }`
- `spin:start` `{ targetNumber, color, spinSeedHash }`  // number known server-side, drives animation
- `spin:result` `{ number, color, round }`
- `payout` `{ winnings, net, balance, winningBets }`
- `history` `{ results: number[] }`

`RouletteBet`:
```ts
{ type: 'STRAIGHT'|'SPLIT'|'STREET'|'CORNER'|'SIXLINE'|'COLUMN'|'DOZEN'
       |'RED'|'BLACK'|'ODD'|'EVEN'|'LOW'|'HIGH',
  numbers: number[], amount: number }
```

## `/blackjack`
Client → server:
- `table:join` `{ tableId, buyIn }`
- `table:leave` `{ tableId }`
- `bet` `{ tableId, amount }`           // during betting phase
- `action` `{ tableId, move: 'HIT'|'STAND'|'DOUBLE'|'SPLIT' }`
Server → client:
- `table:state` `{ table, seats, dealer, phase, activeSeat, timer }`
- `table:joined` / `table:left`
- `deal` `{ hands, dealerUp }`
- `turn` `{ seat, timer }`
- `result` `{ outcomes: {seat, result, payout}[], dealer }`
- `error` `{ reason }`

## `/poker` (Texas Hold'em)
Client → server:
- `table:join` `{ tableId, buyIn }`
- `table:leave` `{ tableId }`
- `action` `{ tableId, move: 'FOLD'|'CHECK'|'CALL'|'RAISE'|'ALLIN', amount? }`
- `chat` `{ tableId, message }`
- `reaction` `{ tableId, emoji }`
Server → client:
- `table:state` `{ table, seats, board, pot, blinds, activeSeat, phase }`
- `hole:cards` `{ cards }`               // private to each player
- `action:applied` `{ seat, move, amount, pot }`
- `street` `{ phase: 'FLOP'|'TURN'|'RIVER', board }`
- `showdown` `{ hands, winners, pot }`
- `chat` `{ username, message, ts }`
- `reaction` `{ username, emoji }`
- `error` `{ reason }`

---

## Conventions
- All balance-affecting events are **server-authoritative**: the client never
  sends a balance; it sends an intent (bet/action) and the server validates,
  mutates the balance, writes a `Transaction`, and emits `balance:update` on
  `/user`.
- Disconnect during a hand → auto-stand (blackjack) / auto-fold (poker).
- Table inactivity (empty 3 min) → table closed by a BullMQ job; clients in the
  lobby receive an updated `tables` list.
