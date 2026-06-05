import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReferralService } from './referral.service';

@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.referral.getDashboard(userId);
  }
}
