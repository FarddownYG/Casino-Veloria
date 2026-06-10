import { useState } from 'react';
import { ArrowLeft, Plus, Users, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateTableDialog } from '@/components/CreateTableDialog';
import { CardRow, PlayingCard } from '@/components/PlayingCard';
import { useTables } from '@/hooks/useTables';
import { usePoker, type PKMove } from '@/hooks/usePoker';
import { useAuthStore } from '@/store/auth';
import { cn, formatVC } from '@/lib/utils';

const EMOJIS = ['😀', '😎', '😡', '😭', '🔥', '💰', '🤝', '👏'];

export default function Poker() {
  const [tableId, setTableId] = useState<string | null>(null);
  const [buyIn, setBuyIn] = useState<number | null>(null);
  if (tableId && buyIn)
    return (
      <PokerTable
        tableId={tableId}
        buyIn={buyIn}
        onLeave={() => {
          setTableId(null);
          setBuyIn(null);
        }}
      />
    );
  return <PokerLobby onJoin={(id, b) => { setTableId(id); setBuyIn(b); }} />;
}

function PokerLobby({ onJoin }: { onJoin: (id: string, buyIn: number) => void }) {
  const { data: tables, isLoading } = useTables('POKER');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [buyInValue, setBuyInValue] = useState(1000);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Poker — Texas Hold'em</h1>
          <p className="text-sm text-muted-foreground">2 à 9 joueurs · blinds configurables</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Créer une table
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {tables && tables.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Aucune table. Créez-en une — elle se supprime seule après 3 min vide.
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
              Blind {formatVC(Math.max(1, Math.floor(t.minBet / 2)))} / {formatVC(t.minBet)}
            </p>
            {pendingId === t.id ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={buyInValue}
                  onChange={(e) => setBuyInValue(+e.target.value)}
                  min={t.minBet * 10}
                />
                <Button size="sm" onClick={() => onJoin(t.id, buyInValue)}>
                  OK
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="mt-1"
                disabled={t.seated >= t.maxSeats}
                onClick={() => {
                  setPendingId(t.id);
                  setBuyInValue(t.minBet * 50);
                }}
              >
                Rejoindre (cave)
              </Button>
            )}
          </div>
        ))}
      </div>

      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        type="POKER"
        // Buy in with at least the table's minimum (minBet*10), never below it.
        onCreated={(t) => onJoin(t.id, Math.max(1000, t.minBet * 10))}
      />
    </div>
  );
}

function PokerTable({
  tableId,
  buyIn,
  onLeave,
}: {
  tableId: string;
  buyIn: number;
  onLeave: () => void;
}) {
  const { state, hole, chat, showdown, act, sendChat, react, leave } = usePoker(tableId, buyIn);
  const user = useAuthStore((s) => s.user);
  const [msg, setMsg] = useState('');
  const [raise, setRaise] = useState(0);

  const me = state?.seats.find((s) => s.userId === user?.id);
  const isMyTurn = state?.activeUserId === user?.id;
  const toCall = state ? Math.max(0, state.currentBet - (me?.streetBet ?? 0)) : 0;

  const handleLeave = () => {
    leave();
    onLeave();
  };
  const send = (move: PKMove, amount?: number) => act(move, amount);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleLeave}>
            <ArrowLeft className="h-4 w-4" /> Quitter (cash-out)
          </Button>
          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold uppercase">
            {state?.phase ?? 'Connexion…'}
          </span>
        </div>

        <div className="relative rounded-[40%] bg-felt p-10 shadow-card">
          {/* pot + board */}
          <div className="flex flex-col items-center gap-3">
            <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-gold">
              Pot : {formatVC(state?.pot ?? 0)} VC
            </span>
            <div className="flex gap-1">
              {(state?.board ?? []).map((c, i) => (
                <PlayingCard key={i} card={c} size="md" />
              ))}
              {Array.from({ length: Math.max(0, 5 - (state?.board.length ?? 0)) }).map((_, i) => (
                <div key={`ph${i}`} className="h-16 w-11 rounded-md border border-dashed border-white/15" />
              ))}
            </div>
          </div>

          {/* seats */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {state?.seats.map((s) => {
              const active = state.activeUserId === s.userId;
              return (
                <div
                  key={s.userId}
                  className={cn(
                    'flex w-32 flex-col items-center gap-1 rounded-xl bg-black/30 p-2 text-center',
                    active && 'ring-2 ring-gold',
                    s.folded && 'opacity-40',
                  )}
                >
                  <span className={cn('truncate text-sm font-semibold', s.userId === user?.id ? 'text-gold' : 'text-white')}>
                    {s.username} {s.seat === state.buttonSeat && '🔘'}
                  </span>
                  <span className="text-xs text-white/70">{formatVC(s.stack)} VC</span>
                  {s.streetBet > 0 && (
                    <span className="text-[11px] text-gold">mise {formatVC(s.streetBet)}</span>
                  )}
                  {s.allIn && <span className="text-[10px] font-bold text-loss">ALL-IN</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* my hole + actions */}
        <div className="card-surface p-4">
          <div className="mb-3 flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Vos cartes</p>
              <div className="mt-1">
                {hole.length ? <CardRow cards={hole} /> : <p className="text-xs text-muted-foreground">—</p>}
              </div>
            </div>
            {showdown && (
              <div className="text-sm">
                <p className="font-semibold text-gold">Abattage</p>
                <p className="text-muted-foreground">
                  Gagnant : {showdown.winners.map((w) => w.username).join(', ')} (+{formatVC(showdown.pot)})
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!isMyTurn} onClick={() => send('FOLD')}>
              Se coucher
            </Button>
            {toCall === 0 ? (
              <Button disabled={!isMyTurn} onClick={() => send('CHECK')}>
                Checker
              </Button>
            ) : (
              <Button disabled={!isMyTurn} onClick={() => send('CALL')}>
                Suivre {formatVC(toCall)}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-28"
                value={raise || (state ? state.currentBet + state.blinds.big : 0)}
                onChange={(e) => setRaise(+e.target.value)}
                disabled={!isMyTurn}
              />
              <Button
                variant="outline"
                disabled={!isMyTurn}
                onClick={() => send('RAISE', raise || (state ? state.currentBet + state.blinds.big : 0))}
              >
                Relancer
              </Button>
            </div>
            <Button variant="destructive" disabled={!isMyTurn} onClick={() => send('ALLIN')}>
              All-in
            </Button>
          </div>
        </div>
      </div>

      {/* chat + reactions */}
      <aside className="card-surface flex h-[520px] flex-col p-3">
        <p className="mb-2 text-sm font-semibold">Table chat</p>
        <div className="flex-1 space-y-1 overflow-y-auto text-sm">
          {chat.map((c, i) => (
            <p key={i}>
              <span className="font-semibold text-gold">{c.username}:</span>{' '}
              <span className="text-muted-foreground">{c.message}</span>
            </p>
          ))}
        </div>
        <div className="my-2 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => react(e)} className="rounded p-1 text-lg hover:bg-white/10">
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (msg.trim()) {
              sendChat(msg.trim());
              setMsg('');
            }
          }}
          className="flex gap-2"
        >
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message…" maxLength={200} />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </aside>
    </div>
  );
}
