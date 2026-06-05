import { useState } from 'react';
import { Landmark, HandCoins, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  useBankLoan,
  useGifts,
  useLoanActions,
  useP2PLoans,
} from '@/hooks/useLoans';
import { useAuthStore } from '@/store/auth';
import { apiErrorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { daysUntil, formatVC, formatDate } from '@/lib/utils';

export default function Loans() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Banque & Transferts</h1>
      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank">
            <Landmark className="mr-1 inline h-4 w-4" /> Prêt banque
          </TabsTrigger>
          <TabsTrigger value="p2p">
            <HandCoins className="mr-1 inline h-4 w-4" /> Prêts entre joueurs
          </TabsTrigger>
          <TabsTrigger value="gift">
            <Gift className="mr-1 inline h-4 w-4" /> Don direct
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bank"><BankSection /></TabsContent>
        <TabsContent value="p2p"><P2PSection /></TabsContent>
        <TabsContent value="gift"><GiftSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function BankSection() {
  const { data } = useBankLoan();
  const { requestBank, repayBank } = useLoanActions();
  const loan = data?.activeLoan;
  const elig = data?.eligibility;

  const onRequest = (amount: number) =>
    requestBank.mutate(amount, { onError: (e) => toast.error('Erreur', apiErrorMessage(e)) });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-surface p-5">
        <h3 className="font-semibold">Demander un prêt</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Disponible quand votre solde passe sous {formatVC(elig?.threshold ?? 200)} VC. 7 jours pour
          rembourser, puis +10% d'intérêts par jour de retard.
        </p>
        {elig?.canBorrow ? (
          <div className="mt-4 flex gap-2">
            {(elig.amounts ?? [500, 1000, 2500]).map((a) => (
              <Button key={a} onClick={() => onRequest(a)} disabled={requestBank.isPending}>
                {formatVC(a)} VC
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-surface-raised p-3 text-sm text-muted-foreground">
            {elig?.reason ?? 'Indisponible pour le moment.'}
          </p>
        )}
      </div>

      <div className="card-surface p-5">
        <h3 className="font-semibold">Prêt en cours</h3>
        {loan ? (
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Capital" value={`${formatVC(loan.principal)} VC`} />
            <Row label="Intérêts cumulés" value={`${formatVC(loan.interestAccrued)} VC`} />
            <Row label="Total dû" value={`${formatVC(loan.amountDue - loan.amountRepaid)} VC`} strong />
            <Row label="Échéance" value={`${formatDate(loan.dueDate)} (${daysUntil(loan.dueDate)}j)`} />
            {loan.daysOverdue > 0 && <Badge variant="loss">En retard de {loan.daysOverdue}j</Badge>}
            <Button
              className="mt-2 w-full"
              onClick={() => repayBank.mutate({ id: loan.id }, { onError: (e) => toast.error('Erreur', apiErrorMessage(e)) })}
              disabled={repayBank.isPending}
            >
              Rembourser ({formatVC(loan.amountDue - loan.amountRepaid)} VC)
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Aucun prêt actif.</p>
        )}
      </div>
    </div>
  );
}

function P2PSection() {
  const { data } = useP2PLoans();
  const a = useLoanActions();
  const me = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ borrowerUsername: '', amount: 500, interestRate: 5, durationDays: 7 });

  const propose = () =>
    a.proposeP2P.mutate(form, {
      onSuccess: () => toast.success('Offre envoyée'),
      onError: (e) => toast.error('Erreur', apiErrorMessage(e)),
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-surface p-5">
        <h3 className="font-semibold">Proposer un prêt</h3>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Pseudo de l'emprunteur</Label>
            <Input value={form.borrowerUsername} onChange={(e) => setForm({ ...form, borrowerUsername: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Intérêt %</Label>
              <Input type="number" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: +e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Durée (j)</Label>
              <Input type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: +e.target.value })} />
            </div>
          </div>
          <Button className="w-full" onClick={propose} disabled={a.proposeP2P.isPending}>
            Proposer
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <LoanList
          title="Offres reçues"
          loans={data?.incoming ?? []}
          render={(l) => {
            const mine = l.borrowerId === me?.id;
            return (
              <div className="flex gap-2">
                {l.status === 'ACCEPTED' && mine && (
                  <Button size="sm" onClick={() => a.repayP2P.mutate(l.id)}>Rembourser</Button>
                )}
                {(l.status === 'PROPOSED' || l.status === 'NEGOTIATING') && mine && (
                  <>
                    <Button size="sm" onClick={() => a.acceptP2P.mutate(l.id)}>Accepter</Button>
                    <Button size="sm" variant="secondary" onClick={() => a.rejectP2P.mutate(l.id)}>Refuser</Button>
                  </>
                )}
              </div>
            );
          }}
        />
        <LoanList
          title="Offres envoyées"
          loans={data?.outgoing ?? []}
          render={(l) =>
            l.status === 'PROPOSED' || l.status === 'NEGOTIATING' ? (
              <Button size="sm" variant="secondary" onClick={() => a.cancelP2P.mutate(l.id)}>Annuler</Button>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function LoanList({
  title,
  loans,
  render,
}: {
  title: string;
  loans: import('@/hooks/useLoans').P2PLoanDto[];
  render: (l: import('@/hooks/useLoans').P2PLoanDto) => React.ReactNode;
}) {
  return (
    <div className="card-surface p-4">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      {loans.length === 0 && <p className="text-xs text-muted-foreground">Aucune.</p>}
      <div className="space-y-2">
        {loans.map((l) => (
          <div key={l.id} className="rounded-lg bg-surface-raised p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {l.lender.username} → {l.borrower.username}
              </span>
              <Badge variant={l.status === 'ACCEPTED' ? 'gold' : l.status === 'REPAID' ? 'win' : 'muted'}>
                {l.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatVC(l.amount)} VC · {l.interestRate}% · {l.durationDays}j · dû {formatVC(l.amountDue || l.amount)} VC
            </p>
            <div className="mt-2">{render(l)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GiftSection() {
  const { data } = useGifts();
  const { sendGift } = useLoanActions();
  const [form, setForm] = useState({ recipientUsername: '', amount: 100, message: '' });

  const send = () =>
    sendGift.mutate(form, {
      onSuccess: () => {
        toast.success('Don envoyé 🎁');
        setForm({ ...form, amount: 100, message: '' });
      },
      onError: (e) => toast.error('Erreur', apiErrorMessage(e)),
    });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-surface p-5">
        <h3 className="font-semibold">Faire un don</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sans intérêt, immédiat. Limite : {formatVC(data?.sentToday ?? 0)}/{formatVC(data?.dailyLimit ?? 5000)} VC
          envoyés aujourd'hui.
        </p>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Destinataire</Label>
            <Input value={form.recipientUsername} onChange={(e) => setForm({ ...form, recipientUsername: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Montant</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Message (optionnel)</Label>
            <Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={140} />
          </div>
          <Button className="w-full" onClick={send} disabled={sendGift.isPending}>
            Envoyer le don
          </Button>
        </div>
      </div>

      <div className="card-surface p-5">
        <h3 className="font-semibold">Historique</h3>
        <div className="mt-3 space-y-1 text-sm">
          {data?.received.map((g, i) => (
            <p key={`r${i}`} className="text-win">+{formatVC(g.amount)} VC de {g.sender.username}</p>
          ))}
          {data?.sent.map((g, i) => (
            <p key={`s${i}`} className="text-muted-foreground">−{formatVC(g.amount)} VC à {g.recipient.username}</p>
          ))}
          {!data?.received.length && !data?.sent.length && (
            <p className="text-xs text-muted-foreground">Aucun don pour l'instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-bold text-gold' : 'font-medium'}>{value}</span>
    </div>
  );
}
