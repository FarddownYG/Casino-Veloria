import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export function Avatar({
  username,
  size = 'md',
  className,
}: {
  username: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // Deterministic hue from username so each player has a stable color.
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/10',
        SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 60% 45%), hsl(${(hue + 40) % 360} 60% 35%))`,
      }}
      title={username}
    >
      {getInitials(username)}
    </div>
  );
}
