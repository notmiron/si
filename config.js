/* ============================================
   Control Garage – Configurazione
   ============================================
   ISTRUZIONI: Sostituisci i valori placeholder
   con le tue credenziali Supabase e Resend.
   ============================================ */

const CONFIG = {
  // Supabase – Trova in: supabase.com → Settings → API
  SUPABASE_URL: 'https://swyoegecrtctnevuqarm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eW9lZ2VjcnRjdG5ldnVxYXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDU2MzUsImV4cCI6MjA5NjE4MTYzNX0.ywFzXCpTUGjgUoRf4URwfauC2dftSwf-OtTtIIUGPOA',

  // Info officina
  BUSINESS_NAME: 'Control Garage',
  BUSINESS_EMAIL: 'info@controlgarage.eu',
  // OWNER_EMAIL viene usato solo lato server (Supabase Edge Function)
  // Non esporre email personali nel frontend
  BUSINESS_PHONE: '388 922 9893',
  BUSINESS_ADDRESS: 'Via Ettore Benini, 3 – 47121 Forlì FC',
};
