-- Migration: Add Stripe payment fields to prenotazioni
-- Run this in the Supabase SQL Editor

-- Add payment columns
ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS pagamento_stato TEXT DEFAULT 'non_richiesto'
    CHECK (pagamento_stato IN ('non_richiesto', 'in_attesa', 'pagato', 'fallito', 'rimborsato')),
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_importo INTEGER; -- in cents (12200 = €122.00)

-- Index for looking up by stripe session
CREATE INDEX IF NOT EXISTS idx_prenotazioni_stripe_session
  ON prenotazioni (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Allow admin users to update payment fields
-- (RLS policies should already allow admin updates on prenotazioni)
