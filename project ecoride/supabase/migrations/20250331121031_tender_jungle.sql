/*
  # Tables d'historique pour EcoRide

  1. Tables créées
    - `historique_covoiturages` : Archive des trajets terminés
    - `historique_transactions` : Archive des transactions de crédits
    - `historique_litiges` : Archive des litiges résolus
    - `historique_avis` : Archive des avis/notes

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques d'accès restreintes aux administrateurs
*/

-- Historique des covoiturages
CREATE TABLE IF NOT EXISTS historique_covoiturages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  covoiturage_id text NOT NULL,
  chauffeur_id text NOT NULL,
  passagers_ids text[] NOT NULL,
  depart_ville text NOT NULL,
  arrivee_ville text NOT NULL,
  date_depart timestamp with time zone NOT NULL,
  date_arrivee timestamp with time zone NOT NULL,
  prix integer NOT NULL,
  vehicule_plaque text NOT NULL,
  ecologique boolean NOT NULL DEFAULT false,
  statut text NOT NULL,
  date_archivage timestamp with time zone DEFAULT now(),
  donnees_source jsonb NOT NULL
);

-- Historique des transactions
CREATE TABLE IF NOT EXISTS historique_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id text NOT NULL,
  montant integer NOT NULL,
  type text NOT NULL,
  description text,
  covoiturage_id text,
  date_transaction timestamp with time zone NOT NULL,
  date_archivage timestamp with time zone DEFAULT now()
);

-- Historique des litiges
CREATE TABLE IF NOT EXISTS historique_litiges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  litige_id text NOT NULL,
  covoiturage_id text NOT NULL,
  chauffeur_id text NOT NULL,
  passager_id text NOT NULL,
  raison text NOT NULL,
  resolution text NOT NULL,
  date_creation timestamp with time zone NOT NULL,
  date_resolution timestamp with time zone NOT NULL,
  date_archivage timestamp with time zone DEFAULT now()
);

-- Historique des avis
CREATE TABLE IF NOT EXISTS historique_avis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avis_id text NOT NULL,
  chauffeur_id text NOT NULL,
  passager_id text NOT NULL,
  note integer NOT NULL,
  commentaire text,
  date_creation timestamp with time zone NOT NULL,
  date_archivage timestamp with time zone DEFAULT now()
);

-- Activer RLS
ALTER TABLE historique_covoiturages ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_litiges ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_avis ENABLE ROW LEVEL SECURITY;

-- Politiques d'accès (lecture seule pour les administrateurs)
CREATE POLICY "Les administrateurs peuvent lire l'historique des covoiturages"
  ON historique_covoiturages
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'administrateur');

CREATE POLICY "Les administrateurs peuvent lire l'historique des transactions"
  ON historique_transactions
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'administrateur');

CREATE POLICY "Les administrateurs peuvent lire l'historique des litiges"
  ON historique_litiges
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'administrateur');

CREATE POLICY "Les administrateurs peuvent lire l'historique des avis"
  ON historique_avis
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'administrateur');