import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RANK_META } from '@/lib/ranks';
import type { Rank } from '@/types';

export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  const meta = RANK_META[rank];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        meta.text,
        meta.border,
        meta.glow,
        className,
      )}
    >
      <Gem className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
