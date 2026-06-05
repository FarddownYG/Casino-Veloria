import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokenService } from '../common/token/token.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  private async generateReferralCode(): Promise<string> {
    // 8-char uppercase base32-ish code, retry until unique.
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

    // Resolve referral code (irreversible once registered).
    let referrer: { id: string; username: string } | null = null;
    if (dto.referralCode) {
      referrer = await this.prisma.user.findUnique({
        where: { referralCode: dto.referralCode.toUpperCase() },
        select: { id: true, username: true },
      });
      if (!referrer) throw new BadRequestException('Invalid referral code');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const referralCode = await this.generateReferralCode();
    const econ = this.config.get('economy') as {
      signupBonus: number;
      referralRewardReferrer: number;
      referralRewardReferred: number;
    };

    // Create the user with balance 0; the signup bonus is applied via the
    // ledger so every coin is traceable.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        balance: 0,
        referralCode,
        referredById: referrer?.id,
        referralLocked: !!referrer,
        ageVerifiedAt: null,
      },
      select: { id: true, username: true, role: true },
    });

    // Signup bonus.
    await this.balance.adjust({
      userId: user.id,
      amount: econ.signupBonus,
      type: TransactionType.SIGNUP_BONUS,
      reason: 'Welcome bonus',
      description: `Bonus de bienvenue (+${econ.signupBonus} VC)`,
    });

    // Referral rewards (irreversible, locked).
    if (referrer) {
      await this.prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
          codeUsed: dto.referralCode!.toUpperCase(),
          rewardReferrer: econ.referralRewardReferrer,
          rewardReferred: econ.referralRewardReferred,
          locked: true,
        },
      });
      await this.balance.adjust({
        userId: user.id,
        amount: econ.referralRewardReferred,
        type: TransactionType.REFERRAL_BONUS_REFERRED,
        reason: 'Referral bonus',
        description: `Parrainage par ${referrer.username}`,
      });
      await this.balance.adjust({
        userId: referrer.id,
        amount: econ.referralRewardReferrer,
        type: TransactionType.REFERRAL_BONUS_REFERRER,
        reason: 'Referral bonus',
        description: `Filleul ${user.username} inscrit`,
      });
      await this.notifications.create({
        userId: referrer.id,
        type: NotificationType.REFERRAL_REWARD,
        title: `Nouveau filleul : +${econ.referralRewardReferrer} VC 🎉`,
        body: `${user.username} s'est inscrit avec votre code.`,
        data: { referredUsername: user.username },
      });
    }

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

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.users.processLogin(user.id);

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

    // Rotate: revoke the old token, issue a new pair.
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
