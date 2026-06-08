-- ============================================
-- Control Garage – Setup Completo Database
-- ============================================
-- File unico che crea TUTTO il database da zero.
-- Consolida: setup, giorni-chiusi, rls-fix, security-patch,
--            security-logs, migration-fix.
--
-- Esegui nella Supabase Dashboard:
-- SQL Editor → New Query → incolla TUTTO → Run
--
-- DOPO l'esecuzione:
-- 1. Crea un utente admin in Authentication → Users
-- 2. Copia il suo UUID
-- 3. Esegui: INSERT INTO admin_users (user_id) VALUES ('IL-TUO-UUID');
-- ============================================

BEGIN;

-- =============================================
-- TABELLE
-- =============================================

-- Servizi disponibili per la prenotazione
CREATE TABLE servizi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT,
  durata_minuti INTEGER NOT NULL DEFAULT 60,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO servizi (nome, descrizione, durata_minuti, ordine) VALUES
  ('Diagnostica Computerizzata', 'Lettura centraline, sensori, codici errore', 60, 1),
  ('Preventivi', 'Richiedi un preventivo per qualsiasi intervento', 60, 2),
  ('Assistenza', 'Assistenza tecnica e supporto per il tuo veicolo', 60, 3),
  ('Rimappatura Centralina', 'Rimappatura ECU per prestazioni o risparmio', 120, 4),
  ('Tuning & Elaborazioni', 'Scarichi sportivi, assetti, upgrade prestazionali', 180, 5),
  ('Elettronica & Meccatronica', 'Centraline, codifiche, sistemi elettronici avanzati', 120, 6),
  ('Altro', 'Altro tipo di intervento – descrivere nelle note', 60, 7);

-- Impostazioni officina (riga singola, id=1)
CREATE TABLE impostazioni (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_mattina INTEGER NOT NULL DEFAULT 3,
  max_pomeriggio INTEGER NOT NULL DEFAULT 3,
  orario_mattina_inizio TIME NOT NULL DEFAULT '08:00',
  orario_mattina_fine TIME NOT NULL DEFAULT '12:00',
  orario_pomeriggio_inizio TIME NOT NULL DEFAULT '14:00',
  orario_pomeriggio_fine TIME NOT NULL DEFAULT '18:00',
  sabato_aperto BOOLEAN NOT NULL DEFAULT TRUE,
  sabato_solo_mattina BOOLEAN NOT NULL DEFAULT TRUE,
  domenica_aperto BOOLEAN NOT NULL DEFAULT FALSE,
  domenica_solo_mattina BOOLEAN NOT NULL DEFAULT FALSE,
  slot_urgenze_mattina INTEGER NOT NULL DEFAULT 1,
  slot_urgenze_pomeriggio INTEGER NOT NULL DEFAULT 1,
  promemoria_ore_prima INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO impostazioni (id) VALUES (1);

-- Prenotazioni clienti
CREATE TABLE prenotazioni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  servizio_id UUID REFERENCES servizi(id),
  nome TEXT NOT NULL CHECK (length(nome) <= 200),
  email TEXT NOT NULL CHECK (length(email) <= 254),
  telefono TEXT CHECK (length(telefono) <= 20),
  auto TEXT NOT NULL CHECK (length(auto) <= 200),
  km_auto TEXT CHECK (length(km_auto) <= 10),
  note TEXT CHECK (length(note) <= 2000),
  data DATE NOT NULL,
  fascia_oraria TEXT NOT NULL CHECK (fascia_oraria IN ('mattina', 'pomeriggio')),
  ora TIME,
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'confermata', 'rifiutata', 'completata', 'cancellata')),
  risposta_note TEXT,
  proposta_data DATE,
  proposta_fascia TEXT CHECK (proposta_fascia IN ('mattina', 'pomeriggio')),
  letta BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prenotazioni_data ON prenotazioni(data);
CREATE INDEX idx_prenotazioni_stato ON prenotazioni(stato);
CREATE INDEX idx_prenotazioni_created ON prenotazioni(created_at DESC);
CREATE INDEX idx_prenotazioni_ora ON prenotazioni(ora);
CREATE INDEX idx_prenotazioni_email_created ON prenotazioni(email, created_at DESC);

-- Giorni di chiusura (ferie, festivi)
CREATE TABLE giorni_chiusi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_giorni_chiusi_data ON giorni_chiusi(data);

-- Admin: mappa UUID utenti Supabase Auth → ruolo admin
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log di sicurezza (login, azioni admin)
CREATE TABLE security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at DESC);

-- =============================================
-- FUNZIONI
-- =============================================

-- Auto-update di updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prenotazioni_updated_at
  BEFORE UPDATE ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Controlla disponibilita slot (giorni chiusi + capacita massima)
