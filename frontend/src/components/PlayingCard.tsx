import { cn } from '@/lib/utils';

const SUIT: Record<string, { sym: string; red: boolean }> = {
  S: { sym: '♠', red: false },
  C: { sym: '♣', red: false },
  H: { sym: '♥', red: true },
  D: { sym: '♦', red: true },
};

export interface CardData {
  rank: string;
  suit: string;
}

export function PlayingCard({
  card,
  hidden,
  size = 'md',
}: {
  card?: CardData;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims =
    size === 'sm' ? 'h-12 w-8 text-xs' : size === 'lg' ? 'h-24 w-16 text-xl' : 'h-16 w-11 text-sm';

  if (hidden || !card || card.rank === '?') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-indigo-800 to-indigo-950 font-bold text-white/40 shadow',
          dims,
        )}
      >
        ★
      </div>
    );
  }

  const suit = SUIT[card.suit] ?? { sym: '?', red: false };
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-black/10 bg-white font-bold shadow',
        dims,
        suit.red ? 'text-rose-600' : 'text-zinc-900',
      )}
    >
      <span className="leading-none">{card.rank}</span>
      <span className="leading-none">{suit.sym}</span>
    </div>
  );
}

export function CardRow({ cards, size }: { cards: CardData[]; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="flex gap-1">
      {cards.map((c, i) => (
        <PlayingCard key={i} card={c} hidden={c.rank === '?'} size={size} />
      ))}
    </div>
  );
}
