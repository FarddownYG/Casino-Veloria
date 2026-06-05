import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useLogin } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const login = useLogin();
  const [emailOrUsername, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate(
      { emailOrUsername, password },
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
        <h1 className="mt-6 text-xl font-bold">Connexion</h1>
        <p className="text-sm text-muted-foreground">Content de vous revoir !</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="id">Email ou pseudo</Label>
            <Input id="id" value={emailOrUsername} onChange={(e) => setId(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Mot de passe</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
            {login.isPending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-gold hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
