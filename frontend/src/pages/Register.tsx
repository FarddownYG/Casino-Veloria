import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useRegister } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/api';

export default function Register() {
  const navigate = useNavigate();
  const register = useRegister();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setRef] = useState(params.get('ref') ?? '');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    register.mutate(
      { email, username, password, referralCode: referralCode || undefined },
      {
        onSuccess: () => navigate('/lobby'),
        onError: (err) => setError(apiErrorMessage(err)),
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl glass p-8 shadow-card">
        <Link to="/" className="block text-center text-2xl font-extrabold gold-text">
          VELORIA
        </Link>
        <h1 className="mt-6 text-xl font-bold">Créer un compte</h1>
        <p className="text-sm text-muted-foreground">
          1 000 VC offerts. {referralCode && '+200 VC avec ce code parrain.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Pseudo</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Mot de passe</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref">Code parrain (optionnel, définitif)</Label>
            <Input id="ref" value={referralCode} onChange={(e) => setRef(e.target.value.toUpperCase())} maxLength={16} />
          </div>
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={register.isPending}>
            {register.isPending ? 'Création…' : "S'inscrire"}
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-muted-foreground">
          En créant un compte vous confirmez avoir 18 ans et acceptez que VELORIA est un jeu
          de divertissement sans valeur réelle.
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-gold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
