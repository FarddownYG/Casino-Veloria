import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { formatVC } from '@/lib/utils';
import type { HotStreak } from '@/hooks/useLobby';

export function HotStreakFeed({ streaks }: { streaks: HotStreak[] }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Flame className="h-4 w-4 text-loss" /> Hot streaks
      </div>
      <div className="mt-3 space-y-2">
        <AnimatePresence initial={false}>
          {streaks.length === 0 && (
            <p className="text-xs text-muted-foreground">En attente de gros gains…</p>
          )}
          {streaks.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-sm"
            >
              <span>
                🔥 <span className="font-semibold">{s.username}</span>{' '}
                <span className="text-muted-foreground">· {s.gameType.toLowerCase()}</span>
              </span>
              <span className="font-mono font-bold text-win">+{formatVC(s.amount)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
