import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useUserSocket } from '@/hooks/useUserSocket';

/** Authenticated app shell: realtime user socket + header + disclaimer. */
export function Layout() {
  useUserSocket();
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <DisclaimerBanner />
      <main className="container flex-1 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-white/5 py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} VELORIA — Monnaie virtuelle, aucune valeur réelle.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground">
              Confidentialité
            </a>
            <a href="/settings" className="hover:text-foreground">
              Paramètres
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
