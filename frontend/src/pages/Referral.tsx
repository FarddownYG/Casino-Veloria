import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Users, Coins } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { RankBadge } from '@/components/RankBadge';
import { formatVC, formatDate } from '@/lib/utils';
import type { Rank } from '@/types';

interface ReferralDashboard {
  code: string;
  count: number;
  totalEarned: number;
  referrals: { username: string; rank: Rank; reward: number; joinedAt: string }[];
}

export default function Referral() {
  const { data } = useQuery({
    queryKey: ['referral'],
    queryFn: async () => (await api.get<ReferralDashboard>('/referral/me')).data,
  });
  const [copied, setCopied] = useState(false);
  const link = data ? `${window.location.origin}/register?ref=${data.code}` : '';

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Parrainage</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Users} label="Filleuls" value={String(data?.count ?? 0)} />
        <Stat icon={Coins} label="Gains parrainage" value={`${formatVC(data?.totalEarned ?? 0)} VC`} />
        <div className="card-surface p-5">
          <p className="text-xs text-muted-foreground">Votre code</p>
          <p className="font-mono text-2xl font-bold gold-text">{data?.code ?? '—'}</p>
        </div>
      </div>

      <div className="card-surface p-5">
        <p className="text-sm font-semibold">Lien d'invitation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          +200 VC pour votre filleul, +100 VC pour vous. Le code est définitif une fois utilisé.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm"
          />
          <Button onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
      </div>

      <div className="card-surface p-5">
        <p className="mb-3 text-sm font-semibold">Vos filleuls</p>
        {data?.referrals.length ? (
          <div className="space-y-2">
            {data.referrals.map((r) => (
              <div key={r.username} className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {r.username} <RankBadge rank={r.rank} />
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(r.joinedAt)}</span>
                <span className="font-mono font-semibold text-win">+{formatVC(r.reward)} VC</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun filleul pour l'instant. Partagez votre lien !</p>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="card-surface flex items-center gap-3 p-5">
      <Icon className="h-7 w-7 text-gold" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
