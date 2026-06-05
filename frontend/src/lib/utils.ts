import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const vcFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Format an integer VC amount with French thousands separators. */
export function formatVC(amount: number): string {
  return vcFormatter.format(Math.round(amount));
}

/** Format with the VC suffix, e.g. "12 500 VC". */
export function formatVCSuffixed(amount: number): string {
  return `${formatVC(amount)} VC`;
}

/** Signed amount, e.g. "+1 200" / "-450". */
export function formatSigned(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatVC(Math.abs(amount))}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Whole days remaining until `iso` (can be negative if overdue). */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.round(h / 24);
  return `il y a ${d}j`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}
