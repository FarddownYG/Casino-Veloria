import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** When false, clicking the backdrop / pressing Escape won't close it. */
  dismissable?: boolean;
}

interface DialogContextValue {
  onOpenChange: (open: boolean) => void;
  dismissable: boolean;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({ open, onOpenChange, dismissable = true, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogContext.Provider value={{ onOpenChange, dismissable }}>
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => dismissable && onOpenChange(false)}
            />
            {children}
          </motion.div>
        </DialogContext.Provider>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DialogContent({
  className,
  children,
  showClose = true,
}: {
  className?: string;
  children: React.ReactNode;
  showClose?: boolean;
}) {
  const ctx = React.useContext(DialogContext);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      className={cn(
        'relative z-10 w-full max-w-lg overflow-hidden rounded-2xl glass p-6 shadow-card',
        className,
      )}
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 12 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {showClose && ctx?.dismissable && (
        <button
          aria-label="Fermer"
          onClick={() => ctx.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </motion.div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-xl font-bold tracking-tight', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
