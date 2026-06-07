-- ============================================
-- Control Garage – Migrazione RLS Fix
-- ============================================
-- Applica questo SQL su un DB esistente per correggere le policy RLS.
-- Esegui nella Supabase Dashboard: SQL Editor → New Query → incolla e Run
--
-- IMPORTANTE: dopo aver eseguito questa migrazione, inserisci l'UUID
-- del tuo utente admin (vedi in fondo al file).
-- ============================================

BEGIN;

-- =====================
-- 1. Crea tabella admin_users (se non esiste)
-- =====================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- =====================
-- 2. Crea funzione helper is_admin()
-- =====================
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
-- 3. Drop TUTTE le vecchie policy
-- =====================

-- prenotazioni
DROP POLICY IF EXISTS "Chiunque puo prenotare" ON prenotazioni;
DROP POLICY IF EXISTS "Solo admin legge prenotazioni" ON prenotazioni;
DROP POLICY IF EXISTS "Solo admin aggiorna prenotazioni" ON prenotazioni;
DROP POLICY IF EXISTS "Solo admin cancella prenotazioni" ON prenotazioni;

-- servizi
DROP POLICY IF EXISTS "Tutti leggono servizi" ON servizi;
DROP POLICY IF EXISTS "Solo admin modifica servizi" ON servizi;
DROP POLICY IF EXISTS "Solo admin inserisce servizi" ON servizi;
DROP POLICY IF EXISTS "Solo admin aggiorna servizi" ON servizi;
DROP POLICY IF EXISTS "Solo admin cancella servizi" ON servizi;

-- impostazioni
DROP POLICY IF EXISTS "Tutti leggono impostazioni" ON impostazioni;
DROP POLICY IF EXISTS "Solo admin modifica impostazioni" ON impostazioni;

-- admin_users
DROP POLICY IF EXISTS "Solo admin legge admin_users" ON admin_users;

-- =====================
-- 4. Ricrea policy corrette
-- =====================

-- ADMIN_USERS
CREATE POLICY "Solo admin legge admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_admin());

-- PRENOTAZIONI
CREATE POLICY "Chiunque puo prenotare"
  ON prenotazioni FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

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

COMMIT;

-- =====================
-- 5. SETUP ADMIN
-- =====================
-- Trova il tuo UUID admin nella Supabase Dashboard:
--   Authentication → Users → copia l'UUID del tuo utente
--
-- Poi esegui:
-- INSERT INTO admin_users (user_id) VALUES ('INSERISCI-QUI-IL-TUO-UUID');
