/*
  # Add SELECT Policies for Historical Tables

  1. Changes
    - Add SELECT policies for all historical tables
    - Allow users to read their own records
    - Allow admins and employees to read all records

  2. Security
    - Users can only read records where they are the chauffeur or passager
    - Admins and employees have full read access
    - Maintain existing INSERT policies
*/

-- Policy for historique_covoiturages
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

-- Policy for historique_transactions
CREATE POLICY "Les utilisateurs peuvent lire leurs transactions"
  ON historique_transactions
  FOR SELECT
  TO authenticated
  USING (
    utilisateur_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

-- Policy for historique_litiges
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

-- Policy for historique_avis
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