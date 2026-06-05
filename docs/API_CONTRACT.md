# VELORIA — REST API Contract

Base URL: `http://localhost:4000/api`
Auth: `Authorization: Bearer <accessToken>` on protected routes.
All money values are integers (VELORIA COINS, "VC").

> Validation: every body is validated with `class-validator`. Errors return
> `400` with `{ statusCode, message: string[], error }`.

## Auth — `/auth`

| Method | Path             | Body                                              | Returns |
|--------|------------------|---------------------------------------------------|---------|
| POST   | `/register`      | `{ email, username, password, referralCode? }`    | `{ user, accessToken, refreshToken }` |
| POST   | `/login`         | `{ emailOrUsername, password }`                   | `{ user, accessToken, refreshToken }` |
| POST   | `/google`        | `{ accessToken, referralCode? }`                  | `{ user, accessToken, refreshToken }` |
| POST   | `/refresh`       | `{ refreshToken }`                                | `{ accessToken, refreshToken }` |
| POST   | `/logout`        | `{ refreshToken }`                                | `{ success }` |
| GET    | `/me`            | —                                                 | `User` (private view) |

`register` applies the signup bonus (1000 VC) and, if a valid `referralCode`
is supplied, locks the referral irreversibly and credits both parties.

`/google` takes a **Supabase** access token (from the client-side Google OAuth
flow), verifies it server-side, then finds-or-creates the VELORIA user (signup
bonus + optional referral for new accounts) and returns VELORIA JWTs. See
`SUPABASE_GOOGLE_AUTH.md`.

## Users — `/users`

| Method | Path                       | Notes |
|--------|----------------------------|-------|
| GET    | `/me`                      | Private profile (balance, aggregates, streak, settings) |
| PATCH  | `/me/settings`             | `{ soundEnabled?, marketingConsent? }` |
| GET    | `/:username`               | Public profile (username, balance, rank, history) |
| GET    | `/:username/history`       | Paginated game/transaction history |
| POST   | `/me/age-verification`     | Records server-side age confirmation |
| DELETE | `/me`                      | RGPD right to erasure (anonymise + soft delete) |
| GET    | `/me/streak`               | Daily-streak status; claims bonus if eligible |

## Loans — `/loans`

### Bank
| Method | Path                  | Body                  | Notes |
|--------|-----------------------|-----------------------|-------|
| GET    | `/bank`               | —                     | Active bank loan + eligibility (`balance < 200`, no active loan) |
| POST   | `/bank`               | `{ amount: 500\|1000\|2500 }` | Disburse loan, due in 7 days |
| POST   | `/bank/:id/repay`     | `{ amount? }`         | Partial/full repayment |

### P2P
| Method | Path                       | Body                                            |
|--------|----------------------------|-------------------------------------------------|
| GET    | `/p2p`                     | — (incoming + outgoing) |
| POST   | `/p2p`                     | `{ borrowerUsername, amount, interestRate, durationDays, penaltyRate? }` |
| POST   | `/p2p/:id/accept`          | — (borrower accepts; funds transfer) |
| POST   | `/p2p/:id/negotiate`       | `{ amount?, interestRate?, durationDays? }` |
| POST   | `/p2p/:id/reject`          | — |
| POST   | `/p2p/:id/cancel`          | — (lender cancels a pending offer) |
| POST   | `/p2p/:id/repay`           | `{ amount? }` |

### Gifts
| Method | Path        | Body                                        | Notes |
|--------|-------------|---------------------------------------------|-------|
| POST   | `/gifts`    | `{ recipientUsername, amount, message? }`   | Max 5000 VC/day per sender |
| GET    | `/gifts`    | —                                           | Sent + received history |

## Referral — `/referral`
| Method | Path          | Notes |
|--------|---------------|-------|
| GET    | `/me`         | `{ code, referralLink, count, totalEarned, referrals[] }` |

## Leaderboard — `/leaderboard`
| Method | Path          | Query             | Notes |
|--------|---------------|-------------------|-------|
| GET    | `/wealth`     | `?limit=50`       | Top by current balance |
| GET    | `/gains`      | `?limit=50`       | Top by lifetime net gains |
| GET    | `/casino`     | —                 | House earnings (live) |

## Games — `/games`
| Method | Path                         | Notes |
|--------|------------------------------|-------|
| GET    | `/roulette/history`          | Last 20 results |
| GET    | `/tables?type=BLACKJACK`     | Lobby list |
| POST   | `/tables`                    | `{ type, name, minBet, maxBet, maxSeats }` create table |
| GET    | `/tables/:id`                | Table detail |

> Live gameplay (placing bets, hits, folds, spins) happens over WebSocket —
> see `WEBSOCKET_EVENTS.md`. REST is used for lobby/history/state bootstrap.

## Notifications — `/notifications`
| Method | Path              | Notes |
|--------|-------------------|-------|
| GET    | `/`               | Paginated, newest first |
| POST   | `/:id/read`       | Mark read |
| POST   | `/read-all`       | Mark all read |

## Health
| Method | Path          |
|--------|---------------|
| GET    | `/health`     |

### User (private view) shape
```ts
{
  id, email, username, role, balance,
  totalWagered, totalWon, totalLost, netGains, rank,
  referralCode, loginStreak, soundEnabled,
  ageVerifiedAt, createdAt
}
```
### User (public view) shape
```ts
{ id, username, balance, rank, netGains, createdAt }
```
