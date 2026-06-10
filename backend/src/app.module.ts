import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { TokenModule } from './common/token/token.module';
import { EconomyModule } from './economy/economy.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LoansModule } from './loans/loans.module';
import { ReferralModule } from './referral/referral.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { GamesModule } from './games/games.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get('redis') as { host: string; port: number; password?: string };
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    TokenModule,
    EconomyModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    LoansModule,
    ReferralModule,
    LeaderboardModule,
    GamesModule,
  ],
  controllers: [HealthController],
  // Register the throttler globally so the @Throttle decorators on the auth /
  // loans controllers are actually enforced (without this guard they are inert).
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
