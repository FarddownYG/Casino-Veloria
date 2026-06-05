import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, P2PLoanStatus, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BalanceService } from '../economy/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NegotiateP2PLoanDto,
  ProposeP2PLoanDto,
} from './dto/loans.dto';

const DAY_MS = 86_400_000;

interface NegotiationState {
  lastProposedBy: string;
  terms: { amount: number; interestRate: number; durationDays: number };
  history: {
    by: string;
    amount: number;
    interestRate: number;
    durationDays: number;
    at: string;
  }[];
}

const userSummary = { select: { id: true, username: true, rank: true } };

const NEGOTIABLE: P2PLoanStatus[] = [P2PLoanStatus.PROPOSED, P2PLoanStatus.NEGOTIATING];

@Injectable()
export class P2PLoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.p2PLoan.findMany({
        where: { borrowerId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { lender: userSummary, borrower: userSummary },
      }),
      this.prisma.p2PLoan.findMany({
        where: { lenderId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { lender: userSummary, borrower: userSummary },
      }),
    ]);
    return { incoming, outgoing };
  }

  private computeAmountDue(amount: number, interestRate: number): number {
    return amount + Math.round((amount * interestRate) / 100);
  }

  async propose(lenderId: string, dto: ProposeP2PLoanDto) {
    const borrower = await this.prisma.user.findFirst({
      where: { username: dto.borrowerUsername, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!borrower) throw new BadRequestException('Borrower not found');
    if (borrower.id === lenderId) {
      throw new BadRequestException('You cannot lend to yourself');
    }

    const lender = await this.prisma.user.findUnique({
      where: { id: lenderId },
      select: { balance: true, username: true },
    });
    if (!lender) throw new NotFoundException('User not found');
    if (lender.balance < dto.amount) {
      throw new BadRequestException('Insufficient balance to fund this loan');
    }

    const negotiation: NegotiationState = {
      lastProposedBy: lenderId,
      terms: {
        amount: dto.amount,
        interestRate: dto.interestRate,
        durationDays: dto.durationDays,
      },
      history: [
        {
          by: lenderId,
          amount: dto.amount,
          interestRate: dto.interestRate,
          durationDays: dto.durationDays,
          at: new Date().toISOString(),
        },
      ],
    };

    const loan = await this.prisma.p2PLoan.create({
      data: {
        lenderId,
        borrowerId: borrower.id,
        amount: dto.amount,
        interestRate: dto.interestRate,
        durationDays: dto.durationDays,
        penaltyRate: dto.penaltyRate ?? 0,
        status: P2PLoanStatus.PROPOSED,
        negotiation: negotiation as unknown as Prisma.InputJsonValue,
      },
      include: { lender: userSummary, borrower: userSummary },
    });

    await this.notifications.create({
      userId: borrower.id,
      type: NotificationType.P2P_LOAN_OFFER,
      title: `Offre de prêt de ${lender.username}`,
      body: `${dto.amount} VC à ${dto.interestRate}% sur ${dto.durationDays} jours.`,
      data: { loanId: loan.id },
    });

    return loan;
  }

  private async loadParty(loanId: string, userId: string) {
    const loan = await this.prisma.p2PLoan.findUnique({
      where: { id: loanId },
      include: { lender: userSummary, borrower: userSummary },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
      throw new ForbiddenException('Not a party to this loan');
    }
    return loan;
  }

  async negotiate(loanId: string, userId: string, dto: NegotiateP2PLoanDto) {
    const loan = await this.loadParty(loanId, userId);
    if (!NEGOTIABLE.includes(loan.status)) {
      throw new BadRequestException('Loan can no longer be negotiated');
    }

    const prev = (loan.negotiation as unknown as NegotiationState).terms;
    const terms = {
      amount: dto.amount ?? prev.amount,
      interestRate: dto.interestRate ?? prev.interestRate,
      durationDays: dto.durationDays ?? prev.durationDays,
    };
    const negotiation = loan.negotiation as unknown as NegotiationState;
    const next: NegotiationState = {
      lastProposedBy: userId,
      terms,
      history: [
        ...negotiation.history,
        { by: userId, ...terms, at: new Date().toISOString() },
      ],
    };

    const updated = await this.prisma.p2PLoan.update({
      where: { id: loan.id },
      data: {
        status: P2PLoanStatus.NEGOTIATING,
        amount: terms.amount,
        interestRate: terms.interestRate,
        durationDays: terms.durationDays,
        negotiation: next as unknown as Prisma.InputJsonValue,
      },
      include: { lender: userSummary, borrower: userSummary },
    });

    const counterpartyId = userId === loan.lenderId ? loan.borrowerId : loan.lenderId;
    await this.notifications.create({
      userId: counterpartyId,
      type: NotificationType.P2P_LOAN_NEGOTIATION,
      title: 'Contre-proposition de prêt',
      body: `${terms.amount} VC à ${terms.interestRate}% sur ${terms.durationDays} jours.`,
      data: { loanId: loan.id },
    });
    return updated;
  }

  async accept(loanId: string, userId: string) {
    const loan = await this.loadParty(loanId, userId);
    if (!NEGOTIABLE.includes(loan.status)) {
      throw new BadRequestException('Loan cannot be accepted');
    }
    const negotiation = loan.negotiation as unknown as NegotiationState;
    if (negotiation.lastProposedBy === userId) {
      throw new BadRequestException('Wait for the other party to respond to your terms');
    }

    const amountDue = this.computeAmountDue(loan.amount, loan.interestRate);
    const dueDate = new Date(Date.now() + loan.durationDays * DAY_MS);

    // Move the funds lender -> borrower atomically.
    await this.balance.transfer({
      fromUserId: loan.lenderId,
      toUserId: loan.borrowerId,
      amount: loan.amount,
      fromType: TransactionType.P2P_LOAN_DISBURSEMENT,
      toType: TransactionType.P2P_LOAN_RECEIVED,
      refId: loan.id,
      description: `Prêt P2P (${loan.amount} VC)`,
    });

    const updated = await this.prisma.p2PLoan.update({
      where: { id: loan.id },
      data: {
        status: P2PLoanStatus.ACCEPTED,
        acceptedAt: new Date(),
        amountDue,
        dueDate,
      },
      include: { lender: userSummary, borrower: userSummary },
    });

    await this.notifications.create({
      userId: loan.lenderId,
      type: NotificationType.P2P_LOAN_ACCEPTED,
      title: 'Prêt accepté ✅',
      body: `${loan.borrower.username} a accepté votre prêt de ${loan.amount} VC.`,
      data: { loanId: loan.id },
    });
    await this.notifications.create({
      userId: loan.borrowerId,
      type: NotificationType.LOAN_RECEIVED,
      title: `Prêt reçu : +${loan.amount} VC`,
      body: `À rembourser ${amountDue} VC avant le ${dueDate.toLocaleDateString('fr-FR')}.`,
      data: { loanId: loan.id },
    });
    return updated;
  }

  async reject(loanId: string, userId: string) {
    const loan = await this.loadParty(loanId, userId);
    if (!NEGOTIABLE.includes(loan.status)) {
      throw new BadRequestException('Loan cannot be rejected');
    }
    const updated = await this.prisma.p2PLoan.update({
      where: { id: loan.id },
      data: { status: P2PLoanStatus.REJECTED },
      include: { lender: userSummary, borrower: userSummary },
    });
    const counterpartyId = userId === loan.lenderId ? loan.borrowerId : loan.lenderId;
    await this.notifications.create({
      userId: counterpartyId,
      type: NotificationType.P2P_LOAN_REJECTED,
      title: 'Offre de prêt refusée',
      body: 'La proposition de prêt a été refusée.',
      data: { loanId: loan.id },
    });
    return updated;
  }

  async cancel(loanId: string, userId: string) {
    const loan = await this.loadParty(loanId, userId);
    if (loan.lenderId !== userId) {
      throw new ForbiddenException('Only the lender can cancel the offer');
    }
    if (!NEGOTIABLE.includes(loan.status)) {
      throw new BadRequestException('Loan cannot be cancelled');
    }
    return this.prisma.p2PLoan.update({
      where: { id: loan.id },
      data: { status: P2PLoanStatus.CANCELLED },
      include: { lender: userSummary, borrower: userSummary },
    });
  }

  async repay(loanId: string, userId: string, amount?: number) {
    const loan = await this.loadParty(loanId, userId);
    if (loan.borrowerId !== userId) {
      throw new ForbiddenException('Only the borrower repays');
    }
    if (loan.status !== P2PLoanStatus.ACCEPTED) {
      throw new BadRequestException('Loan is not in repayment');
    }

    const outstanding = loan.amountDue - loan.amountRepaid;
    const repayAmount = Math.min(amount ?? outstanding, outstanding);
    if (repayAmount <= 0) throw new BadRequestException('Nothing to repay');

    await this.balance.transfer({
      fromUserId: loan.borrowerId,
      toUserId: loan.lenderId,
      amount: repayAmount,
      fromType: TransactionType.P2P_LOAN_REPAYMENT_OUT,
      toType: TransactionType.P2P_LOAN_REPAYMENT_IN,
      refId: loan.id,
      description: `Remboursement prêt P2P (${repayAmount} VC)`,
    });

    const amountRepaid = loan.amountRepaid + repayAmount;
    const fullyRepaid = amountRepaid >= loan.amountDue;

    const updated = await this.prisma.p2PLoan.update({
      where: { id: loan.id },
      data: {
        amountRepaid,
        status: fullyRepaid ? P2PLoanStatus.REPAID : P2PLoanStatus.ACCEPTED,
        repaidAt: fullyRepaid ? new Date() : null,
      },
      include: { lender: userSummary, borrower: userSummary },
    });

    if (fullyRepaid) {
      await this.notifications.create({
        userId: loan.lenderId,
        type: NotificationType.GENERIC,
        title: 'Prêt remboursé 💰',
        body: `${loan.borrower.username} a remboursé son prêt (${loan.amountDue} VC).`,
        data: { loanId: loan.id },
      });
    }
    return updated;
  }
}
