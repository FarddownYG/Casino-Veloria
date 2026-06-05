import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { cn, formatVC } from '@/lib/utils';

/** Rolling-digit balance counter. */
export function AnimatedBalance({
  value,
  className,
  showIcon = true,
}: {
  value: number;
  className?: string;
  showIcon?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 700;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value]);

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono font-bold tabular-nums', className)}>
      {showIcon && <Coins className="h-4 w-4 text-gold" />}
      {formatVC(display)}
      <span className="text-xs font-semibold text-gold/80">VC</span>
    </span>
  );
}
