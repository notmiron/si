// Control Garage – Secure Booking Edge Function
// Validates Turnstile CAPTCHA, honeypot, timing, and rate limits before creating a booking.
//
// Deploy: supabase functions deploy create-booking
// Secrets:
//   supabase secrets set TURNSTILE_SECRET_KEY=0x...
//   (SUPABASE_SERVICE_ROLE_KEY is auto-available in Edge Functions)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") || "";
const FROM_EMAIL = "Control Garage <onboarding@resend.dev>";

const ALLOWED_ORIGINS = [
  "https://controlgarage.eu",
  "https://www.controlgarage.eu",
  "https://notmiron.github.io",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      servizio_id, nome, email, telefono, auto, km_auto, note,
      data, fascia_oraria, ora,
      // Anti-bot fields
      cf_turnstile_token, _hp_website, _form_loaded_at,
      // For email notification
      service_name, business_name, business_phone, business_address,
    } = body;

    // --- Anti-bot check 1: Honeypot ---
    if (_hp_website) {
      // Bot filled the hidden field — reject silently with fake success
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Anti-bot check 2: Timing (form must be open > 3 seconds) ---
    if (_form_loaded_at) {
      const elapsed = Date.now() - Number(_form_loaded_at);
      if (elapsed < 3000) {
        return new Response(JSON.stringify({ error: "Invio troppo veloce. Riprova tra qualche secondo." }), {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // --- Anti-bot check 3: Turnstile CAPTCHA (when configured) ---
    if (TURNSTILE_SECRET_KEY) {
      if (!cf_turnstile_token) {
        return new Response(JSON.stringify({ error: "Verifica anti-bot mancante. Ricarica la pagina e riprova." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET_KEY,
          response: cf_turnstile_token,
        }),
      });

      const turnstileData = await turnstileRes.json();
      if (!turnstileData.success) {
        return new Response(JSON.stringify({ error: "Verifica anti-bot fallita. Ricarica la pagina e riprova." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // --- Input validation ---
    if (!nome || !email || !auto || !servizio_id || !data || !fascia_oraria || !ora) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email non valida." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (telefono) {
      const telClean = telefono.replace(/[\s\-\.]/g, "");
      if (!/^\+?[0-9]{8,15}$/.test(telClean)) {
        return new Response(JSON.stringify({ error: "Telefono non valido." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (nome.length > 200 || email.length > 254 || auto.length > 200 ||
        (telefono && telefono.length > 20) || (km_auto && km_auto.length > 10) || (note && note.length > 2000)) {
      return new Response(JSON.stringify({ error: "Dati troppo lunghi." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Insert booking via service role (bypasses RLS, triggers still fire) ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: booking, error: insertError } = await supabaseAdmin
      .from("prenotazioni")
      .insert({
        servizio_id,
        nome,
        email,
        telefono: telefono || null,
        auto,
        km_auto: km_auto || null,
        note: note || null,
        data,
        fascia_oraria,
        ora: ora.includes(":00") ? ora : ora + ":00",
        stato: "in_attesa",
      })
      .select()
      .single();

    if (insertError) {
      const msg = insertError.message || "";
      let userMessage = "Si è verificato un errore. Riprova o contattaci telefonicamente.";
      let status = 500;

      if (msg.includes("gia una prenotazione")) {
        userMessage = "Hai già una prenotazione per questa data. Contattaci per modificarla.";
        status = 409;
      } else if (msg.includes("Slot non disponibile")) {
        userMessage = "Questo slot non è più disponibile. Prova un altro orario.";
        status = 409;
      } else if (msg.includes("Giorno chiuso")) {
        userMessage = "L'officina è chiusa in questa data. Scegli un altro giorno.";
        status = 409;
      } else if (msg.includes("Rate limit")) {
        userMessage = "Troppe prenotazioni. Riprova più tardi.";
        status = 429;
      }

      return new Response(JSON.stringify({ error: userMessage }), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Send owner notification (disabled for now) ---
    if (false && RESEND_API_KEY && OWNER_EMAIL) {
      const safeName = escapeHtml(nome);
      const safeService = escapeHtml(service_name || "");
      const safeAuto = escapeHtml(auto);
      const safeKmAuto = escapeHtml(km_auto || "");
      const safeTelefono = escapeHtml(telefono || "");
      const safeNoteCliente = escapeHtml(note || "");
      const safeBusinessName = escapeHtml(business_name || "Control Garage");
      const safeBusinessAddress = escapeHtml(business_address || "");
      const dateFormatted = data ? data.split("-").reverse().join("/") : "-";
      const fasciaLabel = fascia_oraria === "mattina" ? "Mattina" : "Pomeriggio";

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          subject: `Nuova Prenotazione - ${safeBusinessName}`,
          html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #222">
    <div style="font-size:20px;font-weight:700;letter-spacing:3px;color:#fff">${safeBusinessName.toUpperCase()}</div>
  </div>
  <div style="text-align:center;margin:32px 0 24px">
    <div style="display:inline-block;padding:8px 24px;border-radius:50px;background:#f59e0b20;color:#f59e0b;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Nuova Prenotazione</div>
  </div>
  <div style="background:#181818;border:1px solid #222;border-radius:12px;padding:28px 24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Cliente</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeName}</td></tr>
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Email</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${escapeHtml(email)}</td></tr>
      ${safeTelefono ? `<tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Telefono</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeTelefono}</td></tr>` : ""}
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Auto</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeAuto}</td></tr>
      ${safeKmAuto ? `<tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Km</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeKmAuto}</td></tr>` : ""}
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Servizio</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeService}</td></tr>
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Data</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${dateFormatted}</td></tr>
      <tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Fascia</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${fasciaLabel}</td></tr>
      ${safeNoteCliente ? `<tr><td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">Note</td><td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${safeNoteCliente}</td></tr>` : ""}
    </table>
    <p style="color:#666;font-size:13px;margin:16px 0 0">Accedi alla dashboard admin per gestire questa prenotazione.</p>
  </div>
</div>
</body></html>`,
        }),
      }).catch((e) => console.error("Owner email error:", e));
    }

    return new Response(JSON.stringify({ success: true, id: booking?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("create-booking error:", err);
    return new Response(JSON.stringify({ error: "Errore interno. Riprova." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
