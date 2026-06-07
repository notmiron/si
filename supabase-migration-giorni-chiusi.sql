-- ============================================
-- Migration: Giorni Chiusi (Date di Chiusura)
-- ============================================
-- Esegui questo SQL nella Supabase Dashboard:
-- SQL Editor -> New Query -> incolla e Run
-- ============================================

-- 1. Crea tabella giorni_chiusi
CREATE TABLE IF NOT EXISTS giorni_chiusi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giorni_chiusi_data ON giorni_chiusi(data);

-- 2. Abilita RLS
ALTER TABLE giorni_chiusi ENABLE ROW LEVEL SECURITY;

-- 3. Policy: tutti leggono (calendario pubblico)
CREATE POLICY "Tutti leggono giorni_chiusi"
  ON giorni_chiusi FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 4. Policy: solo admin inserisce
CREATE POLICY "Solo admin inserisce giorni_chiusi"
  ON giorni_chiusi FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 5. Policy: solo admin cancella
CREATE POLICY "Solo admin cancella giorni_chiusi"
  ON giorni_chiusi FOR DELETE
  TO authenticated
  USING (is_admin());

-- 6. Aggiorna trigger check_slot_disponibilita per bloccare booking su giorni chiusi
CREATE OR REPLACE FUNCTION check_slot_disponibilita()
RETURNS TRIGGER AS $$
DECLARE
  max_slot INTEGER;
  current_count INTEGER;
BEGIN
  -- Controlla se il giorno e chiuso (festivo/chiusura straordinaria)
  IF EXISTS (SELECT 1 FROM giorni_chiusi WHERE data = NEW.data) THEN
    RAISE EXCEPTION 'Giorno chiuso: impossibile prenotare per il %', NEW.data;
  END IF;

  -- Determina il limite per la fascia oraria
  IF NEW.fascia_oraria = 'mattina' THEN
    SELECT max_mattina INTO max_slot FROM impostazioni WHERE id = 1;
  ELSE
    SELECT max_pomeriggio INTO max_slot FROM impostazioni WHERE id = 1;
  END IF;

  -- Conta prenotazioni attive per quel giorno+fascia
  SELECT COUNT(*) INTO current_count
  FROM prenotazioni
  WHERE data = NEW.data
    AND fascia_oraria = NEW.fascia_oraria
    AND stato IN ('in_attesa', 'confermata');

  IF current_count >= max_slot THEN
    RAISE EXCEPTION 'Slot non disponibile: capacita massima raggiunta per % del %',
      NEW.fascia_oraria, NEW.data;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
