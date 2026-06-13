// Control Garage – Stripe Checkout Edge Function
// Creates a Stripe Checkout Session for booking deposit payment.
//
// Deploy: supabase functions deploy create-checkout
// Set secret: supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://controlgarageforli.it",
  "https://www.controlgarageforli.it",
  "https://notmiron.github.io",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify user is admin
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const DEPOSIT_AMOUNT_CENTS = 12200; // €122.00 — hardcoded server-side
    const SUCCESS_URL = "https://notmiron.github.io/si/pagamento-successo.html?session_id={CHECKOUT_SESSION_ID}";
    const CANCEL_URL = "https://notmiron.github.io/si/pagamento-cancellato.html";

    const body = await req.json();
    const { booking_id, customer_name, customer_email, service_name, date, fascia } = body;

    if (!booking_id || !customer_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const fasciaLabel = fascia === "mattina" ? "Mattina" : "Pomeriggio";
    const dateFormatted = date ? date.split("-").reverse().join("/") : "";

    // Create Stripe Checkout Session
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "payment",
        "customer_email": customer_email,
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(DEPOSIT_AMOUNT_CENTS),
        "line_items[0][price_data][product_data][name]": `Acconto - ${service_name || "Prenotazione"}`,
        "line_items[0][price_data][product_data][description]": `${dateFormatted} (${fasciaLabel}) — ${customer_name || ""}`,
        "line_items[0][quantity]": "1",
        "payment_method_types[0]": "card",
        "success_url": SUCCESS_URL,
        "cancel_url": CANCEL_URL,
        "metadata[booking_id]": String(booking_id),
      }),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", stripeData);
      return new Response(JSON.stringify({ error: "Errore nel pagamento. Riprova." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update booking with checkout session ID
    await supabase.from("prenotazioni").update({
      stripe_session_id: stripeData.id,
      pagamento_stato: "in_attesa",
    }).eq("id", booking_id);

    return new Response(JSON.stringify({
      checkout_url: stripeData.url,
      session_id: stripeData.id,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("create-checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
