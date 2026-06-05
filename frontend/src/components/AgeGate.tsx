import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasAgeConsent, setAgeConsent } from '@/lib/cookies';
import { api } from '@/lib/api';
import { useIsAuthenticated } from '@/hooks/useAuth';

/**
 * Full-screen, non-bypassable age gate shown on first access.
 * "NON" redirects away from the site; "OUI" sets a 30-day cookie.
 */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean>(() => hasAgeConsent());
  const isAuth = useIsAuthenticated();

  useEffect(() => {
    if (ok && isAuth) {
      api.post('/users/me/age-verification').catch(() => undefined);
    }
  }, [ok, isAuth]);

  if (ok) return <>{children}</>;

  const accept = () => {
    setAgeConsent();
    setOk(true);
  };
  const reject = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1200px 600px at 50% -10%, rgba(245,185,66,0.12), transparent)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-md rounded-2xl glass p-8 text-center shadow-card"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
          <ShieldAlert className="h-8 w-8 text-gold" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight gold-text">VELORIA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Casino de divertissement en monnaie virtuelle
        </p>

        <h2 className="mt-6 text-xl font-semibold">Avez-vous 18 ans ou plus&nbsp;?</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          L'accès à VELORIA est réservé aux personnes majeures. Aucune valeur réelle n'est
          en jeu, mais nous appliquons les bonnes pratiques du secteur.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={reject}>
            Non, j'ai moins de 18 ans
          </Button>
          <Button size="lg" onClick={accept}>
            Oui, j'ai 18 ans ou plus
          </Button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
          En cliquant sur « Oui », un cookie de 30 jours mémorise votre choix.
        </p>
      </motion.div>
    </div>
  );
}
