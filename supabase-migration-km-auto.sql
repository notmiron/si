-- Migration: Add km_auto column to prenotazioni
-- Run this on existing databases to add the car kilometers field

ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS km_auto TEXT CHECK (length(km_auto) <= 10);
