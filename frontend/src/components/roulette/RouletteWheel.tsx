import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { WHEEL_ORDER, colorOf } from '@/lib/roulette';
import { cn } from '@/lib/utils';

const SIZE = 320;

function pocketColorHex(n: number): string {
  const c = colorOf(n);
  return c === 'GREEN' ? '#1fa055' : c === 'RED' ? '#d4143a' : '#1a1d27';
}

/**
 * CSS/framer-motion roulette wheel. When `spinNonce` changes it spins to bring
 * `target` under the top pointer. The result is decided server-side; this is
 * purely the visual.
 */
export function RouletteWheel({
  target,
  spinNonce,
  size = SIZE,
}: {
  target: number | null;
  spinNonce: number;
  size?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);

  useEffect(() => {
    if (spinNonce === 0 || target == null) return;
    const idx = WHEEL_ORDER.indexOf(target);
    const pocketAngle = (idx / WHEEL_ORDER.length) * 360;
    // Spin several full turns then align the target pocket to the top (0deg).
    const base = rotationRef.current;
    const current = ((base % 360) + 360) % 360;
    const desired = (360 - pocketAngle) % 360;
    const delta = ((desired - current + 360) % 360) + 360 * 6;
    const next = base + delta;
    rotationRef.current = next;
    setRotation(next);
  }, [spinNonce, target]);

  const r = size / 2 - 18;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* pointer */}
      <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-gold drop-shadow" />
      </div>

      <div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: '0 0 0 8px #2a2118, 0 0 40px -8px rgba(245,185,66,0.5)' }}
      />

      <motion.div
        className="absolute inset-0 rounded-full bg-[#0c0e14]"
        animate={{ rotate: rotation }}
        transition={{ duration: 5.5, ease: [0.12, 0.66, 0.16, 1] }}
        style={{ border: '6px solid #2a2118' }}
      >
        {WHEEL_ORDER.map((n, i) => {
          const angle = (i / WHEEL_ORDER.length) * 360;
          return (
            <div
              key={n}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `rotate(${angle}deg) translateY(-${r}px)` }}
            >
              <div
                className="flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: pocketColorHex(n), transform: `rotate(${-angle}deg)` }}
              >
                {n}
              </div>
            </div>
          );
        })}
        <div className="absolute inset-[28%] rounded-full bg-gradient-to-br from-[#2a2118] to-[#0c0e14] ring-2 ring-gold/30" />
      </motion.div>
    </div>
  );
}

export function ResultChip({ number }: { number: number }) {
  return (
    <div
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ring-2 ring-white/20',
      )}
      style={{ background: pocketColorHex(number) }}
    >
      {number}
    </div>
  );
}
