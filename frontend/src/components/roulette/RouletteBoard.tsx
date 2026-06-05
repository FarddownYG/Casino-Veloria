import { cn } from '@/lib/utils';
import {
  BOARD_ROWS,
  colorOf,
  columnNumbers,
  dozenNumbers,
  numbersForOutside,
} from '@/lib/roulette';
import type { RouletteBetType } from '@/types';

export interface CellBet {
  key: string;
  type: RouletteBetType;
  numbers: number[];
}

function numColor(n: number): string {
  const c = colorOf(n);
  return c === 'GREEN' ? 'bg-roulette-green' : c === 'RED' ? 'bg-roulette-red' : 'bg-roulette-black';
}

function Chip({ amount }: { amount: number }) {
  if (!amount) return null;
  return (
    <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-black ring-2 ring-background">
      {amount}
    </span>
  );
}

export function RouletteBoard({
  onCell,
  pending,
  winning,
  disabled,
}: {
  onCell: (bet: CellBet) => void;
  pending: Record<string, number>;
  winning: number | null;
  disabled?: boolean;
}) {
  const cell = (key: string, type: RouletteBetType, numbers: number[]) => ({
    onClick: () => !disabled && onCell({ key, type, numbers }),
  });

  return (
    <div className="select-none">
      <div className="flex gap-1">
        {/* Zero */}
        <button
          {...cell('S0', 'STRAIGHT', [0])}
          className={cn(
            'relative flex w-10 items-center justify-center rounded-md bg-roulette-green font-bold text-white',
            winning === 0 && 'ring-2 ring-gold',
          )}
        >
          0
          <Chip amount={pending['S0']} />
        </button>

        <div className="flex-1">
          <div className="grid grid-rows-3 gap-1">
            {BOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-12 gap-1">
                {row.map((n) => (
                  <button
                    key={n}
                    {...cell(`S${n}`, 'STRAIGHT', [n])}
                    className={cn(
                      'relative flex h-9 items-center justify-center rounded-md text-sm font-bold text-white transition-transform hover:scale-105',
                      numColor(n),
                      winning === n && 'ring-2 ring-gold',
                    )}
                  >
                    {n}
                    <Chip amount={pending[`S${n}`]} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Columns 2:1 */}
        <div className="grid grid-rows-3 gap-1">
          {[2, 1, 0].map((c) => (
            <button
              key={c}
              {...cell(`C${c}`, 'COLUMN', columnNumbers(c as 0 | 1 | 2))}
              className="relative flex w-12 items-center justify-center rounded-md bg-surface-raised text-xs font-semibold hover:bg-white/10"
            >
              2:1
              <Chip amount={pending[`C${c}`]} />
            </button>
          ))}
        </div>
      </div>

      {/* Dozens */}
      <div className="mt-1 grid grid-cols-3 gap-1 pl-11 pr-[52px]">
        {(['1ère 12', '2e 12', '3e 12'] as const).map((label, i) => (
          <button
            key={i}
            {...cell(`D${i}`, 'DOZEN', dozenNumbers(i as 0 | 1 | 2))}
            className="relative flex h-9 items-center justify-center rounded-md bg-surface-raised text-xs font-semibold hover:bg-white/10"
          >
            {label}
            <Chip amount={pending[`D${i}`]} />
          </button>
        ))}
      </div>

      {/* Outside even-money */}
      <div className="mt-1 grid grid-cols-6 gap-1 pl-11 pr-[52px]">
        <OutsideBtn label="1-18" k="LOW" type="LOW" pending={pending} cell={cell} />
        <OutsideBtn label="Pair" k="EVEN" type="EVEN" pending={pending} cell={cell} />
        <button
          {...cell('RED', 'RED', numbersForOutside('RED'))}
          className="relative flex h-9 items-center justify-center rounded-md bg-roulette-red text-xs font-bold text-white hover:brightness-110"
        >
          Rouge
          <Chip amount={pending['RED']} />
        </button>
        <button
          {...cell('BLACK', 'BLACK', numbersForOutside('BLACK'))}
          className="relative flex h-9 items-center justify-center rounded-md bg-roulette-black text-xs font-bold text-white hover:brightness-125"
        >
          Noir
          <Chip amount={pending['BLACK']} />
        </button>
        <OutsideBtn label="Impair" k="ODD" type="ODD" pending={pending} cell={cell} />
        <OutsideBtn label="19-36" k="HIGH" type="HIGH" pending={pending} cell={cell} />
      </div>
    </div>
  );
}

function OutsideBtn({
  label,
  k,
  type,
  pending,
  cell,
}: {
  label: string;
  k: string;
  type: RouletteBetType;
  pending: Record<string, number>;
  cell: (key: string, type: RouletteBetType, numbers: number[]) => { onClick: () => void };
}) {
  return (
    <button
      {...cell(k, type, numbersForOutside(type))}
      className="relative flex h-9 items-center justify-center rounded-md bg-surface-raised text-xs font-semibold hover:bg-white/10"
    >
      {label}
      <Chip amount={pending[k]} />
    </button>
  );
}
