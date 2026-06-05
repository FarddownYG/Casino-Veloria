import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LobbyGateway } from './lobby.gateway';
import { EconomyModule } from '../economy/economy.module';

@Module({
  imports: [EconomyModule],
  providers: [LeaderboardService, LobbyGateway],
  controllers: [LeaderboardController],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
