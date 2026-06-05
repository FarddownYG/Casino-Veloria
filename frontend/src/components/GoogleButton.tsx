import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase, PENDING_REF_KEY } from '@/lib/supabase';
import { SUPABASE_ENABLED } from '@/lib/env';
import { toast } from '@/components/ui/toast';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C40.9 36.3 44 30.8 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** "Continue with Google" via Supabase OAuth. Hidden if Supabase isn't configured. */
export function GoogleButton({
  referralCode,
  label = 'Continuer avec Google',
}: {
  referralCode?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  if (!SUPABASE_ENABLED) return null;

  const onClick = async () => {
    setLoading(true);
    if (referralCode) localStorage.setItem(PENDING_REF_KEY, referralCode.toUpperCase());
    else localStorage.removeItem(PENDING_REF_KEY);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error('Connexion Google', error.message);
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="secondary" className="w-full" onClick={onClick} disabled={loading}>
      <GoogleIcon />
      {loading ? 'Redirection…' : label}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-white/10" />
      ou
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
