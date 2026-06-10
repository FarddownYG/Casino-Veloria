import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RankBadge } from '@/components/RankBadge';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatSigned, formatVC, getInitials } from '@/lib/utils';
import type { PublicUser, Rank } from '@/types';

interface History {
  bets: { id: string; gameType: string; betType: string; stake: number; payout: number; won: boolean; createdAt: string }[];
  transactions: { id: string; type: string; amount: number; description: string | null; createdAt: string }[];
}

export default function Profile() {
  const { username = '' } = useParams();
  const me = useAuthStore((s) => s.user);
  // History (bets + transactions) is private to its owner; only fetch it on
  // your own profile to avoid a guaranteed 403 on other players' pages.
  const isSelf = !!me && me.username === username;
  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => (await api.get<PublicUser>(`/users/${username}`)).data,
  });
  const { data: history } = useQuery({
    queryKey: ['profile-history', username],
    enabled: isSelf,
    queryFn: async () => (await api.get<History>(`/users/${username}/history`)).data,
  });

  return (
    <div className="space-y-5">
      <div className="card-surface flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-gradient text-2xl font-bold text-black">
          {getInitials(username)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{profile?.username ?? username}</h1>
            {profile && <RankBadge rank={profile.rank as Rank} />}
          </div>
          <p className="text-sm text-muted-foreground">
            Membre depuis {formatDate(profile?.createdAt)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Solde</p>
            <p className="font-mono text-xl font-bold text-gold">{formatVC(profile?.balance ?? 0)} VC</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gains nets</p>
            <p className="font-mono text-xl font-bold">{formatSigned(profile?.netGains ?? 0)} VC</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="mb-3 font-semibold">Historique de jeu</h3>
          {history?.bets.length ? (
            <div className="space-y-1 text-sm">
              {history.bets.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <span>
                    <Badge variant="muted">{b.gameType}</Badge> <span className="text-muted-foreground">{b.betType}</span>
                  </span>
                  <span className={b.won ? 'font-semibold text-win' : 'text-loss'}>
                    {b.won ? `+${formatVC(b.payout - b.stake)}` : `−${formatVC(b.stake)}`} VC
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isSelf ? 'Aucune partie.' : 'Historique privé.'}
            </p>
          )}
        </div>

        <div className="card-surface p-5">
          <h3 className="mb-3 font-semibold">Transactions récentes</h3>
          {history?.transactions.length ? (
            <div className="space-y-1 text-sm">
              {history.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <span className="truncate text-muted-foreground">{t.description ?? t.type}</span>
                  <span className={t.amount >= 0 ? 'text-win' : 'text-loss'}>{formatSigned(t.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isSelf ? 'Aucune transaction.' : 'Historique privé.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
