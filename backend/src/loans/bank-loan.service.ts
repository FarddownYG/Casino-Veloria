import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankLoanStatus, NotificationType, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';

const DAY_MS = 86_400_000;
const ALLOWED_AMOUNTS = [500, 1000, 2500];

@Injectable()
export class BankLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private econ() {
    return this.config.get('economy') as {
      bankLoanThreshold: number;
      bankLoanGraceDays: number;
      bankLoanDailyInterest: number;
    };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const activeLoan = await this.prisma.bankLoan.findFirst({
      where: { userId, status: BankLoanStatus.ACTIVE },
    });
    const { bankLoanThreshold } = this.econ();

    return {
      activeLoan,
      eligibility: {
        canBorrow: !activeLoan && user.balance < bankLoanThreshold,
        balance: user.balance,
        threshold: bankLoanThreshold,
        amounts: ALLOWED_AMOUNTS,
        reason: activeLoan
          ? 'Vous avez déjà un prêt actif'
          : user.balance >= bankLoanThreshold
            ? `Disponible uniquement sous ${bankLoanThreshold} VC`
            : null,
      },
    };
  }

  async requestLoan(userId: string, amount: number) {
    if (!ALLOWED_AMOUNTS.includes(amount)) {
      throw new BadRequestException('Invalid loan amount');
    }
    const { bankLoanThreshold, bankLoanGraceDays } = this.econ();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.balance >= bankLoanThreshold) {
      throw new BadRequestException(
        `Loans are only available when balance is below ${bankLoanThreshold} VC`,
      );
    }

    const existing = await this.prisma.bankLoan.findFirst({
      where: { userId, status: BankLoanStatus.ACTIVE },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('You already have an active loan');

    const dueDate = new Date(Date.now() + bankLoanGraceDays * DAY_MS);
    const loan = await this.prisma.bankLoan.create({
      data: {
        userId,
        principal: amount,
        amountDue: amount,
        dueDate,
      },
    });

    await this.balance.adjust({
      userId,
      amount,
      type: TransactionType.BANK_LOAN_DISBURSEMENT,
      reason: 'Bank loan',
      refId: loan.id,
      description: `Prêt banque de ${amount} VC`,
    });

    await this.notifications.create({
      userId,
      type: NotificationType.LOAN_RECEIVED,
      title: `Prêt accordé : +${amount} VC 🏦`,
      body: `À rembourser avant le ${dueDate.toLocaleDateString('fr-FR')}.`,
      data: { loanId: loan.id, amount, dueDate },
    });

    return loan;
  }

  async repay(userId: string, loanId: string, amount?: number) {
    const loan = await this.prisma.bankLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.userId !== userId) throw new ForbiddenException('Not your loan');
    if (loan.status !== BankLoanStatus.ACTIVE) {
      throw new BadRequestException('Loan is not active');
    }

    const outstanding = loan.amountDue - loan.amountRepaid;
    const repayAmount = Math.min(amount ?? outstanding, outstanding);
    if (repayAmount <= 0) throw new BadRequestException('Nothing to repay');

    await this.balance.adjust({
      userId,
      amount: -repayAmount,
      type: TransactionType.BANK_LOAN_REPAYMENT,
      reason: 'Bank loan repayment',
      refId: loan.id,
      description: `Remboursement prêt (${repayAmount} VC)`,
    });

    const amountRepaid = loan.amountRepaid + repayAmount;
    const fullyRepaid = amountRepaid >= loan.amountDue;

    return this.prisma.bankLoan.update({
      where: { id: loan.id },
      data: {
        amountRepaid,
        status: fullyRepaid ? BankLoanStatus.REPAID : BankLoanStatus.ACTIVE,
        repaidAt: fullyRepaid ? new Date() : null,
      },
    });
  }

  /**
   * Daily BullMQ job: accrues 10%/day interest on overdue loans and sends
   * J-2 / J-1 / J+0 reminders.
   */
  async runDailyInterest(): Promise<{ processed: number }> {
    const { bankLoanDailyInterest } = this.econ();
    const now = new Date();
    const loans = await this.prisma.bankLoan.findMany({
      where: { status: BankLoanStatus.ACTIVE },
    });

    for (const loan of loans) {
      const msToDue = loan.dueDate.getTime() - now.getTime();
      const daysToDue = Math.ceil(msToDue / DAY_MS);

      if (msToDue >= 0) {
        // Upcoming reminders.
        if ([2, 1, 0].includes(daysToDue)) {
          await this.notifications.create({
            userId: loan.userId,
            type: NotificationType.LOAN_REPAYMENT_DUE,
            title:
              daysToDue === 0
                ? 'Remboursement dû aujourd’hui ⏰'
                : `Remboursement dans ${daysToDue} jour(s)`,
            body: `Prêt banque : ${loan.amountDue - loan.amountRepaid} VC à rembourser.`,
            data: { loanId: loan.id, daysToDue },
          });
        }
        continue;
      }

      // Overdue: accrue interest for any newly elapsed overdue days.
      const totalOverdueDays = Math.floor(-msToDue / DAY_MS);
      const newDays = totalOverdueDays - loan.daysOverdue;
      if (newDays <= 0) continue;

      const interestToAdd = Math.round(loan.principal * bankLoanDailyInterest * newDays);
      await this.prisma.bankLoan.update({
        where: { id: loan.id },
        data: {
          interestAccrued: { increment: interestToAdd },
          amountDue: { increment: interestToAdd },
          daysOverdue: totalOverdueDays,
          lastInterestRunAt: now,
        },
      });

      await this.notifications.create({
        userId: loan.userId,
        type: NotificationType.LOAN_OVERDUE,
        title: `Prêt en retard : +${interestToAdd} VC d’intérêts`,
        body: `${totalOverdueDays} jour(s) de retard. Total dû : ${
          loan.amountDue + interestToAdd - loan.amountRepaid
        } VC.`,
        data: { loanId: loan.id, interestToAdd, totalOverdueDays },
      });
    }

    return { processed: loans.length };
  }
}
