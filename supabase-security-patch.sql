-- ============================================
-- Control Garage – Security Patch (Issues #8-#11)
-- ============================================
-- Esegui questo SQL nella Supabase Dashboard:
-- SQL Editor → New Query → incolla e Run
-- ============================================
-- NOTA: Eseguire in ordine. Ogni sezione e idempotente (DROP IF EXISTS).
-- ============================================

-- =====================
-- Issue #11: Forzare stato = 'in_attesa' su INSERT
-- Impedisce che un attaccante inserisca prenotazioni gia confermate via API
-- =====================
DROP POLICY IF EXISTS "Chiunque puo prenotare" ON prenotazioni;
CREATE POLICY "Chiunque puo prenotare"
  ON prenotazioni FOR INSERT
  TO anon, authenticated
  WITH CHECK (stato = 'in_attesa');

-- =====================
-- Issue #10: Trigger server-side per impedire prenotazioni su slot pieni
-- Controlla max_mattina/max_pomeriggio da impostazioni prima di ogni INSERT
-- =====================
CREATE OR REPLACE FUNCTION check_slot_disponibilita()
RETURNS TRIGGER AS $$
DECLARE
  max_slot INTEGER;
  current_count INTEGER;
BEGIN
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

-- Ricrea il trigger (DROP + CREATE per idempotenza)
DROP TRIGGER IF EXISTS check_disponibilita_before_insert ON prenotazioni;
CREATE TRIGGER check_disponibilita_before_insert
  BEFORE INSERT ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION check_slot_disponibilita();
