-- ============================================
-- Control Garage – Anti-Bot Security Patch
-- ============================================
-- Esegui questo SQL nella Supabase Dashboard:
-- SQL Editor → New Query → incolla e Run
-- ============================================
-- Questo patch rimuove la possibilita di INSERT diretto nella tabella
-- prenotazioni tramite la anon key. Le prenotazioni passano ora
-- attraverso la Edge Function create-booking che usa la service_role key
-- e verifica CAPTCHA + honeypot + timing prima di inserire.
-- ============================================

-- Rimuovi la policy che permetteva INSERT anonimo diretto
DROP POLICY IF EXISTS "Chiunque puo prenotare" ON prenotazioni;

-- Ricrea una policy piu restrittiva: solo service_role e admin possono inserire
-- (La Edge Function usa service_role, quindi bypassa RLS automaticamente.
-- Questa policy serve solo come fallback per admin autenticati dalla dashboard.)
CREATE POLICY "Solo admin o service role inserisce prenotazioni"
  ON prenotazioni FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() AND stato = 'in_attesa');

-- NOTA: La service_role key bypassa tutte le RLS policies.
-- Dopo questo patch, un attaccante con solo la anon key NON puo piu
-- inserire prenotazioni direttamente nella tabella.
-- Deve passare per la Edge Function create-booking che verifica:
--   1. Honeypot (campo nascosto)
--   2. Timing (form aperto > 3 secondi)
--   3. Cloudflare Turnstile (se configurato)
--   4. Validazione input server-side
--   5. Rate limiting (trigger DB: max 5/email/ora)
