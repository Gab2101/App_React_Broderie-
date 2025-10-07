-- Migration: Add validation_client column to commandes table
-- Run this script in your Supabase SQL Editor or database console

ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS validation_client BOOLEAN DEFAULT false;

-- Optional: Update existing orders to have validation_client = true for already completed orders
-- Uncomment the line below if you want auto-validation for completed orders:
-- UPDATE commandes SET validation_client = true WHERE statut = 'Terminée';

COMMIT;
