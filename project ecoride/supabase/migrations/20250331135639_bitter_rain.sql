/*
  # Add Insert Policies for Historical Tables

  1. Changes
    - Add INSERT policies for historique_covoiturages
    - Add INSERT policies for historique_transactions
    - Add INSERT policies for historique_litiges
    - Add INSERT policies for historique_avis
    - Fix type casting between text and UUID for auth.uid()

  2. Security
    - Allow authenticated users to insert into historical tables
    - Validate data ownership through user ID checks
    - Properly cast auth.uid() to text for comparison
*/

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