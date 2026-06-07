// Control Garage – Email Edge Function
// Sends booking confirmation/rejection emails via Resend
//
// Deploy: supabase functions deploy send-email
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, name, type, date, fascia, service, note, proposta_data, proposta_fascia, business_name, business_phone, business_address } = body;

    // nuova_prenotazione can be called without auth (from the public booking form)
    // All other types require authenticated admin user
    if (type !== "nuova_prenotazione") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (!to || !name || !type) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sanitize user-controlled fields to prevent HTML injection
    const safeName = escapeHtml(name);
    const safeNote = escapeHtml(note);
    const safeService = escapeHtml(service);
    const safeBusinessName = escapeHtml(business_name);
    const safeBusinessPhone = escapeHtml(business_phone);
    const safeBusinessAddress = escapeHtml(business_address);

    const dateFormatted = formatDate(date);
    const fasciaLabel = fascia === "mattina" ? "Mattina" : "Pomeriggio";

    let subject = "";
    let html = "";

    if (type === "confermata") {
      subject = `Prenotazione Confermata - ${safeBusinessName}`;
      html = buildEmail({
        title: "Prenotazione Confermata!",
        greeting: `Ciao ${safeName},`,
        body: `La tua prenotazione è stata <strong>confermata</strong>.`,
        details: [
          { label: "Servizio", value: safeService },
          { label: "Data", value: dateFormatted },
          { label: "Fascia oraria", value: fasciaLabel },
        ],
        footer: `Ti aspettiamo! Se hai bisogno di modificare o cancellare, contattaci al ${safeBusinessPhone}.`,
        color: "#22c55e",
        business_name: safeBusinessName,
        business_address: safeBusinessAddress,
      });
    } else if (type === "rifiutata") {
      subject = `Aggiornamento Prenotazione - ${safeBusinessName}`;
      html = buildEmail({
        title: "Prenotazione Non Disponibile",
        greeting: `Ciao ${safeName},`,
        body: `Purtroppo non possiamo confermare la tua prenotazione per il <strong>${dateFormatted}</strong> (${fasciaLabel}).${safeNote ? `<br><br><em>"${safeNote}"</em>` : ""}`,
        details: [],
        footer: `Puoi prenotare un altro giorno sul nostro sito o contattarci al ${safeBusinessPhone}.`,
        color: "#ef4444",
        business_name: safeBusinessName,
        business_address: safeBusinessAddress,
      });
    } else if (type === "proposta") {
      const propostaDateFormatted = formatDate(proposta_data);
      const propostaFasciaLabel = proposta_fascia === "mattina" ? "Mattina" : "Pomeriggio";
      subject = `Nuova Proposta Orario - ${safeBusinessName}`;
      html = buildEmail({
        title: "Ti Proponiamo un Nuovo Orario",
        greeting: `Ciao ${safeName},`,
        body: `La data che hai richiesto (${dateFormatted}, ${fasciaLabel}) non è disponibile.${safeNote ? `<br><br><em>"${safeNote}"</em>` : ""}<br><br>Ti proponiamo:`,
        details: [
          { label: "Nuova data", value: propostaDateFormatted },
          { label: "Fascia oraria", value: propostaFasciaLabel },
          { label: "Servizio", value: safeService },
        ],
        footer: `Per confermare o scegliere un altro orario, visita il nostro sito o contattaci al ${safeBusinessPhone}.`,
        color: "#3b82f6",
        business_name: safeBusinessName,
        business_address: safeBusinessAddress,
      });
    } else if (type === "nuova_prenotazione") {
      // Notification to owner about new booking
      const ownerEmail = OWNER_EMAIL;
      if (!ownerEmail) {
        return new Response(JSON.stringify({ error: "OWNER_EMAIL not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const safeAuto = escapeHtml(body.auto || "");
      const safeTelefono = escapeHtml(body.telefono || "");
      const safeNoteCliente = escapeHtml(body.note_cliente || "");

      subject = `Nuova Prenotazione - ${safeBusinessName}`;
      html = buildEmail({
        title: "Nuova Prenotazione Ricevuta",
        greeting: `Nuova prenotazione da ${safeName}`,
        body: `Un cliente ha appena prenotato un appuntamento. Accedi alla dashboard per accettare o rifiutare.`,
        details: [
          { label: "Cliente", value: safeName },
          { label: "Email", value: escapeHtml(to) },
          ...(safeTelefono ? [{ label: "Telefono", value: safeTelefono }] : []),
          { label: "Auto", value: safeAuto || "-" },
          { label: "Servizio", value: safeService },
          { label: "Data", value: dateFormatted },
          { label: "Fascia oraria", value: fasciaLabel },
          ...(safeNoteCliente ? [{ label: "Note", value: safeNoteCliente }] : []),
        ],
        footer: `Accedi alla dashboard admin per gestire questa prenotazione.`,
        color: "#f59e0b",
        business_name: safeBusinessName,
        business_address: safeBusinessAddress,
      });

      // Send to owner instead of client
      const ownerRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [ownerEmail],
          subject,
          html,
        }),
      });

      const ownerData = await ownerRes.json();
      return new Response(JSON.stringify(ownerData), {
        status: ownerRes.ok ? 200 : 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } else if (type === "promemoria") {
      subject = `Promemoria Appuntamento - ${safeBusinessName}`;
      html = buildEmail({
        title: "Promemoria Appuntamento",
        greeting: `Ciao ${safeName},`,
        body: `Ti ricordiamo che hai un appuntamento domani.`,
        details: [
          { label: "Servizio", value: safeService },
          { label: "Data", value: dateFormatted },
          { label: "Fascia oraria", value: fasciaLabel },
          { label: "Indirizzo", value: safeBusinessAddress },
        ],
        footer: `Ti aspettiamo! Se non puoi venire, contattaci al ${safeBusinessPhone} il prima possibile.`,
        color: "#f59e0b",
        business_name: safeBusinessName,
        business_address: safeBusinessAddress,
      });
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error('send-email error:', err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

// =====================
// Email Template Builder
// =====================
function buildEmail(opts: {
  title: string;
  greeting: string;
  body: string;
  details: { label: string; value: string }[];
  footer: string;
  color: string;
  business_name: string;
  business_address: string;
}): string {
  const detailsHtml = opts.details.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:24px 0">
        ${opts.details.map(d => `
          <tr>
            <td style="padding:10px 16px;color:#999;font-size:14px;border-bottom:1px solid #222">${d.label}</td>
            <td style="padding:10px 16px;color:#f0f0f0;font-size:14px;font-weight:600;border-bottom:1px solid #222;text-align:right">${d.value}</td>
          </tr>
        `).join("")}
       </table>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <!-- Header -->
    <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #222">
      <div style="font-size:20px;font-weight:700;letter-spacing:3px;color:#fff">${opts.business_name.toUpperCase()}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;letter-spacing:1px">OFFICINA MECCATRONICA</div>
    </div>

    <!-- Status indicator -->
    <div style="text-align:center;margin:32px 0 24px">
      <div style="display:inline-block;padding:8px 24px;border-radius:50px;background:${opts.color}20;color:${opts.color};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
        ${opts.title}
      </div>
    </div>

    <!-- Content -->
    <div style="background:#181818;border:1px solid #222;border-radius:12px;padding:28px 24px">
      <p style="color:#f0f0f0;font-size:16px;margin:0 0 16px">${opts.greeting}</p>
      <p style="color:#999;font-size:14px;line-height:1.7;margin:0">${opts.body}</p>
      ${detailsHtml}
      <p style="color:#666;font-size:13px;line-height:1.6;margin:16px 0 0">${opts.footer}</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #222">
      <p style="color:#444;font-size:12px;margin:0">${opts.business_name} &mdash; ${opts.business_address}</p>
    </div>
  </div>
</body>
</html>`;
}

function formatDate(str: string): string {
  if (!str) return "-";
  const parts = str.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
