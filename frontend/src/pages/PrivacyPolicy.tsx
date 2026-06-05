import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-3xl font-bold gold-text">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {new Date().getFullYear()}</p>

      <div className="prose-invert mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Nature du service</h2>
          <p>
            VELORIA est un jeu de divertissement utilisant exclusivement de la monnaie virtuelle
            (VELORIA COINS). Aucune valeur réelle n'est en jeu. Jouer ne constitue pas du jeu
            d'argent au sens légal. VELORIA ne saurait être tenu responsable d'une assimilation à
            des pratiques de jeu réel.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Données collectées</h2>
          <p>
            Nous appliquons le principe de minimisation : seules sont collectées votre adresse
            email, votre pseudonyme et une empreinte (hash) de votre mot de passe. Aucune donnée
            bancaire n'est jamais demandée.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Cookies</h2>
          <p>
            Un cookie strictement nécessaire mémorise votre confirmation d'âge (30 jours). Les
            cookies de mesure d'audience sont optionnels et soumis à votre consentement.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et
            d'effacement. La suppression de votre compte (depuis les Paramètres) anonymise
            immédiatement vos données personnelles.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Âge minimum</h2>
          <p>L'accès est réservé aux personnes âgées de 18 ans ou plus.</p>
        </section>
      </div>
    </div>
  );
}
