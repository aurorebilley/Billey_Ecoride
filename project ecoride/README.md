# 🚗 EcoRide - Plateforme de Covoiturage Écologique

[![Vite](https://img.shields.io/badge/Vite-4.3.1-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-10.8.0-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.8-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)

## 📑 Table des matières

- [À propos du projet](#-à-propos-du-projet)
- [Technologies utilisées](#-technologies-utilisées)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Développement](#-développement)
- [Architecture de données](#-architecture-de-données)
- [Déploiement](#-déploiement)
- [Structure du projet](#-structure-du-projet)
- [Gestion des branches](#-gestion-des-branches)
- [Contribution](#-contribution)

## 🌟 À propos du projet

EcoRide est une plateforme de covoiturage moderne qui met l'accent sur l'aspect écologique des déplacements. Le projet vise à :

- Faciliter la mise en relation entre conducteurs et passagers
- Promouvoir les véhicules électriques et écologiques
- Gérer un système de crédits pour les transactions
- Assurer la sécurité des utilisateurs avec un système de validation et d'avis
- Offrir une interface administrative pour la gestion des utilisateurs et des litiges

## 🛠 Technologies utilisées

- **Frontend :**
  - React 18 avec TypeScript
  - Vite comme bundler
  - Tailwind CSS pour le styling
  - Lucide React pour les icônes
  - React Router pour la navigation
  - EmailJS pour l'envoi d'emails
   - Recharts pour les graphiques

- **Backend & Services :**
  - Firebase Authentication
  - Cloud Firestore
  - Cloudinary pour le stockage d'images
  - Firebase Security Rules
   - Supabase pour l'archivage des données

## 📋 Prérequis

- Node.js 18.0.0 ou supérieur
- Un compte Firebase
- Un compte Cloudinary
- Un compte EmailJS
- Un compte Supabase

## 💻 Installation

1. Clonez le dépôt :
```bash
git clone https://github.com/votre-username/ecoride.git
cd ecoride
```

2. Installez les dépendances :
```bash
npm install
```

## ⚙️ Configuration

1. Créez un fichier `.env` à la racine du projet avec les variables suivantes :
```env
# Firebase
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_auth_domain
VITE_FIREBASE_PROJECT_ID=votre_project_id
VITE_FIREBASE_STORAGE_BUCKET=votre_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=votre_messaging_sender_id
VITE_FIREBASE_APP_ID=votre_app_id

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=votre_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=votre_upload_preset

# EmailJS
VITE_EMAILJS_SERVICE_ID=votre_service_id
VITE_EMAILJS_TEMPLATE_ID=votre_template_id
VITE_EMAILJS_PUBLIC_KEY=votre_public_key

# Supabase
VITE_SUPABASE_URL=votre_supabase_url
VITE_SUPABASE_ANON_KEY=votre_supabase_anon_key
```

2. Configurez Firebase :
   - Créez un projet dans la console Firebase
   - Activez Authentication avec email/mot de passe
   - Créez une base de données Firestore
   - Appliquez les règles de sécurité depuis le fichier `firebase.rules`

3. Configurez Supabase :
   - Créez un projet dans la console Supabase
   - Notez l'URL et la clé anonyme pour les variables d'environnement
   - Exécutez les migrations SQL présentes dans le dossier `supabase/migrations`
   - Vous pouvez exécuter les migrations manuellement dans l'éditeur SQL de Supabase

## 🚀 Développement

Pour lancer le serveur de développement :
```bash
npm run dev
```

L'application sera accessible à l'adresse : `http://localhost:5173`

Autres commandes disponibles :
```bash
npm run build    # Build pour la production
npm run preview  # Prévisualiser le build
npm run lint     # Lancer ESLint
```

## 📊 Architecture de données

Le projet utilise une architecture hybride :

1. **Firebase Firestore** pour les données actives :
   - Utilisateurs et authentification
   - Covoiturages actifs
   - Transactions en cours
   - Validations et litiges en cours
   - Avis et notes

2. **Supabase PostgreSQL** pour l'archivage et l'historique :
   - Historique des covoiturages terminés
   - Historique des transactions
   - Historique des litiges résolus
   - Historique des avis

Cette architecture permet une gestion en temps réel des données actives via Firestore, tout en conservant un historique structuré et requêtable via Supabase pour les analyses et la conformité réglementaire.

### Tables Supabase

- **historique_covoiturages** : Archive des trajets terminés
- **historique_transactions** : Archive des transactions financières
- **historique_litiges** : Archive des litiges résolus
- **historique_avis** : Archive des avis et notes

### Synchronisation

La synchronisation entre Firestore et Supabase est gérée par les fonctions dans `src/lib/sync.ts` qui sont appelées lors des actions critiques comme :
- La fin d'un trajet
- La résolution d'un litige
- L'ajout d'un avis
- Les transactions financières

## 📦 Déploiement

Le projet est configuré pour être déployé sur Netlify :

1. Créez un compte sur Netlify
2. Connectez votre dépôt GitHub
3. Configurez les variables d'environnement dans les paramètres du projet
4. Déployez avec les paramètres suivants :
   - Commande de build : `npm run build`
   - Dossier de publication : `dist`

Pour un déploiement local, vous pouvez utiliser :
```bash
npm run build
npm run preview
```

## 📁 Structure du projet

```
ecoride/
├── src/
│   ├── components/    # Composants réutilisables
│   ├── pages/         # Pages de l'application (React Router)
│   ├── lib/           # Services et utilitaires
│   │   ├── firebase.ts       # Configuration Firebase
│   │   ├── supabase.ts       # Configuration Supabase
│   │   ├── sync.ts           # Fonctions de synchronisation
│   │   ├── cloudinary.ts     # Gestion des images
│   │   ├── email.ts          # Envoi d'emails
│   │   └── migration.ts      # Outils de migration de données
│   └── types/         # Définitions de types TypeScript
├── public/            # Assets statiques
├── supabase/          # Migrations et configuration Supabase
│   └── migrations/    # Fichiers SQL de migration
└── ...
```

## 🔐 Rôles utilisateurs

L'application gère plusieurs types d'utilisateurs :

1. **Utilisateurs standard** (rôle: `user`)
   - Peuvent avoir un ou deux sous-rôles :
     - `chauffeur` : Peut créer et gérer des trajets
     - `passager` : Peut réserver des places dans les trajets

2. **Employés** (rôle: `employé`)
   - Gèrent les litiges entre utilisateurs
   - Modèrent les avis signalés
   - Accèdent aux tableaux de bord

3. **Administrateurs** (rôle: `administrateur`)
   - Gèrent les utilisateurs et les employés
   - Accèdent aux statistiques complètes
   - Gèrent les crédits de la plateforme

## 🌿 Gestion des branches

- `main` : Branche de production
- `develop` : Branche de développement
- `feature/*` : Branches de fonctionnalités
- `hotfix/*` : Branches de corrections urgentes

Workflow recommandé :
1. Créer une branche depuis `develop`
2. Développer la fonctionnalité
3. Créer une Pull Request vers `develop`
4. Après validation, merger dans `develop`
5. Périodiquement, merger `develop` dans `main` pour les releases

## 👥 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers votre fork
5. Ouvrez une Pull Request


---

Développé avec ❤️ par Aurore Billey