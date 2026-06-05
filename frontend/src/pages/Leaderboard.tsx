import { Building2, Coins, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { cn, formatVC } from '@/lib/utils';
import type { LbEntry } from '@/hooks/useLobby';

const MEDAL = ['text-gold', 'text-silver', 'text-bronze'];

function Ranking({ entries, suffix }: { entries?: LbEntry[]; suffix: string }) {
  if (!entries?.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée.</p>;
  return (
    <div className="card-surface divide-y divide-white/5">
      {entries.map((e) => (
        <div key={e.username} className="flex items-center gap-4 px-4 py-3">
          <span className={cn('w-8 text-center text-lg font-bold', MEDAL[e.rank - 1] ?? 'text-muted-foreground')}>
            {e.rank}
          </span>
          <span className="flex-1 font-medium">{e.username}</span>
          <span className="text-xs text-muted-foreground">{e.badge}</span>
          <span className="w-32 text-right font-mono font-bold text-gold">
            {formatVC(e.value)} {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const { wealth, gains, casino } = useLeaderboard();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Classements</h1>
      <Tabs defaultValue="wealth">
        <TabsList>
          <TabsTrigger value="wealth">
            <Coins className="mr-1 inline h-4 w-4" /> Top Richesse
          </TabsTrigger>
          <TabsTrigger value="gains">
            <TrendingUp className="mr-1 inline h-4 w-4" /> Top Gains
          </TabsTrigger>
          <TabsTrigger value="casino">
            <Building2 className="mr-1 inline h-4 w-4" /> Gains du Casino
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wealth">
          <Ranking entries={wealth.data} suffix="VC" />
        </TabsContent>
        <TabsContent value="gains">
          <Ranking entries={gains.data} suffix="VC" />
        </TabsContent>
        <TabsContent value="casino">
          <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
            <Building2 className="h-12 w-12 text-loss" />
            <p className="text-sm text-muted-foreground">Gains nets du casino (pertes des joueurs)</p>
            <p className="font-mono text-5xl font-bold text-loss">
              {formatVC(casino.data?.totalEarnings ?? 0)} VC
            </p>
            <div className="mt-4 grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total misé</p>
                <p className="font-mono font-bold">{formatVC(casino.data?.totalWagered ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total redistribué</p>
                <p className="font-mono font-bold">{formatVC(casino.data?.totalPaidOut ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parties</p>
                <p className="font-mono font-bold">{formatVC(casino.data?.roundsPlayed ?? 0)}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
