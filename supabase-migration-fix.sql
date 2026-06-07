-- ============================================
-- Control Garage – Migration Fix
-- ============================================
-- Corregge 2 problemi:
-- 1. Aggiunge la colonna "ora" alla tabella prenotazioni
--    (il codice JS la inserisce e l'admin la legge, ma non esisteva nel DB)
-- 2. Unifica la funzione check_slot_disponibilita() con TUTTI i controlli:
--    - Blocco giorni chiusi
--    - Blocco slot pieni
--
-- Esegui nella Supabase Dashboard: SQL Editor → New Query → incolla e Run
-- NOTA: Eseguire DOPO tutti gli altri file SQL
-- ============================================

BEGIN;

-- =====================
-- 1. Aggiunge colonna "ora" a prenotazioni
-- =====================
-- Contiene l'orario specifico scelto dal cliente (es. '09:00:00')
-- Il frontend la inserisce come selectedOra + ':00'
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS ora TIME;

-- Indice per query su orario specifico
CREATE INDEX IF NOT EXISTS idx_prenotazioni_ora ON prenotazioni(ora);

-- =====================
-- 2. Funzione unificata check_slot_disponibilita()
-- =====================
-- Combina i controlli di:
-- - supabase-setup.sql (giorni chiusi + slot pieni)
-- - supabase-security-patch.sql (solo slot pieni, mancava giorni chiusi)
-- - supabase-migration-giorni-chiusi.sql (giorni chiusi + slot pieni)
-- Questa versione li include ENTRAMBI.
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

-- Ricrea il trigger (idempotente)
DROP TRIGGER IF EXISTS check_disponibilita_before_insert ON prenotazioni;
CREATE TRIGGER check_disponibilita_before_insert
  BEFORE INSERT ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION check_slot_disponibilita();

COMMIT;
