import { useState } from 'react';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateTableDialog } from '@/components/CreateTableDialog';
import { CardRow, PlayingCard } from '@/components/PlayingCard';
import { useTables } from '@/hooks/useTables';
import { useBlackjack } from '@/hooks/useBlackjack';
import { useAuthStore } from '@/store/auth';
import { cn, formatVC } from '@/lib/utils';

const BET_STEPS = [10, 25, 50, 100, 250];

export default function Blackjack() {
  const [tableId, setTableId] = useState<string | null>(null);
  if (tableId) return <BlackjackTable tableId={tableId} onLeave={() => setTableId(null)} />;
  return <BlackjackLobby onJoin={setTableId} />;
}

function BlackjackLobby({ onJoin }: { onJoin: (id: string) => void }) {
  const { data: tables, isLoading } = useTables('BLACKJACK');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blackjack</h1>
          <p className="text-sm text-muted-foreground">Règles Vegas · 2 à 6 joueurs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Créer une table
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {tables && tables.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Aucune table. Créez-en une — elle se supprimera seule après 3 min vide.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables?.map((t) => (
          <div key={t.id} className="card-surface flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t.name}</p>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" /> {t.seated}/{t.maxSeats}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mises {formatVC(t.minBet)}–{formatVC(t.maxBet)} VC {t.host && `· hôte ${t.host}`}
            </p>
            <Button size="sm" className="mt-1" onClick={() => onJoin(t.id)} disabled={t.seated >= t.maxSeats}>
              Rejoindre
            </Button>
          </div>
        ))}
      </div>

      <CreateTableDialog open={createOpen} onOpenChange={setCreateOpen} type="BLACKJACK" onCreated={onJoin} />
    </div>
  );
}

function BlackjackTable({ tableId, onLeave }: { tableId: string; onLeave: () => void }) {
  const { state, bet, action, leave } = useBlackjack(tableId);
  const user = useAuthStore((s) => s.user);
  const [betAmount, setBetAmount] = useState(25);

  const mySeat = state?.seats.find((s) => s.userId === user?.id);
  const isMyTurn = state?.phase === 'PLAYER_TURN' && state.activeUserId === user?.id;
  const myHand = mySeat?.hands[mySeat.activeHand];
  const canDouble = isMyTurn && myHand?.cards.length === 2;
  // Split on equal *value* (10/J/Q/K all count as 10), matching the server
  // engine's canSplit — comparing raw ranks wrongly forbade e.g. K+Q.
  const bjValue = (r?: string) =>
    r === 'A' ? 11 : r === '10' || r === 'J' || r === 'Q' || r === 'K' ? 10 : Number(r);
  const canSplit =
    isMyTurn &&
    myHand?.cards.length === 2 &&
    bjValue(myHand.cards[0]?.rank) === bjValue(myHand.cards[1]?.rank);

  const handleLeave = () => {
    leave();
    onLeave();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleLeave}>
          <ArrowLeft className="h-4 w-4" /> Quitter la table
        </Button>
        <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold uppercase">
          {state?.phase ?? 'Connexion…'} {state?.timer ? `· ${Math.ceil(state.timer / 1000)}s` : ''}
        </span>
      </div>

      <div className="rounded-2xl bg-felt p-6 shadow-card">
        {/* Dealer */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Croupier {state?.dealerValue ? `(${state.dealerValue})` : ''}
          </p>
          <div className="flex gap-1">
            {(state?.dealer ?? []).map((c, i) => (
              <PlayingCard key={i} card={c} hidden={c.rank === '?'} size="lg" />
            ))}
            {!state?.dealer.length && <PlayingCard hidden size="lg" />}
          </div>
        </div>

        {/* Seats */}
        <div className="flex flex-wrap items-end justify-center gap-6">
          {state?.seats.map((s) => {
            const active = state.activeUserId === s.userId && state.phase === 'PLAYER_TURN';
            return (
              <div
                key={s.userId}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl p-3',
                  active && 'bg-gold/10 ring-2 ring-gold',
                )}
              >
                {s.hands.length > 0 ? (
                  s.hands.map((h, hi) => (
                    <div key={hi} className="flex flex-col items-center gap-1">
                      <CardRow cards={h.cards} />
                      <span className="text-xs font-bold text-white">
                        {h.value} {h.status === 'BUST' && '💥'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-16 items-center text-xs text-white/40">
                    {s.hasBet ? `Mise ${s.bet}` : 'En attente'}
                  </div>
                )}
                <span className={cn('text-sm font-semibold', s.userId === user?.id ? 'text-gold' : 'text-white')}>
                  {s.username} {s.userId === user?.id && '(vous)'}
                </span>
                {s.bet > 0 && <span className="text-xs text-white/70">Mise : {formatVC(s.bet)} VC</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="card-surface p-4">
        {state?.phase === 'BETTING' && !mySeat?.hasBet && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">Votre mise :</span>
            {BET_STEPS.map((b) => (
              <button
                key={b}
                onClick={() => setBetAmount(b)}
                className={cn('chip text-white bg-emerald-600', betAmount === b && 'scale-110 ring-gold')}
              >
                {b}
              </button>
            ))}
            <Button onClick={() => bet(betAmount)}>Miser {formatVC(betAmount)} VC</Button>
          </div>
        )}
        {state?.phase === 'BETTING' && mySeat?.hasBet && (
          <p className="text-sm text-win">Mise placée : {formatVC(mySeat.bet)} VC — en attente des autres…</p>
        )}
        {isMyTurn && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => action('HIT')}>Tirer</Button>
            <Button variant="secondary" onClick={() => action('STAND')}>Rester</Button>
            <Button variant="outline" disabled={!canDouble} onClick={() => action('DOUBLE')}>
              Doubler
            </Button>
            <Button variant="outline" disabled={!canSplit} onClick={() => action('SPLIT')}>
              Séparer
            </Button>
          </div>
        )}
        {!mySeat && state && (
          <p className="text-sm text-muted-foreground">
            Vous êtes assis à la table. La prochaine manche démarre automatiquement.
          </p>
        )}
      </div>
    </div>
  );
}
