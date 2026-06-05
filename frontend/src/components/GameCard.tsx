import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GameCard({
  to,
  title,
  description,
  icon: Icon,
  accent,
  tag,
}: {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  tag?: string;
}) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -4 }}
        className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-6 shadow-card"
      >
        <div
          className={cn('absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40', accent)}
        />
        <Icon className="relative h-9 w-9 text-gold" />
        <div className="relative mt-4 flex items-center gap-2">
          <h3 className="text-lg font-bold">{title}</h3>
          {tag && (
            <span className="rounded-full bg-win/15 px-2 py-0.5 text-[10px] font-semibold text-win">
              {tag}
            </span>
          )}
        </div>
        <p className="relative mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="relative mt-4 text-sm font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
          Jouer →
        </p>
      </motion.div>
    </Link>
  );
}
