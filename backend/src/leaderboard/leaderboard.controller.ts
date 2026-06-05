import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LeaderboardService } from './leaderboard.service';

@Public()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get('wealth')
  wealth(@Query('limit') limit?: string) {
    return this.leaderboard.getWealth(limit ? Math.min(+limit, 100) : 50);
  }

  @Get('gains')
  gains(@Query('limit') limit?: string) {
    return this.leaderboard.getGains(limit ? Math.min(+limit, 100) : 50);
  }

  @Get('casino')
  casino() {
    return this.leaderboard.getCasino();
  }
}
