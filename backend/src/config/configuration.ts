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
  redis: { host: string; port: number; password?: string; enabled: boolean };
  supabase: { url: string; anonKey: string };
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

const isProd = process.env.NODE_ENV === 'production';

/**
 * Returns the env var, or the dev fallback outside production. In production a
 * missing secret is fatal: we must never sign JWTs with a publicly-known
 * default value (that would let anyone forge a valid session).
 */
const requireInProd = (name: string, devFallback: string): string => {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  return devFallback;
};

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 4000),
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    'http://localhost:5173,https://casino-veloria.vercel.app'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: requireInProd('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: requireInProd('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: toInt(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: toInt(process.env.JWT_REFRESH_TTL, 2592000),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    // When false (the default), BullMQ scheduling is skipped and periodic jobs
    // (loan interest, empty-table cleanup) run via in-process @Cron instead, so
    // they work on a Redis-less host. Set REDIS_ENABLED=true to use BullMQ.
    enabled: process.env.REDIS_ENABLED === 'true',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? 'https://ejozdljwafoydynduboe.supabase.co',
    anonKey:
      process.env.SUPABASE_ANON_KEY ??
      'sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h',
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
