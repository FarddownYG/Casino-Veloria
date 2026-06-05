import type { Rank } from '@/types';

export interface RankMeta {
  label: string;
  /** Tailwind text color class. */
  text: string;
  /** Tailwind border color class. */
  border: string;
  /** Hex used for glows / gradients. */
  hex: string;
  glow: string;
}

export const RANK_META: Record<Rank, RankMeta> = {
  BRONZE: {
    label: 'Bronze',
    text: 'text-bronze',
    border: 'border-bronze/50',
    hex: '#cd7f32',
    glow: 'shadow-[0_0_14px_-4px_rgba(205,127,50,0.6)]',
  },
  SILVER: {
    label: 'Argent',
    text: 'text-silver',
    border: 'border-silver/50',
    hex: '#c0c7d4',
    glow: 'shadow-[0_0_14px_-4px_rgba(192,199,212,0.6)]',
  },
  GOLD: {
    label: 'Or',
    text: 'text-gold',
    border: 'border-gold/50',
    hex: '#f5b942',
    glow: 'shadow-[0_0_14px_-4px_rgba(245,185,66,0.7)]',
  },
  DIAMOND: {
    label: 'Diamant',
    text: 'text-diamond',
    border: 'border-diamond/50',
    hex: '#7be3ff',
    glow: 'shadow-[0_0_16px_-4px_rgba(123,227,255,0.75)]',
  },
};

export const RANK_ORDER: Rank[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
