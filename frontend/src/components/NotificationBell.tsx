import { useState } from 'react';
import { Bell } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { useNotifications, useMarkNotifications } from '@/hooks/useNotifications';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const { markAll, markRead } = useMarkNotifications();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl glass shadow-card">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-gold hover:underline"
                >
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Aucune notification
                </p>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5',
                    !n.read && 'bg-gold/[0.04]',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
                  </div>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {relativeTime(n.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
