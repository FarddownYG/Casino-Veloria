import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, Dice5, Spade, TrendingUp, Users, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { useIsAuthenticated } from '@/hooks/useAuth';

const FEATURES = [
  { icon: Dice5, title: 'Roulette multijoueur', desc: 'Roulette européenne en temps réel + mode plein écran "Table Réelle".' },
  { icon: Spade, title: 'Blackjack & Poker', desc: 'Créez vos tables, jouez à 2-9, tour par tour anti-triche.' },
  { icon: TrendingUp, title: 'Classements live', desc: 'Top richesse, top gains et gains du casino en direct.' },
  { icon: Coins, title: 'Prêts & dons', desc: 'Prêt banque, prêts entre joueurs négociables, dons directs.' },
  { icon: Users, title: 'Parrainage', desc: 'Invitez vos amis, gagnez des VELORIA COINS ensemble.' },
  { icon: ShieldCheck, title: '100% virtuel', desc: 'Monnaie fictive, aucune valeur réelle, conçu pour le fun.' },
];

export default function Landing() {
  const isAuth = useIsAuthenticated();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight gold-text">VELORIA</span>
          <div className="flex gap-2">
            {isAuth ? (
              <Link to="/lobby"><Button>Entrer dans le lobby</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost">Connexion</Button></Link>
                <Link to="/register"><Button>Créer un compte</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <DisclaimerBanner />

      <section className="container flex flex-col items-center py-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          Le casino <span className="gold-text">fun</span> en monnaie virtuelle
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 max-w-xl text-muted-foreground"
        >
          Roulette, blackjack et poker multijoueurs. 1 000 VELORIA COINS offerts à
          l'inscription. Zéro argent réel, 100% de sensations.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex gap-3"
        >
          <Link to={isAuth ? '/lobby' : '/register'}>
            <Button size="lg" className="animate-pulse-glow">
              {isAuth ? 'Jouer maintenant' : 'Jouer gratuitement'}
            </Button>
          </Link>
          <Link to="/leaderboard"><Button size="lg" variant="secondary">Voir le classement</Button></Link>
        </motion.div>
      </section>

      <section className="container grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="card-surface p-6"
          >
            <f.icon className="h-7 w-7 text-gold" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
