-- Security Logs table for Control Garage admin panel
-- Run this in the Supabase SQL Editor before deploying the updated admin.html

CREATE TABLE IF NOT EXISTS security_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  details jsonb DEFAULT '{}',
  user_email text,
  created_at timestamptz DEFAULT now()
);

-- RLS: only authenticated users can insert logs
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert logs"
  ON security_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users (admin) can read logs
CREATE POLICY "Authenticated users can read logs"
  ON security_logs FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast queries by event type and date
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs (created_at DESC);
