import {
  BankLoanStatus,
  GameType,
  PrismaClient,
  Rank,
  TransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  username: string;
  balance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  rank: Rank;
  referralCode: string;
  referredByCode?: string;
  loginStreak: number;
}

const USERS: SeedUser[] = [
  {
    email: 'vip@veloria.fake',
    username: 'veloria_vip',
    balance: 184_500,
    totalWagered: 920_000,
    totalWon: 410_000,
    totalLost: 225_500,
    rank: Rank.DIAMOND,
    referralCode: 'VIPKING1',
    loginStreak: 23,
  },
  {
    email: 'luc@veloria.fake',
    username: 'luckyluc',
    balance: 42_300,
    totalWagered: 180_000,
    totalWon: 95_000,
    totalLost: 55_000,
    rank: Rank.GOLD,
    referralCode: 'LUCKY777',
    referredByCode: 'VIPKING1',
    loginStreak: 9,
  },
  {
    email: 'john@veloria.fake',
    username: 'johndoe',
    balance: 7_850,
    totalWagered: 60_000,
    totalWon: 28_000,
    totalLost: 22_000,
    rank: Rank.SILVER,
    referralCode: 'JOHND123',
    loginStreak: 3,
  },
  {
    email: 'marie@veloria.fake',
    username: 'mariecasino',
    balance: 21_000,
    totalWagered: 75_000,
    totalWon: 40_000,
    totalLost: 24_000,
    rank: Rank.SILVER,
    referralCode: 'MARIE456',
    referredByCode: 'LUCKY777',
    loginStreak: 14,
  },
  {
    email: 'newbie@veloria.fake',
    username: 'newbie',
    balance: 120,
    totalWagered: 2_400,
    totalWon: 500,
    totalLost: 1_800,
    rank: Rank.BRONZE,
    referralCode: 'NEWB0001',
    loginStreak: 1,
  },
];

async function reset(): Promise<void> {
  // Order matters for FKs.
  await prisma.bet.deleteMany();
  await prisma.gameRound.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.gameTable.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.gift.deleteMany();
  await prisma.p2PLoan.deleteMany();
  await prisma.bankLoan.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.user.deleteMany();
  await prisma.casinoStat.deleteMany();
}

async function main(): Promise<void> {
  console.log('🌱 Seeding VELORIA...');
  await reset();

  const passwordHash = await bcrypt.hash('password123', 10);
  const idByCode = new Map<string, string>();

  // First pass: create users without referrer links.
  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        username: u.username,
        passwordHash,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
        netGains: u.totalWon - u.totalLost,
        rank: u.rank,
        referralCode: u.referralCode,
        loginStreak: u.loginStreak,
        ageVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
    idByCode.set(u.referralCode, user.id);

    // Signup bonus ledger row.
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: TransactionType.SIGNUP_BONUS,
        amount: 1000,
        balanceAfter: 1000,
        description: 'Bonus de bienvenue',
      },
    });
  }

  // Second pass: wire referrals + rewards.
  for (const u of USERS) {
    if (!u.referredByCode) continue;
    const referredId = idByCode.get(u.referralCode)!;
    const referrerId = idByCode.get(u.referredByCode)!;
    await prisma.user.update({
      where: { id: referredId },
      data: { referredById: referrerId, referralLocked: true },
    });
    await prisma.referral.create({
      data: {
        referrerId,
        referredId,
        codeUsed: u.referredByCode,
        rewardReferrer: 100,
        rewardReferred: 200,
        locked: true,
      },
    });
  }

  // A demo bank loan for newbie (eligible: balance < 200).
  const newbieId = idByCode.get('NEWB0001')!;
  const due = new Date(Date.now() + 5 * 86_400_000);
  const loan = await prisma.bankLoan.create({
    data: {
      userId: newbieId,
      principal: 500,
      amountDue: 500,
      dueDate: due,
      status: BankLoanStatus.ACTIVE,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: newbieId,
      type: TransactionType.BANK_LOAN_DISBURSEMENT,
      amount: 500,
      balanceAfter: 620,
      refId: loan.id,
      description: 'Prêt banque de 500 VC',
    },
  });
  await prisma.notification.create({
    data: {
      userId: newbieId,
      type: 'LOAN_RECEIVED',
      title: 'Prêt accordé : +500 VC 🏦',
      body: `À rembourser avant le ${due.toLocaleDateString('fr-FR')}.`,
    },
  });

  // A P2P gift from vip to newbie.
  const vipId = idByCode.get('VIPKING1')!;
  await prisma.gift.create({
    data: { senderId: vipId, recipientId: newbieId, amount: 250, message: 'Bienvenue !' },
  });

  // The shared roulette table + a handful of historical rounds.
  const rouletteTable = await prisma.gameTable.create({
    data: {
      id: 'roulette-main',
      type: GameType.ROULETTE,
      name: 'Roulette Européenne',
      isPersistent: true,
      minBet: 1,
      maxBet: 100_000,
      maxSeats: 9999,
    },
  });
  const numbers = [17, 0, 32, 5, 26, 12, 3, 19, 8, 0, 21, 34, 14, 2, 25];
  const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    await prisma.gameRound.create({
      data: {
        gameType: GameType.ROULETTE,
        tableId: rouletteTable.id,
        serverSeed: `seed-${i}`,
        serverSeedHash: `hash-${i}`,
        clientSeed: 'roulette',
        nonce: i,
        result: { number: n, color: n === 0 ? 'green' : reds.has(n) ? 'red' : 'black' },
        createdAt: new Date(Date.now() - (numbers.length - i) * 60_000),
      },
    });
  }

  // Casino house ledger.
  await prisma.casinoStat.create({
    data: {
      id: 'global',
      totalEarnings: 127_500,
      totalWagered: 1_237_400,
      totalPaidOut: 1_109_900,
      roundsPlayed: 4_812,
    },
  });

  console.log('✅ Seed complete.');
  console.log('   Login with any user, e.g. veloria_vip / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
