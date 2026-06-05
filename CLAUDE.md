# CLAUDE.md — MÉMOIRE PRINCIPALE

> Ce fichier est ma mémoire persistante entre chaque session.
> Je le lis EN PREMIER à chaque démarrage. Je le mets à jour EN PERMANENCE.
> Ne jamais supprimer ce fichier.

---

## 🎯 OBJECTIF ORIGINAL (complet, mot pour mot)

Demande initiale de l'utilisateur (verbatim) :

> Ok je vais faire un site de faux casino, je veux un site avec, roulette, blackjack, poker bien evidement avec du faux argent, je souhaite pouvoir creer un compte reellement, pour pouvoir avoir du multi joueur, je souhaite que tu t'inspire des plus gros site de gambling qui existe un ui et ux qui fait rester les joueurs avec de la dopamine et tout ce qu'il faut que veux que tu fasse une reel etude profonde, je veux avoir un classement avec les joueurs avec le plus d'argent, je veux que si jamais on tombe a 0€ on puisse recharger le compte avec un bouton faire un prêt a toi devoir quand on peut le faire pour pas que les gens se lasses je veux un vrai site de gambling mais avec du faux argent deplus lors de l'arrivé sur le site je veux un bouton avez vous 18 ans oui non, je veux aussi un rgpd, un message d'arriver qui dit "attnetion vous jouer avec du faux argent on insite pas les gens a jouer au casino je veux vraiement un message qui meviterai tout probleme, ensuite je veux dans le classement "argent gagné par le casino" pour voir combien le casino à reellement touché avec l'argent perdu des gens, ensuite je veux que quand les gens font de pret a la banque il ont 7j pour rembourser sinon ya des interets, je veux aussi pouvoir preter de l'argent ou donné a des collegues (on peut y metter des interet) si c'est un pret les 2 personnes doivent se mettre daccord sur les interets, pour le jeux de la roulette je veux pouvoir mettre un mode roulette seulement plein ecran, genre la roulette peut se mettre en plein ecran (pour pouvoir jouer dans la vrai vie mais avec une roulettre en plein ecran), ensuite pour le blackjack je veux un systeme de table pouvoir en crée et si personne dessus alors elle se supprimes, ensuite je veux aussi un system de parainage mais une fois le code mis on ne peut pas l'enlever

Cadre complet (résumé du brief « VELORIA ») : casino multijoueur en **fausse monnaie** (VELORIA COINS), stack imposée React/Vite + NestJS + PostgreSQL + Redis + Socket.io, déployable Supabase + Vercel. Légal prioritaire (age gate 18+, disclaimer, RGPD). Auth + 1000 VC offerts. Économie interne (prêt banque 7j puis +10%/j, prêts P2P négociables, dons 5000 VC/j). Parrainage code irréversible. Classements (richesse, gains, **gains du casino**). Jeux : roulette (mode plein écran « Table Réelle »), blackjack (tables auto-supprimées si vides 3 min), poker Texas Hold'em. UI/UX dopamine.

