/*
  # Add Public Read Access to Historical Data
  
  1. Changes
    - Drop existing read policy
    - Add new policy allowing public read access
    
  2. Security
    - Maintains existing insert policies
    - Allows anonymous and authenticated users to read data
*/

-- Drop existing read policy
DROP POLICY IF EXISTS "Les utilisateurs peuvent lire leurs covoiturages" ON historique_covoiturages;

-- Create new public read policy
CREATE POLICY "Tout le monde peut lire l'historique des covoiturages"
  ON historique_covoiturages
  FOR SELECT
  TO public
  USING (true);