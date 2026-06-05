# 🎰 VELORIA — Fake-Money Casino Platform

> **VELORIA est un jeu de divertissement utilisant exclusivement de la monnaie
> virtuelle. Aucune valeur réelle. Jouer ne constitue pas du jeu d'argent au sens
> légal. VELORIA ne saurait être tenu responsable d'une assimilation à des
> pratiques de jeu réel.**

A complete multiplayer **fake-money** casino: roulette, blackjack and poker, with
a server-authoritative economy (loans, P2P lending, gifts, referrals), live
leaderboards (including *casino earnings*), and a dopamine-driven UI inspired by
Stake / Winamax / PokerStars. **No real money is ever involved.**

---

## 🧱 Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 · TypeScript · Vite · Tailwind · TanStack Query · socket.io-client · Zustand · framer-motion |
| Backend   | NestJS · PostgreSQL (Prisma) · Redis · BullMQ · Socket.IO · Passport-JWT · class-validator |
| Realtime  | Socket.IO gateways (`/user`, `/lobby`, `/roulette`, `/blackjack`, `/poker`) |
| Deploy    | Supabase (Postgres) + Vercel (frontend) ready |

## 📂 Monorepo layout

```
.
├── backend/                 NestJS server (server-authoritative)
│   ├── prisma/schema.prisma Complete data model
│   ├── prisma/seed.ts       5 demo users + history
│   └── src/
│       ├── auth/            JWT register/login/refresh (+ signup bonus, referral)
│       ├── users/           Profiles, settings, RGPD erasure, login streak
│       ├── economy/         BalanceService (single ledger chokepoint) + CasinoStat
│       ├── loans/           Bank loans, P2P loans (negotiable), gifts + BullMQ interest job
│       ├── referral/        Referral dashboard
│       ├── leaderboard/     Redis-cached rankings + LobbyGateway (presence, ticker)
│       ├── notifications/   In-app notifications + /user gateway (balance sync)
│       ├── games/
│       │   ├── roulette/    Full engine + gateway (multiplayer + "real table" mode)
│       │   ├── blackjack/   Engine + table gateway (Hit/Stand/Double/Split)
│       │   ├── poker/       Texas Hold'em engine + table gateway (chat/emoji)
│       │   └── tables/      Player-created tables + 3-min empty cleanup (BullMQ)
│       └── common/          Prisma, Redis, JWT, provably-fair RNG, events
├── frontend/                React app (pages + dopamine design system)
└── docs/                    API_CONTRACT.md · WEBSOCKET_EVENTS.md
```

---

## 🚀 Getting started

### Prerequisites
PostgreSQL + Redis running locally (or via Supabase/managed Redis).

### 1. Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL, REDIS_*, JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates the schema
npm run seed                  # 5 demo users + history
npm run dev                   # http://localhost:4000/api
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

### Demo login
After seeding: **`veloria_vip`** / `password123` (or `luckyluc`, `johndoe`,
`mariecasino`, `newbie`).

---

## ✅ Feature checklist (from the brief)

### Legal & onboarding (priorité absolue)
- ✅ Full-screen, non-bypassable **age gate** ("18 ans ou plus ?" → NON redirects to
  google.com, OUI sets a 30-day cookie).
- ✅ Permanent **disclaimer banner** with the exact required wording.
- ✅ **RGPD**: cookie consent (categories), privacy policy page, account deletion
  (right to erasure / anonymisation), data minimisation (email + username + hash).

### Auth & accounts
- ✅ Register/login (email + username + bcrypt password), JWT + refresh rotation.
- ✅ **1000 VC** signup bonus (recorded in the immutable ledger).
- ✅ Public profile (username, balance, rank, history) + private profile.

### Internal economy
- ✅ **Bank loan**: button when balance < 200 VC, amounts 500/1000/2500, 7-day grace,
  +10%/day interest after, max 1 active, **BullMQ daily interest job**, J-2/J-1/J+0
  reminders.
- ✅ **P2P loans**: propose (amount/rate/duration) → accept / **negotiate** / reject,
  mutual agreement enforced, atomic transfer, auto-due tracking, history.
- ✅ **Direct gifts**: instant, no interest, **5000 VC/day** sender cap.

### Referral
- ✅ Unique code per user, applied **only at register**, **irreversible** (locked in DB),
  +200 VC referred / +100 VC referrer, dashboard with filleuls & earnings.

### Leaderboards (live via WebSocket)
- ✅ Top Richesse · Top Gains · **Casino Earnings** (sum of net player losses, live).

### Games
- ✅ **Roulette**: European (0–36), all bet types, animated wheel, **multiplayer shared
  table**, 20-result history, **"Mode Table Réelle"** full-screen with configurable
  spin timer (15/30/60s) for IRL projection.
- ✅ **Blackjack**: player-created tables (2–6), min/max bet, Vegas rules (dealer S17),
  Hit/Stand/Double/Split, 30s turn timer, **server-side dealer (anti-cheat)**,
  **3-min empty-table auto-removal (BullMQ)**.
- ✅ **Poker (Texas Hold'em)**: tables (2–9), configurable blinds, fold/call/raise/all-in,
  server-side pot, table chat + emoji reactions, same empty-table cleanup.

### UI/UX — dopamine design system
- ✅ Dark theme (#0d0f14 + gold/neon-green), win confetti + flash + synth SFX, loss
  shake, **animated balance counter**, Bronze/Silver/Gold/Diamond badges, **login
  streak bonus (+50 VC from day 7)**, toasts, live lobby ("N joueurs en ligne",
  hot streaks "🔥 …"), sound toggle.

---

## 🔒 Anti-cheat / quality
- **All gain/loss logic is server-side.** Balances are never trusted from the client.
- Every balance mutation goes through `BalanceService` and writes an **immutable
  `Transaction`** row (append-only ledger) inside a DB transaction.
- Provably-fair RNG for roulette (committed `serverSeedHash`, revealable `serverSeed`).
- `class-validator` on every input, JWT guards, `@nestjs/throttler` rate-limiting on
  sensitive endpoints (auth, loans).
- Unit tests on the game engines (RNG / payouts / hand evaluation) — **108 tests**.

```bash
cd backend && npm test     # roulette + blackjack + poker engine specs
```

## 📡 Deliverables
1. **Prisma schema** → `backend/prisma/schema.prisma`
2. **NestJS modules** → `backend/src/*`
3. **Games (roulette first)** → `backend/src/games/*`
4. **Frontend pages** → `frontend/src/pages/*`
5. **WebSocket events map** → `docs/WEBSOCKET_EVENTS.md`
6. **Seed data** → `backend/prisma/seed.ts`

## ⚠️ Known simplifications
- Poker uses a **single main pot** (multi-way all-in side-pots are not split); fine for
  a fake-money MVP, flagged for a future iteration.
- BullMQ jobs (loan interest, table cleanup) require Redis; without it the API still
  runs (jobs are skipped with a warning).

---

_Made for entertainment only. Virtual currency, zero real-world value._
