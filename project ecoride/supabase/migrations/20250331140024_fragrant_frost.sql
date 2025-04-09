/*
  # Fix RLS Policies for Historical Tables

  1. Changes
    - Drop existing policies to avoid conflicts
    - Add more permissive policy for covoiturages inserts
    - Allow inserts for both active and terminated trips
    - Handle array containment checks correctly

  2. Security
    - Maintain existing security rules for admins and employees
    - Ensure proper type casting between UUID and text
    - Allow both drivers and passengers to insert records
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs covoiturages terminés" ON historique_covoiturages;
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs covoiturages" ON historique_covoiturages;

-- Policies for historique_covoiturages with more permissive insert conditions
CREATE POLICY "Les utilisateurs peuvent insérer leurs covoiturages terminés"
  ON historique_covoiturages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chauffeur_id = auth.uid()::text OR
    auth.uid()::text = ANY(passagers_ids) OR
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