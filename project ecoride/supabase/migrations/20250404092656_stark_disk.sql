/*
  # Allow null date_resolution for ongoing disputes

  1. Changes
    - Make date_resolution column nullable in historique_litiges table
    - This allows storing ongoing disputes without a resolution date

  2. Security
    - Maintains existing security policies
    - No changes to access control
*/

-- Modify date_resolution to allow null values
ALTER TABLE historique_litiges 
ALTER COLUMN date_resolution DROP NOT NULL;