export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  redis: { host: string; port: number; password?: string };
  economy: {
    signupBonus: number;
    referralRewardReferrer: number;
    referralRewardReferred: number;
    dailyStreakBonus: number;
    giftDailyLimit: number;
    bankLoanThreshold: number;
    bankLoanGraceDays: number;
    bankLoanDailyInterest: number;
  };
}

const toInt = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toFloat = (v: string | undefined, fallback: number): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: toInt(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: toInt(process.env.JWT_REFRESH_TTL, 2592000),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  economy: {
    signupBonus: toInt(process.env.SIGNUP_BONUS, 1000),
    referralRewardReferrer: toInt(process.env.REFERRAL_REWARD_REFERRER, 100),
    referralRewardReferred: toInt(process.env.REFERRAL_REWARD_REFERRED, 200),
    dailyStreakBonus: toInt(process.env.DAILY_STREAK_BONUS, 50),
    giftDailyLimit: toInt(process.env.GIFT_DAILY_LIMIT, 5000),
    bankLoanThreshold: toInt(process.env.BANK_LOAN_THRESHOLD, 200),
    bankLoanGraceDays: toInt(process.env.BANK_LOAN_GRACE_DAYS, 7),
    bankLoanDailyInterest: toFloat(process.env.BANK_LOAN_DAILY_INTEREST, 0.1),
  },
});
