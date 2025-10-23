-- Migration: Add marchandise_recue column to commandes table
-- Run this script in your Supabase SQL Editor or database console

ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS marchandise_recue BOOLEAN DEFAULT false;

-- Optional: Update existing orders to have marchandise_recue = true for already completed orders
-- Uncomment the line below if you want auto-validation for completed orders:
-- UPDATE commandes SET marchandise_recue = true WHERE statut = 'Terminée';

COMMIT;
