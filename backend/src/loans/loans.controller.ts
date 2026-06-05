import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BankLoanService } from './bank-loan.service';
import { P2PLoanService } from './p2p-loan.service';
import { GiftService } from './gift.service';
import {
  NegotiateP2PLoanDto,
  ProposeP2PLoanDto,
  RepayDto,
  RequestBankLoanDto,
  SendGiftDto,
} from './dto/loans.dto';

@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('loans')
export class LoansController {
  constructor(
    private readonly bank: BankLoanService,
    private readonly p2p: P2PLoanService,
    private readonly gifts: GiftService,
  ) {}

  // --- Bank ---
  @Get('bank')
  bankStatus(@CurrentUser('userId') userId: string) {
    return this.bank.getStatus(userId);
  }

  @Post('bank')
  requestBank(@CurrentUser('userId') userId: string, @Body() dto: RequestBankLoanDto) {
    return this.bank.requestLoan(userId, dto.amount);
  }

  @Post('bank/:id/repay')
  repayBank(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: RepayDto,
  ) {
    return this.bank.repay(userId, id, dto.amount);
  }

  // --- P2P ---
  @Get('p2p')
  listP2P(@CurrentUser('userId') userId: string) {
    return this.p2p.list(userId);
  }

  @Post('p2p')
  proposeP2P(@CurrentUser('userId') userId: string, @Body() dto: ProposeP2PLoanDto) {
    return this.p2p.propose(userId, dto);
  }

  @Post('p2p/:id/accept')
  acceptP2P(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.p2p.accept(id, userId);
  }

  @Post('p2p/:id/negotiate')
  negotiateP2P(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: NegotiateP2PLoanDto,
  ) {
    return this.p2p.negotiate(id, userId, dto);
  }

  @Post('p2p/:id/reject')
  rejectP2P(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.p2p.reject(id, userId);
  }

  @Post('p2p/:id/cancel')
  cancelP2P(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.p2p.cancel(id, userId);
  }

  @Post('p2p/:id/repay')
  repayP2P(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: RepayDto,
  ) {
    return this.p2p.repay(id, userId, dto.amount);
  }

  // --- Gifts ---
  @Post('gifts')
  sendGift(@CurrentUser('userId') userId: string, @Body() dto: SendGiftDto) {
    return this.gifts.send(userId, dto);
  }

  @Get('gifts')
  giftHistory(@CurrentUser('userId') userId: string) {
    return this.gifts.history(userId);
  }
}