Objectifs ajoutés en cours de route :
1. Connexion Google via Supabase (« ajoute a supabase, et donc au site la connection avec google »).
2. Faire fonctionner réellement le site déployé (le backend n'est pas hébergé → erreurs réseau en production).

---

## 📋 PLAN D'ACTION GLOBAL

- [x] Étape 1 : Backend NestJS complet (auth, économie, prêts, parrainage, leaderboard, notifications, jeux) + 108 tests
- [x] Étape 2 : Frontend React/Vite complet (toutes les pages, design dopamine, légal/RGPD)
- [x] Étape 3 : Schéma Prisma + migrations + seed (5 users)
- [x] Étape 4 : Déploiement frontend Vercel (CI verte)
- [x] Étape 5 : Connexion Google via Supabase (code complet, mergé sur main)
- [ ] Étape 6 : **Activer le provider Google dans le dashboard Supabase** (Client ID/Secret + redirect URLs) — ACTION UTILISATEUR
- [x] Étape 7 : Backend NestJS hébergé sur **Render** (https://casino-veloria.onrender.com), DB = Postgres Supabase (session pooler)
- [x] Étape 8 : Frontend branché sur le backend Render (défaut prod dans `frontend/src/lib/env.ts`) + CORS par défaut autorise le domaine Vercel
- [ ] Étape 9 : **Tester le site en ligne** (login email/password puis Google) + activer le provider Google dans Supabase
<!-- Cocher [x] au fur et à mesure -->

---

## ✅ DERNIÈRE ACTION COMPLÉTÉE

```
Fichier    : frontend/src/lib/env.ts (défaut prod → Render) + backend/src/config/configuration.ts (CORS)
Action     : Backend déployé par l'utilisateur sur Render (https://casino-veloria.onrender.com).
             Frontend pointé vers ce backend en prod ; CORS par défaut inclut le domaine Vercel.
Résultat   : Câblage terminé. À TESTER en ligne. Réserves : (1) je ne peux pas curl onrender.com
             depuis mon env (host non autorisé) → validation via navigateur. (2) Render free =
             cold start ~50s. (3) Sans Redis, les jobs BullMQ sont désactivés (non bloquant).
```

---

## ⏭️ PROCHAINE ACTION IMMÉDIATE

```
Fichier cible : test en ligne (https://casino-veloria.vercel.app) après redeploy Vercel
Méthode/bloc  : Vérifier /api/health (navigateur) → {"status":"ok"} ; tester register/login ;
                puis activer Google dans Supabase (Providers + redirect URLs) et tester le bouton.
Action exacte : 1) Attendre le redeploy Vercel (merge main). 2) Demander à l'utilisateur de
                tester l'inscription/connexion. 3) Si erreur, récupérer les logs Render.
                4) Activer le provider Google (Client ID/Secret) + redirect /auth/callback dans Supabase.
```

> Si je relis ce fichier après une coupure, j'exécute cette section SANS redemander.

---

## 🗂️ ÉTAT DES FICHIERS

### Créés ✅
- backend/ (NestJS complet : auth, users, economy, loans, referral, leaderboard, notifications, games/{roulette,blackjack,poker,tables})
- backend/prisma/schema.prisma + migrations 0000_init, 0001_oauth_google + seed.ts
- frontend/ (toutes les pages + composants + hooks + design system)
- frontend Google : lib/supabase.ts, components/GoogleButton.tsx, pages/AuthCallback.tsx
- docs/ (API_CONTRACT.md, WEBSOCKET_EVENTS.md, SUPABASE_GOOGLE_AUTH.md)
- vercel.json, README.md, CLAUDE.md, .veloria_progress.md

### En cours 🔄
- Hébergement backend (non résolu) → bloque l'usage réel du site déployé

### À créer ❌
- (config infra) entrée de déploiement backend selon l'hôte choisi

---

## ⚙️ STACK & CONVENTIONS

- **Frontend** : React 18 + TypeScript + Vite + Tailwind + TanStack Query + Zustand + socket.io-client + framer-motion. Alias `@/` → `src/`. Déployé sur **Vercel** (projet `casino-veloria`, racine = `frontend/` via `vercel.json`).
- **Backend** : NestJS 10 + Prisma (PostgreSQL) + Redis (ioredis) + BullMQ + Socket.io + Passport-JWT. Préfixe API `/api`. Gateways WS : `/user`, `/lobby`, `/roulette`, `/blackjack`, `/poker`.
- **Anti-triche** : toute logique gain/perte côté serveur. `BalanceService.adjust()` = unique point de mutation du solde + ligne `Transaction` immuable.
- **Auth** : JWT access + refresh (rotation). Google = Supabase Auth → `/auth/google` vérifie le token Supabase puis émet les JWT VELORIA. `passwordHash` nullable pour comptes OAuth.
- **Supabase** : projet `VELORIA` ref `ejozdljwafoydynduboe`, URL `https://ejozdljwafoydynduboe.supabase.co`, clé publishable `sb_publishable_L7a4ogUaL58Rin0TDjHcww_Pa36lr9h`.
- **Git** : branche de dev `claude/inspiring-dijkstra-oqYjT`, base `main`. Repo `FarddownYG/Casino-Veloria`. PRs en draft, merge squash. Ne jamais pousser sur `main` directement.
- **Monnaie** : entiers (VELORIA COINS), aucune valeur réelle.

---

## 🚨 PROBLÈMES / BLOCAGES

1. **RÉSOLU — backend hébergé sur Render** (https://casino-veloria.onrender.com). Le frontend prod pointe dessus (`frontend/src/lib/env.ts`, défaut `import.meta.env.PROD`). Reste à tester en ligne. Note : Render free dort après inactivité (cold start ~50s) ; sans Redis les jobs BullMQ sont off (non bloquant). Variables Render requises : DATABASE_URL (Supabase session pooler), JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, CORS_ORIGINS.
2. **Google provider à activer dans Supabase** (dashboard) : sinon erreur 400 « provider is not enabled ». Étapes dans `docs/SUPABASE_GOOGLE_AUTH.md`.
3. **DB de prod** : le Postgres Supabase n'a pas encore le schéma appliqué (à faire quand l'hébergement backend est décidé, via `prisma migrate deploy` ou MCP).
4. Poker : pot unique (pas de side-pots multi-all-in) — simplification assumée.

---

## 📌 RÈGLES DE MISE À JOUR

Je mets à jour ce fichier :
- Après chaque fichier créé ou modifié
- Avant chaque opération longue ou risquée
- À chaque étape cochée
- Immédiatement avant une potentielle coupure de contexte

---

## 🔁 PROTOCOLE DE REPRISE

Si je lis ce fichier en début de session :
1. Afficher : "Reprise depuis → [DERNIÈRE ACTION COMPLÉTÉE]"
2. Exécuter immédiatement → [PROCHAINE ACTION IMMÉDIATE]
3. Continuer sans redemander ce qui est déjà fait
