import { useMemo, useState } from 'react';
import { Expand, Minimize2, RotateCcw, Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouletteWheel, ResultChip } from '@/components/roulette/RouletteWheel';
import { RouletteBoard, type CellBet } from '@/components/roulette/RouletteBoard';
import { useRoulette } from '@/hooks/useRoulette';
import { useAuthStore } from '@/store/auth';
import { colorOf } from '@/lib/roulette';
import { cn, formatVC } from '@/lib/utils';
import type { RouletteBetType } from '@/types';

const CHIPS = [10, 25, 50, 100, 500];
const CHIP_COLORS: Record<number, string> = {
  10: 'bg-sky-500',
  25: 'bg-emerald-500',
  50: 'bg-orange-500',
  100: 'bg-rose-500',
  500: 'bg-purple-500',
};

interface PendingEntry {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
}

function HistoryStrip({ history }: { history: number[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {history.slice(0, 20).map((n, i) => {
        const c = colorOf(n);
        return (
          <span
            key={i}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white',
              c === 'GREEN' ? 'bg-roulette-green' : c === 'RED' ? 'bg-roulette-red' : 'bg-roulette-black',
            )}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}

export default function Roulette() {
  const r = useRoulette();
  const user = useAuthStore((s) => s.user);
  const [chip, setChip] = useState(25);
  const [pending, setPending] = useState<Record<string, PendingEntry>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [tableTimer, setTableTimer] = useState(15);

  const pendingAmounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(pending)) out[k] = v.amount;
    return out;
  }, [pending]);
  const pendingTotal = useMemo(
    () => Object.values(pending).reduce((s, b) => s + b.amount, 0),
    [pending],
  );

  const onCell = (bet: CellBet) => {
    if (r.phase !== 'BETTING') return;
    setPending((p) => {
      const existing = p[bet.key];
      return {
        ...p,
        [bet.key]: {
          type: bet.type,
          numbers: bet.numbers,
          amount: (existing?.amount ?? 0) + chip,
        },
      };
    });
  };

  const confirm = () => {
    const bets = Object.values(pending).map((b) => ({
      type: b.type,
      numbers: b.numbers,
      amount: b.amount,
    }));
    if (bets.length) r.placeBets(bets);
    setPending({});
  };

  const clearAll = () => {
    setPending({});
    r.clearBets();
  };

  const phaseLabel =
    r.phase === 'BETTING' ? 'Faites vos jeux' : r.phase === 'SPINNING' ? 'Rien ne va plus' : 'Résultat';
  const seconds = Math.ceil(r.timer / 1000);

  // ---- Full-screen "Mode Table Réelle" ----
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background p-6">
        <button
          onClick={() => setFullscreen(false)}
          className="absolute right-6 top-6 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
        >
          <Minimize2 className="h-4 w-4" /> Quitter
        </button>
        <p className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
          {phaseLabel}
        </p>
        <RouletteWheel target={r.target} spinNonce={r.spinNonce} size={460} />
        {r.result ? (
          <div className="flex items-center gap-3">
            <ResultChip number={r.result.number} />
            <span className="text-2xl font-bold">{r.result.number}</span>
          </div>
        ) : (
          <div className="font-mono text-5xl font-bold tabular-nums">{seconds}s</div>
        )}
        <div className="flex items-center gap-3">
          {[15, 30, 60].map((t) => (
            <button
              key={t}
              onClick={() => setTableTimer(t)}
              className={cn('rounded-lg px-4 py-2 text-sm', tableTimer === t ? 'bg-gold text-black' : 'bg-surface')}
            >
              {t}s
            </button>
          ))}
          <Button size="lg" disabled={r.phase !== 'BETTING'} onClick={r.requestSpin}>
            Lancer la bille
          </Button>
        </div>
        <div className="mt-2"><HistoryStrip history={r.history} /></div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Roulette Européenne</h1>
            <p className="text-sm text-muted-foreground">
              {r.players} joueur(s) à la table · {phaseLabel}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setFullscreen(true)}>
            <Expand className="h-4 w-4" /> Mode Table Réelle
          </Button>
        </div>

        <div className="card-surface flex flex-col items-center gap-4 p-6">
          <div className="flex w-full items-center justify-between">
            <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {phaseLabel}
            </span>
            <span className="font-mono text-xl font-bold tabular-nums text-gold">{seconds}s</span>
          </div>
          <RouletteWheel target={r.target} spinNonce={r.spinNonce} />
          {r.result && (
            <div className="flex items-center gap-2">
              <ResultChip number={r.result.number} />
              {r.lastPayout && (
                <span className={cn('font-bold', r.lastPayout.net >= 0 ? 'text-win' : 'text-loss')}>
                  {r.lastPayout.net >= 0 ? '+' : ''}
                  {formatVC(r.lastPayout.net)} VC
                </span>
              )}
            </div>
          )}
        </div>

        <div className="card-surface p-4">
          <RouletteBoard
            onCell={onCell}
            pending={pendingAmounts}
            winning={r.result?.number ?? null}
            disabled={r.phase !== 'BETTING'}
          />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">Solde</p>
          <p className="font-mono text-xl font-bold text-gold">{formatVC(user?.balance ?? 0)} VC</p>
        </div>

        <div className="card-surface p-4">
          <p className="mb-2 text-sm font-semibold">Jeton</p>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={cn(
                  'chip text-white',
                  CHIP_COLORS[c],
                  chip === c && 'scale-110 ring-gold',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mises en attente</span>
            <span className="font-mono font-bold">{formatVC(pendingTotal)} VC</span>
          </div>
          {r.stake > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mises validées</span>
              <span className="font-mono font-bold text-win">{formatVC(r.stake)} VC</span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={clearAll} disabled={r.phase !== 'BETTING'}>
              <RotateCcw className="h-4 w-4" /> Effacer
            </Button>
            <Button onClick={confirm} disabled={r.phase !== 'BETTING' || pendingTotal === 0}>
              <Check className="h-4 w-4" /> Valider
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Coins className="h-3 w-3" /> Cliquez un numéro / une case puis « Valider ».
          </p>
        </div>

        <div className="card-surface p-4">
          <p className="mb-2 text-sm font-semibold">20 derniers résultats</p>
          <HistoryStrip history={r.history} />
        </div>
      </aside>
    </div>
  );
}
