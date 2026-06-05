import { Dice5, Spade, Club, Users, Building2 } from 'lucide-react';
import { GameCard } from '@/components/GameCard';
import { HotStreakFeed } from '@/components/HotStreakFeed';
import { LeaderboardPanel } from '@/components/LeaderboardPanel';
import { AnimatedBalance } from '@/components/AnimatedBalance';
import { useLobby } from '@/hooks/useLobby';
import { useAuthStore } from '@/store/auth';
import { formatVC } from '@/lib/utils';

export default function Lobby() {
  const { online, streaks, casino, wealth, gains } = useLobby();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Bonjour, {user?.username} 👋</h1>
            <p className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-win" />
                {online} joueur{online > 1 ? 's' : ''} en ligne
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground">Votre solde</p>
            <AnimatedBalance value={user?.balance ?? 0} className="text-lg" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <GameCard to="/roulette" title="Roulette" description="Européenne, multijoueur, mode plein écran." icon={Dice5} accent="bg-roulette-red" tag="LIVE" />
          <GameCard to="/blackjack" title="Blackjack" description="Tables 2-6, règles Vegas, tour par tour." icon={Spade} accent="bg-win" />
          <GameCard to="/poker" title="Poker" description="Texas Hold'em, 2-9 joueurs, chat & émojis." icon={Club} accent="bg-gold" />
        </div>

        {casino && (
          <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-loss" />
              <div>
                <p className="text-sm font-semibold">Gains du Casino</p>
                <p className="text-xs text-muted-foreground">Total perdu par les joueurs, en direct</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-loss">{formatVC(casino.totalEarnings)} VC</p>
              <p className="text-xs text-muted-foreground">{formatVC(casino.roundsPlayed)} parties jouées</p>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <HotStreakFeed streaks={streaks} />
        <LeaderboardPanel title="Top Richesse" entries={wealth} />
        <LeaderboardPanel title="Top Gains" entries={gains} />
        <div className="card-surface flex items-center gap-3 p-4">
          <Users className="h-5 w-5 text-gold" />
          <p className="text-xs text-muted-foreground">
            Invitez vos amis depuis la page <span className="text-gold">Parrainage</span> et gagnez des VC.
          </p>
        </div>
      </aside>
    </div>
  );
}
