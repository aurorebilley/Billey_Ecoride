/*
  # Update RLS Policies for Historical Tables

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new INSERT policies with proper type casting and conditions
    - Add policies for all historical tables
    - Fix auth.uid() type casting to text

  2. Security
    - Maintain existing security model
    - Allow users to insert their own records
    - Allow admins and employees to insert records
    - Ensure proper type casting for ID comparisons
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs covoiturages terminés" ON historique_covoiturages;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs transactions" ON historique_transactions;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs litiges" ON historique_litiges;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs avis" ON historique_avis;

-- Policy for historique_covoiturages
CREATE POLICY "Les utilisateurs peuvent insérer leurs covoiturages terminés"
  ON historique_covoiturages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chauffeur_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policy for historique_transactions
CREATE POLICY "Les utilisateurs peuvent insérer leurs transactions"
  ON historique_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    utilisateur_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policy for historique_litiges
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

-- Policy for historique_avis
CREATE POLICY "Les utilisateurs peuvent insérer leurs avis"
  ON historique_avis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    passager_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );