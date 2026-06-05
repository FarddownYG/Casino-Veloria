import { Crown } from 'lucide-react';
import { cn, formatVC } from '@/lib/utils';
import type { LbEntry } from '@/hooks/useLobby';

const MEDAL = ['text-gold', 'text-silver', 'text-bronze'];

export function LeaderboardPanel({
  title,
  entries,
  suffix = 'VC',
}: {
  title: string;
  entries: LbEntry[];
  suffix?: string;
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Crown className="h-4 w-4 text-gold" /> {title}
      </div>
      <div className="mt-3 space-y-1">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune donnée pour le moment.</p>
        )}
        {entries.slice(0, 10).map((e) => (
          <div
            key={e.username}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
          >
            <span className={cn('w-5 text-center font-bold', MEDAL[e.rank - 1] ?? 'text-muted-foreground')}>
              {e.rank}
            </span>
            <span className="flex-1 truncate">{e.username}</span>
            <span className="font-mono font-semibold text-gold">
              {formatVC(e.value)} {suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
