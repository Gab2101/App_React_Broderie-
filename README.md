📖 Description

Cette application est un outil interne développé pour Pubos afin de gérer la production de broderie et le suivi des commandes.
Elle permet de planifier automatiquement ou manuellement les opérations de broderie sur les machines disponibles, de suivre l’état des commandes en temps réel et d’optimiser la gestion des ressources.

L’application est construite en React (Vite) pour le front-end, utilise Supabase (PostgreSQL + Auth + Storage) pour la base de données et est déployée sur Vercel.

✨ Fonctionnalités principales

Gestion des commandes
    Création et modification de commandes.
    Calcul automatique de la durée de broderie (points, vitesse, nombre de têtes).
    Calcul du temps de nettoyage par type d’article (tags).
    Découpage automatique si une commande dépasse la fin de journée (17h → reprise le lendemain 8h).

Gestion des machines
    Liste des machines de broderie avec leurs caractéristiques (nombre de têtes, type).
    Association commandes ↔ machines.
    Suivi de la disponibilité.

Paramètres configurables
    Gestion des étiquettes (tags) pour articles et broderies.
    Durées de nettoyage paramétrables par type d’article.
    Interface simple pour ajouter/supprimer/modifier les tags.

Planning horaire (vue production)
    Affichage des créneaux horaires des machines.
    Mise à jour automatique des commandes :
        “À commencer” → décalée à la prochaine heure libre.
        “En cours” → prolongée automatiquement jusqu’à fin réelle.
    Coloration par urgence (calculée à partir de la date de livraison).
    Interaction : survol pour mettre en évidence une commande, clic pour ouvrir un modal avec les détails.

Gestion des utilisateurs (via Supabase Auth)
    Connexion sécurisée avec gestion des rôles.
    Restriction des accès aux données sensibles par Row Level Security (RLS).

🏗️ Architecture

React (Vite) —> Vercel (hébergement front)
          |
          v
Supabase (hébergé Postgres + Auth + Storage + Edge Functions)


🚀 Installation locale
Prérequis
    Node.js ≥ 18
    npm ou yarn
    Compte Supabase (ou accès au projet de l’entreprise)

Étapes
    1.Cloner le dépôt
        git clone https://github.com/<organisation>/<repo>.git
        cd <repo>
    2.Installer les dépendances 
        npm install
    3.Créer un fichier .env.local à partir de l’exemple :
        cp .env.example .env.local
    4.Ajouter vos clés Supabase dans .env.local 
        VITE_SUPABASE_URL=<url>
        VITE_SUPABASE_ANON_KEY=<clé>
    5.Lancer en local 
        npm run dev

📦 Déploiement
L’application est prévue pour être déployée sur Vercel.
    Créer une Team Vercel pour l’entreprise.
    Lier le dépôt GitHub.
    Définir les variables d’environnement dans Settings > Environment Variables.
    Déployer (Production et Preview activés).

🔑 Variables d’environnement
| Variable                                  | Description                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                       | URL du projet Supabase                                               |
| `VITE_SUPABASE_ANON_KEY`                  | Clé anonyme publique Supabase                                        |
| *(optionnel)* `SUPABASE_SERVICE_ROLE_KEY` | Clé service (uniquement côté serveur/IT, jamais exposée côté client) |

🗄️ Base de données (Supabase)
Tables principales :
    commandes : infos sur les commandes (dates, machine, statut, durée, urgence).
    machines : liste des machines et paramètres (têtes, vitesse).
    articleTags : tags liés aux articles avec durée de nettoyage.
    broderieTags : tags liés aux paramètres de broderie.
Auth : géré par Supabase (GoTrue).
Storage : possibilité d’ajouter fichiers/visuels liés aux commandes.
Sécurité :
    Row Level Security (RLS) activé.
    Policies pour restreindre l’accès selon l’utilisateur/role.

📊 Données calculées automatiquement
    Durée broderie théorique = (nbre de points ÷ vitesse) ÷ nbre de têtes.
    Durée nettoyage = (durée par article selon articleTags) × quantité.
    Temps total = broderie + nettoyage.
    Urgence = score (1–5) calculé à partir de la date de livraison.

🧑‍💻 Développement
    Stack : React + Tailwind + Supabase JS SDK.
    Structure :
        src/
            components/   # composants réutilisables
            pages/        # Commandes, Machines, Paramètres, Planning
            utils/        # fonctions calculs, gestion du temps, services Supabase
            context/      # gestion des étiquettes (EtiquettesContext)
            styles/       # CSS custom

📚 Documentation & Passation
    Guide utilisateur → comment créer/planifier une commande.
    Guide IT → comment gérer les migrations Supabase, secrets, déploiement.
    Runbook incident → que faire en cas de panne (DB, front).

🧾 Licence
    Projet interne, propriété de Pubos.
    Non destiné à une diffusion externe.