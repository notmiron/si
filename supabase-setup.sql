-- ============================================
-- Control Garage – Database Setup
-- ============================================
-- Esegui questo SQL nella Supabase Dashboard:
-- SQL Editor → New Query → incolla e Run
-- ============================================

-- =====================
-- Tabella: servizi
-- =====================
CREATE TABLE servizi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT,
  durata_minuti INTEGER NOT NULL DEFAULT 60,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Servizi di default (basati sul sito Control Garage)
INSERT INTO servizi (nome, descrizione, durata_minuti, ordine) VALUES
  ('Diagnostica Computerizzata', 'Lettura centraline, sensori, codici errore', 60, 1),
  ('Tagliando', 'Tagliando completo con ricambi di qualita', 120, 2),
  ('Freni', 'Sostituzione pastiglie, dischi, controllo impianto frenante', 120, 3),
  ('Manutenzione Generale', 'Sospensioni, distribuzione, cambio olio e altri interventi', 120, 4),
  ('Rimappatura Centralina', 'Rimappatura ECU per prestazioni o risparmio', 120, 5),
  ('Tuning & Elaborazioni', 'Scarichi sportivi, assetti, upgrade prestazionali', 180, 6),
  ('Elettronica & Meccatronica', 'Centraline, codifiche, sistemi elettronici avanzati', 120, 7),
  ('Altro', 'Altro tipo di intervento – descrivere nelle note', 60, 8);

-- =====================
-- Tabella: impostazioni
-- =====================
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

-- Inserisci impostazioni di default
INSERT INTO impostazioni (id) VALUES (1);

-- =====================
-- Tabella: prenotazioni
-- =====================
CREATE TABLE prenotazioni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  servizio_id UUID REFERENCES servizi(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  auto TEXT NOT NULL,
  note TEXT,
  data DATE NOT NULL,
  fascia_oraria TEXT NOT NULL CHECK (fascia_oraria IN ('mattina', 'pomeriggio')),
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'confermata', 'rifiutata', 'completata', 'cancellata')),
  risposta_note TEXT,
  proposta_data DATE,
  proposta_fascia TEXT CHECK (proposta_fascia IN ('mattina', 'pomeriggio')),
  letta BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_prenotazioni_data ON prenotazioni(data);
CREATE INDEX idx_prenotazioni_stato ON prenotazioni(stato);
CREATE INDEX idx_prenotazioni_created ON prenotazioni(created_at DESC);

-- =====================
-- Funzione: aggiorna updated_at
-- =====================
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

-- =====================
-- Trigger: impedisce INSERT se slot pieno (server-side)
-- =====================
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

CREATE TRIGGER check_disponibilita_before_insert
  BEFORE INSERT ON prenotazioni
  FOR EACH ROW EXECUTE FUNCTION check_slot_disponibilita();

-- =====================
-- Funzione RPC: conta prenotazioni per slot
-- (usata dal form pubblico per mostrare disponibilita)
-- =====================
CREATE OR REPLACE FUNCTION get_disponibilita(data_inizio DATE, data_fine DATE)
RETURNS TABLE (
  giorno DATE,
  fascia TEXT,
  conteggio BIGINT
) AS $$
BEGIN
  IF data_fine - data_inizio > 45 THEN
    RAISE EXCEPTION 'Intervallo massimo 45 giorni';
  END IF;

  RETURN QUERY
  SELECT p.data AS giorno, p.fascia_oraria AS fascia, COUNT(*) AS conteggio
  FROM prenotazioni p
  WHERE p.data BETWEEN data_inizio AND data_fine
    AND p.stato IN ('in_attesa', 'confermata')
  GROUP BY p.data, p.fascia_oraria;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- Tabella: giorni_chiusi (date di chiusura/festivi)
-- =====================
CREATE TABLE giorni_chiusi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_giorni_chiusi_data ON giorni_chiusi(data);

-- =====================
-- Tabella: admin_users
-- =====================
-- Contiene gli UUID degli utenti Supabase Auth abilitati come admin.
-- Per aggiungere un admin: INSERT INTO admin_users (user_id) VALUES ('<uuid>');
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- Funzione helper: is_admin()
-- =====================
-- SECURITY DEFINER: gira con i privilegi del creatore (bypass RLS sulla
-- tabella admin_users), cosi le policy possono chiamarla senza loop.
-- STABLE: il risultato non cambia dentro la stessa transazione → il planner
-- puo cachare il valore ed evitare una subquery per ogni riga.
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

-- =====================
-- Rate Limiting: max 5 prenotazioni per email per ora
-- =====================
CREATE INDEX idx_prenotazioni_email_created
  ON prenotazioni(email, created_at DESC);

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

-- =====================
-- Row Level Security (RLS)
-- =====================
ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE servizi ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ADMIN_USERS
-- Solo un admin puo vedere chi e admin (evita enumerazione)
CREATE POLICY "Solo admin legge admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_admin());

-- PRENOTAZIONI
-- Chiunque puo inserire una prenotazione (form pubblico)
-- Forza stato = 'in_attesa' per impedire inserimenti gia confermati via API
CREATE POLICY "Chiunque puo prenotare"
  ON prenotazioni FOR INSERT
  TO anon, authenticated
  WITH CHECK (stato = 'in_attesa');

-- Solo admin legge tutte le prenotazioni (dati sensibili: nome, email, telefono, auto)
CREATE POLICY "Solo admin legge prenotazioni"
  ON prenotazioni FOR SELECT
  TO authenticated
  USING (is_admin());

-- Solo admin puo aggiornare (confermare, rifiutare, ecc.)
CREATE POLICY "Solo admin aggiorna prenotazioni"
  ON prenotazioni FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Solo admin puo cancellare
CREATE POLICY "Solo admin cancella prenotazioni"
  ON prenotazioni FOR DELETE
  TO authenticated
  USING (is_admin());

-- SERVIZI
-- Tutti possono leggere i servizi (form pubblico)
CREATE POLICY "Tutti leggono servizi"
  ON servizi FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Solo admin inserisce servizi
CREATE POLICY "Solo admin inserisce servizi"
  ON servizi FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Solo admin aggiorna servizi
CREATE POLICY "Solo admin aggiorna servizi"
  ON servizi FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Solo admin cancella servizi
CREATE POLICY "Solo admin cancella servizi"
  ON servizi FOR DELETE
  TO authenticated
  USING (is_admin());

-- IMPOSTAZIONI
-- Tutti possono leggere le impostazioni (per disponibilita nel form)
CREATE POLICY "Tutti leggono impostazioni"
  ON impostazioni FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Solo admin modifica impostazioni
CREATE POLICY "Solo admin modifica impostazioni"
  ON impostazioni FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- GIORNI_CHIUSI
ALTER TABLE giorni_chiusi ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere i giorni chiusi (calendario pubblico)
CREATE POLICY "Tutti leggono giorni_chiusi"
  ON giorni_chiusi FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Solo admin inserisce giorni chiusi
CREATE POLICY "Solo admin inserisce giorni_chiusi"
  ON giorni_chiusi FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Solo admin cancella giorni chiusi
CREATE POLICY "Solo admin cancella giorni_chiusi"
  ON giorni_chiusi FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================
-- Grant accesso alla funzione RPC per utenti anonimi
-- =====================
GRANT EXECUTE ON FUNCTION get_disponibilita(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_disponibilita(DATE, DATE) TO authenticated;
