import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-extrabold gold-text">404</p>
      <p className="text-muted-foreground">Cette page n'existe pas.</p>
      <Link to="/lobby">
        <Button>Retour au lobby</Button>
      </Link>
    </div>
  );
}
