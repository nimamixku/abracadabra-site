import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { syncConnectStatus } from "@/lib/stripeConnect";

// Handles events from CONNECTED accounts only (account.updated today;
// payment_intent.* for order fulfillment lands here too once Phase 3's
// checkout rewrite is in place). Deliberately separate from
// /api/webhooks/platform-billing -- see the plan's Payments section for
// why these two must never share a handler or a signing secret.
export async function POST(req) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("Connect webhook signature check failed:", err.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Idempotency: Stripe can and does redeliver events. A unique
  // constraint on stripe_event_id makes a duplicate delivery a no-op
  // insert failure rather than double-processing anything.
  try {
    await query(
      "insert into stripe_webhook_events (stripe_event_id, source, type) values ($1, 'connect', $2)",
      [event.id, event.type]
    );
  } catch (err) {
    if (err.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  if (event.type === "account.updated") {
    await syncConnectStatus(event.data.object);
  }

  return NextResponse.json({ ok: true });
}
