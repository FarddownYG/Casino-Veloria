import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useConsentStore } from '@/store/consent';

/** RGPD cookie consent banner with per-category control. */
export function CookieConsent() {
  const { decided, acceptAll, refuseOptional, save } = useConsentStore();
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  return (
    <AnimatePresence>
      {!decided && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed bottom-0 left-0 right-0 z-[70] p-4"
        >
          <div className="container max-w-3xl rounded-2xl glass p-5 shadow-card">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">Gestion des cookies</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nous utilisons des cookies strictement nécessaires au fonctionnement du site.
                  Les cookies de mesure d'audience sont optionnels. Voir notre{' '}
                  <Link to="/privacy" className="text-gold underline-offset-2 hover:underline">
                    politique de confidentialité
                  </Link>
                  .
                </p>

                {customize && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">Nécessaires</p>
                        <p className="text-[11px] text-muted-foreground">Toujours actifs</p>
                      </div>
                      <Switch checked disabled onCheckedChange={() => {}} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">Mesure d'audience</p>
                        <p className="text-[11px] text-muted-foreground">Statistiques anonymes</p>
                      </div>
                      <Switch checked={analytics} onCheckedChange={setAnalytics} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {customize ? (
                <Button size="sm" onClick={() => save(analytics)}>
                  Enregistrer mes choix
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setCustomize(true)}>
                  Personnaliser
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={refuseOptional}>
                Tout refuser
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Tout accepter
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
