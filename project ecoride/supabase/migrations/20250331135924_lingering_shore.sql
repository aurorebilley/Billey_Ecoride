/*
  # Fix RLS Policies for Historical Tables

  1. Changes
    - Drop all existing policies to avoid conflicts
    - Recreate policies with proper type casting and array handling
    - Add comprehensive policies for both INSERT and SELECT operations

  2. Security
    - Maintain existing security rules for admins and employees
    - Ensure proper type casting between UUID and text
    - Handle array containment checks correctly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs covoiturages terminés" ON historique_covoiturages;
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs covoiturages" ON historique_covoiturages;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs transactions" ON historique_transactions;
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs transactions" ON historique_transactions;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs litiges" ON historique_litiges;
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs litiges" ON historique_litiges;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs avis" ON historique_avis;
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs avis" ON historique_avis;

-- Policies for historique_covoiturages
CREATE POLICY "Les utilisateurs peuvent insérer leurs covoiturages terminés"
  ON historique_covoiturages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (chauffeur_id = auth.uid()::text AND donnees_source->>'statut' = 'terminé') OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

CREATE POLICY "Les utilisateurs peuvent lire leurs covoiturages"
  ON historique_covoiturages
  FOR SELECT
  TO authenticated
  USING (
    chauffeur_id = auth.uid()::text OR
    passagers_ids::text[] @> ARRAY[auth.uid()::text] OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policies for historique_transactions
CREATE POLICY "Les utilisateurs peuvent insérer leurs transactions"
  ON historique_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    utilisateur_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

CREATE POLICY "Les utilisateurs peuvent lire leurs transactions"
  ON historique_transactions
  FOR SELECT
  TO authenticated
  USING (
    utilisateur_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policies for historique_litiges
CREATE POLICY "Les utilisateurs peuvent insérer leurs litiges"
  ON historique_litiges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chauffeur_id = auth.uid()::text OR
    passager_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

CREATE POLICY "Les utilisateurs peuvent lire leurs litiges"
  ON historique_litiges
  FOR SELECT
  TO authenticated
  USING (
    chauffeur_id = auth.uid()::text OR
    passager_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policies for historique_avis
CREATE POLICY "Les utilisateurs peuvent insérer leurs avis"
  ON historique_avis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    passager_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

CREATE POLICY "Les utilisateurs peuvent lire leurs avis"
  ON historique_avis
  FOR SELECT
  TO authenticated
  USING (
    chauffeur_id = auth.uid()::text OR
    passager_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );