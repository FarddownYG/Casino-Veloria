import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoansController } from './loans.controller';
import { BankLoanService } from './bank-loan.service';
import { P2PLoanService } from './p2p-loan.service';
import { GiftService } from './gift.service';
import { LoanInterestProcessor, LoanScheduler, LOANS_QUEUE } from './loans.processor';
import { EconomyModule } from '../economy/economy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EconomyModule,
    NotificationsModule,
    BullModule.registerQueue({ name: LOANS_QUEUE }),
  ],
  controllers: [LoansController],
  providers: [
    BankLoanService,
    P2PLoanService,
    GiftService,
    LoanInterestProcessor,
    LoanScheduler,
  ],
  exports: [BankLoanService, P2PLoanService, GiftService],
})
export class LoansModule {}
