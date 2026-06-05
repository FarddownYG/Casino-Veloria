import { useState } from 'react';
import { Info, X } from 'lucide-react';

const DISCLAIMER =
  "VELORIA est un jeu de divertissement utilisant exclusivement de la monnaie virtuelle. " +
  'Aucune valeur réelle. Jouer ne constitue pas du jeu d’argent au sens légal. ' +
  'VELORIA ne saurait être tenu responsable d’une assimilation à des pratiques de jeu réel.';

/** Permanent legal disclaimer banner shown under the header. */
export function DisclaimerBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="border-b border-gold/15 bg-gold/[0.06]">
      <div className="container flex items-center gap-3 py-2">
        <Info className="h-4 w-4 shrink-0 text-gold" />
        <p className="flex-1 text-[11px] leading-snug text-gold/90 sm:text-xs">{DISCLAIMER}</p>
        <button
          aria-label="Masquer"
          onClick={() => setOpen(false)}
          className="text-gold/60 transition-colors hover:text-gold"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
