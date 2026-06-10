import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokenService } from '../common/token/token.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, SupabaseLoginDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;

interface EconomyTuning {
  signupBonus: number;
  referralRewardReferrer: number;
  referralRewardReferred: number;
}

interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  private econ(): EconomyTuning {
    return this.config.get('economy') as EconomyTuning;
  }

  private async generateReferralCode(): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = randomBytes(8)
        .toString('base64')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase()
        .slice(0, 8);
      if (code.length < 6) continue;
      const exists = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('Could not allocate referral code, retry');
  }

  /** Derives a unique, sanitised username from a display name or email. */
  private async generateUniqueUsername(base: string): Promise<string> {
    let slug = (base || 'player')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);
    if (slug.length < 3) slug = `player${Math.floor(1000 + Math.random() * 9000)}`;

    let candidate = slug;
    for (let i = 1; i <= 50; i++) {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      const suffix = String(i);
      candidate = slug.slice(0, 20 - suffix.length) + suffix;
    }
    return `player${Date.now().toString().slice(-7)}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(user: { id: string; username: string; role: string }) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.tokens.signAccess(payload);
    const refreshToken = this.tokens.signRefresh(payload);

    const ttl = (this.config.get('jwt') as { refreshTtl: number }).refreshTtl;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async resolveReferrer(code?: string) {
    if (!code) return null;
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { id: true, username: true },
    });
    if (!referrer) throw new BadRequestException('Invalid referral code');
    return referrer;
  }

  /** Credits the welcome bonus through the ledger. */
  private async grantSignupBonus(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const econ = this.econ();
    await this.balance.adjust({
      userId,
      amount: econ.signupBonus,
      type: TransactionType.SIGNUP_BONUS,
      reason: 'Welcome bonus',
      description: `Bonus de bienvenue (+${econ.signupBonus} VC)`,
      tx,
    });
  }

  /** Records an irreversible referral and credits both parties. */
  private async applyReferral(
    referrer: { id: string; username: string },
    newUser: { id: string; username: string },
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const econ = this.econ();
    await (tx ?? this.prisma).referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUser.id,
        codeUsed: code.toUpperCase(),
        rewardReferrer: econ.referralRewardReferrer,
        rewardReferred: econ.referralRewardReferred,
        locked: true,
      },
    });
    await this.balance.adjust({
      userId: newUser.id,
      amount: econ.referralRewardReferred,
      type: TransactionType.REFERRAL_BONUS_REFERRED,
      reason: 'Referral bonus',
      description: `Parrainage par ${referrer.username}`,
      tx,
    });
    await this.balance.adjust({
      userId: referrer.id,
      amount: econ.referralRewardReferrer,
      type: TransactionType.REFERRAL_BONUS_REFERRER,
      reason: 'Referral bonus',
      description: `Filleul ${newUser.username} inscrit`,
      tx,
    });
    await this.notifications.create({
      userId: referrer.id,
      type: NotificationType.REFERRAL_REWARD,
      title: `Nouveau filleul : +${econ.referralRewardReferrer} VC 🎉`,
      body: `${newUser.username} s'est inscrit avec votre code.`,
      data: { referredUsername: newUser.username },
    });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? 'Email already in use'
          : 'Username already taken',
      );
    }

    const referrer = await this.resolveReferrer(dto.referralCode);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const referralCode = await this.generateReferralCode();

    // Create the account, credit the signup bonus and apply the referral in one
    // transaction so a mid-way failure can't leave a half-provisioned account.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          balance: 0,
          referralCode,
          referredById: referrer?.id,
          referralLocked: !!referrer,
        },
        select: { id: true, username: true, role: true },
      });
      await this.grantSignupBonus(created.id, tx);
      if (referrer) await this.applyReferral(referrer, created, dto.referralCode!, tx);
      return created;
    });

    const tokens = await this.issueTokens(user);
    const profile = await this.users.getPrivateProfile(user.id);
    return { user: profile, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: dto.emailOrUsername }, { username: dto.emailOrUsername }],
      },
      select: { id: true, username: true, role: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses Google sign-in');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.users.processLogin(user.id);

    const tokens = await this.issueTokens(user);
    const profile = await this.users.getPrivateProfile(user.id);
    return { user: profile, ...tokens };
  }

  /** Verifies a Supabase access token by calling the Supabase Auth API. */
  private async verifySupabaseToken(accessToken: string): Promise<SupabaseUser> {
    const { url, anonKey } = this.config.get('supabase') as {
      url: string;
      anonKey: string;
    };
    let res: Response;
    try {
      res = await fetch(`${url}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey },
      });
    } catch (e) {
      this.logger.error(`Supabase verify failed: ${(e as Error).message}`);
      throw new UnauthorizedException('Could not reach the identity provider');
    }
    if (!res.ok) throw new UnauthorizedException('Invalid Google session');

    const data = (await res.json()) as {
      id: string;
      email?: string;
      user_metadata?: Record<string, string>;
    };
    if (!data.email) throw new UnauthorizedException('Google account has no email');
    const meta = data.user_metadata ?? {};
    return {
      id: data.id,
      email: data.email.toLowerCase(),
      name: meta.full_name || meta.name || null,
      avatarUrl: meta.avatar_url || meta.picture || null,
    };
  }

  /**
   * Logs in (or registers) via a Supabase OAuth session (Google). New users
   * receive the signup bonus and may apply a referral code. Existing accounts
   * with the same email are linked to the Supabase identity.
   */
  async loginWithSupabase(dto: SupabaseLoginDto) {
    const supa = await this.verifySupabaseToken(dto.accessToken);

    // Existing user by Supabase id or email.
    let existing = await this.prisma.user.findFirst({
      where: { OR: [{ supabaseUserId: supa.id }, { email: supa.email }], deletedAt: null },
      select: { id: true, username: true, role: true, supabaseUserId: true },
    });

    if (existing) {
      if (!existing.supabaseUserId) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { supabaseUserId: supa.id, avatarUrl: supa.avatarUrl ?? undefined },
        });
      }
      await this.users.processLogin(existing.id);
      const tokens = await this.issueTokens(existing);
      const profile = await this.users.getPrivateProfile(existing.id);
      return { user: profile, ...tokens };
    }

    // New OAuth user.
    const referrer = await this.resolveReferrer(dto.referralCode);
    const username = await this.generateUniqueUsername(
      supa.name ?? supa.email.split('@')[0],
    );
    const referralCode = await this.generateReferralCode();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: supa.email,
          username,
          passwordHash: null,
          supabaseUserId: supa.id,
          avatarUrl: supa.avatarUrl,
          balance: 0,
          referralCode,
          referredById: referrer?.id,
          referralLocked: !!referrer,
          ageVerifiedAt: new Date(),
        },
        select: { id: true, username: true, role: true },
      });
      await this.grantSignupBonus(created.id, tx);
      if (referrer) await this.applyReferral(referrer, created, dto.referralCode!, tx);
      return created;
    });

    const tokens = await this.issueTokens(user);
    const profile = await this.users.getPrivateProfile(user.id);
    return { user: profile, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = { id: payload.sub, username: payload.username, role: payload.role };
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