CREATE OR REPLACE FUNCTION check_slot_disponibilita()
RETURNS TRIGGER AS $$
DECLARE
  max_slot INTEGER;
  current_count INTEGER;
  duplicate_count INTEGER;
  is_sunday_open BOOLEAN;
  is_saturday_open BOOLEAN;
BEGIN
  -- Blocca prenotazioni nel passato
  IF NEW.data < CURRENT_DATE THEN
    RAISE EXCEPTION 'Non e possibile prenotare per una data passata';
  END IF;

  -- Blocca domenica (se non aperta)
  IF EXTRACT(DOW FROM NEW.data) = 0 THEN
    SELECT domenica_aperto INTO is_sunday_open FROM impostazioni WHERE id = 1;
    IF NOT COALESCE(is_sunday_open, FALSE) THEN
      RAISE EXCEPTION 'L officina e chiusa la domenica';
    END IF;
  END IF;

  -- Blocca sabato (se non aperto)
  IF EXTRACT(DOW FROM NEW.data) = 6 THEN
    SELECT sabato_aperto INTO is_saturday_open FROM impostazioni WHERE id = 1;
    IF NOT COALESCE(is_saturday_open, TRUE) THEN
      RAISE EXCEPTION 'L officina e chiusa il sabato';
    END IF;
  END IF;

  -- Blocca prenotazioni duplicate: stessa email + stesso giorno
  SELECT COUNT(*) INTO duplicate_count
  FROM prenotazioni
  WHERE email = NEW.email
    AND data = NEW.data
    AND stato IN ('in_attesa', 'confermata');

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Hai gia una prenotazione per questa data. Contattaci per modificarla.';
  END IF;

  -- Blocca prenotazioni su giorni chiusi
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

CREATE TRIGGER check_disponibilita_before_insert
  BEFORE INSERT ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION check_slot_disponibilita();

-- Rate limit: max 5 prenotazioni per email per ora
CREATE OR REPLACE FUNCTION check_booking_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM prenotazioni
  WHERE email = NEW.email
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 5 bookings per hour per email'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_booking_rate_limit
  BEFORE INSERT ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION check_booking_rate_limit();

-- RPC pubblica: conta prenotazioni per fascia (calendario form)
CREATE OR REPLACE FUNCTION get_disponibilita(data_inizio DATE, data_fine DATE)
RETURNS TABLE (
  giorno DATE,
  fascia TEXT,
  slot_ora TEXT,
  conteggio BIGINT
) AS $$
BEGIN
  IF data_fine - data_inizio > 45 THEN
    RAISE EXCEPTION 'Intervallo massimo 45 giorni';
  END IF;

  RETURN QUERY
  SELECT
    p.data AS giorno,
    p.fascia_oraria AS fascia,
    p.ora::TEXT AS slot_ora,
    COUNT(*) AS conteggio
  FROM prenotazioni p
  WHERE p.data BETWEEN data_inizio AND data_fine
    AND p.stato IN ('in_attesa', 'confermata')
  GROUP BY p.data, p.fascia_oraria, p.ora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: controlla se l'utente corrente e admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE servizi ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE giorni_chiusi ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- PRENOTAZIONI
CREATE POLICY "Chiunque puo prenotare"
  ON prenotazioni FOR INSERT
  TO anon, authenticated
  WITH CHECK (stato = 'in_attesa');

CREATE POLICY "Solo admin legge prenotazioni"
  ON prenotazioni FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Solo admin aggiorna prenotazioni"
  ON prenotazioni FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Solo admin cancella prenotazioni"
  ON prenotazioni FOR DELETE
  TO authenticated
  USING (is_admin());

-- SERVIZI
CREATE POLICY "Tutti leggono servizi"
  ON servizi FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Solo admin inserisce servizi"
  ON servizi FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Solo admin aggiorna servizi"
  ON servizi FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Solo admin cancella servizi"
  ON servizi FOR DELETE
  TO authenticated
  USING (is_admin());

-- IMPOSTAZIONI
CREATE POLICY "Tutti leggono impostazioni"
  ON impostazioni FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Solo admin modifica impostazioni"
  ON impostazioni FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- GIORNI CHIUSI
CREATE POLICY "Tutti leggono giorni_chiusi"
  ON giorni_chiusi FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Solo admin inserisce giorni_chiusi"
  ON giorni_chiusi FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Solo admin cancella giorni_chiusi"
  ON giorni_chiusi FOR DELETE
  TO authenticated
  USING (is_admin());

-- ADMIN USERS
CREATE POLICY "Solo admin legge admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_admin());

-- SECURITY LOGS
CREATE POLICY "Solo admin inserisce logs"
  ON security_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Solo admin legge logs"
  ON security_logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- =============================================
-- GRANT RPC ACCESS
-- =============================================

GRANT EXECUTE ON FUNCTION get_disponibilita(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_disponibilita(DATE, DATE) TO authenticated;

COMMIT;
