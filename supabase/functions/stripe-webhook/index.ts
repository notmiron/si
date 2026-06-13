// Control Garage – Stripe Webhook Edge Function
// Handles payment events from Stripe (checkout.session.completed).
//
// Deploy: supabase functions deploy stripe-webhook
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
//
// Configure in Stripe Dashboard → Webhooks:
//   URL: https://swyoegecrtctnevuqarm.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!secret) return true; // Skip verification if no secret (dev mode)

  const parts = sigHeader.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, val] = part.split("=");
    acc[key.trim()] = val;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return expectedSig === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  try {
    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature") || "";

    // Verify webhook signature
    const valid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error("Invalid Stripe signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (!bookingId) {
        console.error("No booking_id in session metadata");
        return new Response(JSON.stringify({ error: "Missing booking_id" }), { status: 400 });
      }

      // Update booking payment status
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error } = await supabase.from("prenotazioni").update({
        pagamento_stato: "pagato",
        stripe_payment_intent: session.payment_intent,
        pagamento_importo: session.amount_total,
      }).eq("id", bookingId);

      if (error) {
        console.error("DB update error:", error);
        return new Response(JSON.stringify({ error: "DB update failed" }), { status: 500 });
      }

      console.log(`Payment confirmed for booking ${bookingId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
});
