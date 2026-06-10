import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BankStatus {
  activeLoan: {
    id: string;
    principal: number;
    amountDue: number;
    amountRepaid: number;
    interestAccrued: number;
    dueDate: string;
    daysOverdue: number;
    status: string;
  } | null;
  eligibility: {
    canBorrow: boolean;
    balance: number;
    threshold: number;
    amounts: number[];
    reason: string | null;
  };
}

export interface P2PParty {
  id: string;
  username: string;
  rank: string;
}
export interface P2PLoanDto {
  id: string;
  lenderId: string;
  borrowerId: string;
  amount: number;
  interestRate: number;
  durationDays: number;
  amountDue: number;
  amountRepaid: number;
  status: string;
  dueDate: string | null;
  lender: P2PParty;
  borrower: P2PParty;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['loans'] });
  qc.invalidateQueries({ queryKey: ['me'] });
}

export function useBankLoan() {
  return useQuery({
    queryKey: ['loans', 'bank'],
    queryFn: async () => (await api.get<BankStatus>('/loans/bank')).data,
  });
}

export function useP2PLoans() {
  return useQuery({
    queryKey: ['loans', 'p2p'],
    queryFn: async () =>
      (await api.get<{ incoming: P2PLoanDto[]; outgoing: P2PLoanDto[] }>('/loans/p2p')).data,
  });
}

export function useGifts() {
  return useQuery({
    queryKey: ['loans', 'gifts'],
    queryFn: async () =>
      (
        await api.get<{
          sent: { amount: number; recipient: { username: string }; createdAt: string }[];
          received: { amount: number; sender: { username: string }; createdAt: string }[];
          dailyLimit: number;
          sentToday: number;
        }>('/loans/gifts')
      ).data,
  });
}

export function useLoanActions() {
  const qc = useQueryClient();
  const opts = { onSuccess: () => invalidate(qc) };
  return {
    requestBank: useMutation({ mutationFn: (amount: number) => api.post('/loans/bank', { amount }), ...opts }),
    repayBank: useMutation({
      mutationFn: (v: { id: string; amount?: number }) => api.post(`/loans/bank/${v.id}/repay`, { amount: v.amount }),
      ...opts,
    }),
    proposeP2P: useMutation({
      mutationFn: (v: { borrowerUsername: string; amount: number; interestRate: number; durationDays: number }) =>
        api.post('/loans/p2p', v),
      ...opts,
    }),
    acceptP2P: useMutation({ mutationFn: (id: string) => api.post(`/loans/p2p/${id}/accept`), ...opts }),
    rejectP2P: useMutation({ mutationFn: (id: string) => api.post(`/loans/p2p/${id}/reject`), ...opts }),
    cancelP2P: useMutation({ mutationFn: (id: string) => api.post(`/loans/p2p/${id}/cancel`), ...opts }),
    repayP2P: useMutation({ mutationFn: (id: string) => api.post(`/loans/p2p/${id}/repay`, {}), ...opts }),
    negotiateP2P: useMutation({
      // Only send the negotiable terms in the body; `id` goes in the URL. The
      // backend ValidationPipe runs with forbidNonWhitelisted, so an extra `id`
      // property in the body would otherwise be rejected with a 400.
      mutationFn: ({ id, ...terms }: { id: string; amount?: number; interestRate?: number; durationDays?: number }) =>
        api.post(`/loans/p2p/${id}/negotiate`, terms),
      ...opts,
    }),
    sendGift: useMutation({
      mutationFn: (v: { recipientUsername: string; amount: number; message?: string }) =>
        api.post('/loans/gifts', v),
      ...opts,
    }),
  };
}
