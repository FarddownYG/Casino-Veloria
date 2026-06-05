import * as React from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Gift,
  Info,
  Landmark,
  Trophy,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'gain'
  | 'loan'
  | 'gift'
  | 'rank';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ duration = 4500, variant = 'default', ...rest }) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, duration, variant, ...rest }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React (e.g. socket handlers). */
export const toast = {
  show: (args: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) =>
    useToastStore.getState().push(args),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'error' }),
  gain: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'gain' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'default' }),
};

const VARIANT_META: Record<
  ToastVariant,
  { icon: React.ElementType; accent: string; ring: string }
> = {
  default: { icon: Info, accent: 'text-foreground', ring: 'ring-white/10' },
  success: { icon: CheckCircle2, accent: 'text-win', ring: 'ring-win/30' },
  error: { icon: TriangleAlert, accent: 'text-loss', ring: 'ring-loss/30' },
  gain: { icon: Trophy, accent: 'text-win', ring: 'ring-win/40' },
  loan: { icon: Landmark, accent: 'text-gold', ring: 'ring-gold/30' },
  gift: { icon: Gift, accent: 'text-gold', ring: 'ring-gold/30' },
  rank: { icon: Trophy, accent: 'text-diamond', ring: 'ring-diamond/40' },
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const meta = VARIANT_META[item.variant];
  const Icon = meta.icon;

  React.useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl glass p-4 shadow-card ring-1',
        meta.ring,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', meta.accent)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      <button
        aria-label="Fermer"
        onClick={() => dismiss(item.id)}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
