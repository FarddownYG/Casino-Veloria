import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BalanceService } from './balance.service';
import { CasinoService } from './casino.service';

@Module({
  imports: [NotificationsModule],
  providers: [BalanceService, CasinoService],
  exports: [BalanceService, CasinoService],
})
export class EconomyModule {}
