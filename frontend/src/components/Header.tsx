import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Settings, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/useAuth';
import { AnimatedBalance } from './AnimatedBalance';
import { RankBadge } from './RankBadge';
import { NotificationBell } from './NotificationBell';

const NAV = [
  { to: '/lobby', label: 'Lobby' },
  { to: '/roulette', label: 'Roulette' },
  { to: '/blackjack', label: 'Blackjack' },
  { to: '/poker', label: 'Poker' },
  { to: '/leaderboard', label: 'Classement' },
  { to: '/loans', label: 'Banque' },
  { to: '/referral', label: 'Parrainage' },
];

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);

  const onLogout = () => {
    logout.mutate();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link to="/lobby" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight gold-text">VELORIA</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-surface-raised text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <Link
              to="/loans"
              className="hidden rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5 sm:block"
              title="Votre solde"
            >
              <AnimatedBalance value={user.balance} />
            </Link>
          )}
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-sm font-bold text-black">
                {user?.username.slice(0, 1).toUpperCase()}
              </div>
              {user && <RankBadge rank={user.rank} className="hidden md:inline-flex" />}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl glass py-1 shadow-card">
                  <p className="truncate px-4 py-2 text-sm font-semibold">{user?.username}</p>
                  <Link
                    to={`/profile/${user?.username}`}
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <User className="h-4 w-4" /> Profil
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" /> Paramètres
                  </Link>
                  <button
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-loss hover:bg-white/5"
                  >
                    <LogOut className="h-4 w-4" /> Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-surface-raised lg:hidden"
            onClick={() => setMobile((m) => !m)}
            aria-label="Menu"
          >
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobile && (
        <nav className="border-t border-white/5 lg:hidden">
          <div className="container grid grid-cols-2 gap-1 py-3">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setMobile(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-surface-raised text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
