import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase, PENDING_REF_KEY } from '@/lib/supabase';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import type { AuthResponse } from '@/types';

/**
 * Lands here after the Supabase Google redirect. Exchanges the Supabase session
 * for a VELORIA session via the backend, then routes into the lobby.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const finish = async (session: Session) => {
      if (done.current) return;
      done.current = true;
      try {
        const referralCode = localStorage.getItem(PENDING_REF_KEY) || undefined;
        const { data } = await api.post<AuthResponse>('/auth/google', {
          accessToken: session.access_token,
          referralCode,
        });
        localStorage.removeItem(PENDING_REF_KEY);
        login(data.user, data.accessToken, data.refreshToken);
        await supabase.auth.signOut().catch(() => undefined);
        navigate('/lobby', { replace: true });
      } catch (e) {
        done.current = false;
        setError(apiErrorMessage(e, 'Connexion Google impossible.'));
      }
    };

    let unsub: (() => void) | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        void finish(data.session);
        return;
      }
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) void finish(session);
      });
      unsub = () => sub.subscription.unsubscribe();

      // Fallback if no event fires (e.g. session already settled).
      fallbackTimer = setTimeout(async () => {
        const s = (await supabase.auth.getSession()).data.session;
        if (s) void finish(s);
        else if (!done.current) setError('Aucune session Google détectée.');
      }, 4000);
    })();

    return () => {
      unsub?.();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="text-loss">{error}</p>
          <Link to="/login">
            <Button variant="secondary">Retour à la connexion</Button>
          </Link>
        </>
      ) : (
        <>
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Connexion avec Google…</p>
        </>
      )}
    </div>
  );
}
