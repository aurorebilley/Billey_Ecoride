/*
  # Add employe_id column to historique_litiges
  
  1. Changes
    - Add employe_id column to historique_litiges table
    - Update RLS policies to handle employe_id
    - Add policy for employees to read their own actions
    
  2. Security
    - Maintain existing security model
    - Allow employees to read their own actions
    - Allow admins to read all actions
*/

-- Add employe_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'historique_litiges' 
    AND column_name = 'employe_id'
  ) THEN
    ALTER TABLE historique_litiges 
    ADD COLUMN employe_id text;
  END IF;
END $$;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs litiges" ON historique_litiges;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs litiges" ON historique_litiges;

-- Create updated policies
CREATE POLICY "Les utilisateurs peuvent lire leurs litiges"
  ON historique_litiges
  FOR SELECT
  TO authenticated
  USING (
    chauffeur_id = auth.uid()::text OR
    passager_id = auth.uid()::text OR
    employe_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );

CREATE POLICY "Les utilisateurs peuvent insérer leurs litiges"
  ON historique_litiges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chauffeur_id = auth.uid()::text OR
    passager_id = auth.uid()::text OR
    employe_id = auth.uid()::text OR
    auth.jwt() ->> 'role' = 'administrateur' OR
    auth.jwt() ->> 'role' = 'employé'
  );