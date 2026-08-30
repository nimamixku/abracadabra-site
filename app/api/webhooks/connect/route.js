import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { syncConnectStatus } from "@/lib/stripeConnect";
import { getOrderByPaymentIntent, markOrderSucceeded, markOrderFailed } from "@/lib/orders";

// Handles events from CONNECTED accounts only: account.updated (syncs
// payouts status for the dashboard) and payment_intent.succeeded /
// payment_intent.payment_failed / payment_intent.canceled (order
// fulfillment -- the server-side half of confirming a purchase,
// independent of whether the buyer's browser is still around to call
// /api/checkout/confirm). Deliberately separate from
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

  // The webhook-only completion path: covers a buyer whose tab dies or
  // whose connection drops the instant after Face ID/Touch ID confirms,
  // before the browser's own fetch("/api/checkout/confirm") ever
  // completes. Without this, that order stays stuck on 'pending' forever
  // even though Stripe actually charged the card and the artist should
  // get paid -- exactly the gap the plan's Phase 3 verification called
  // out. event.account is the connected account this event came from
  // (Connect events carry it); cross-checking it against the order's own
  // stripe_connect_account_id before writing anything means a
  // same-payment-intent-id collision across two different connected
  // accounts (astronomically unlikely, but free to guard) can never mark
  // the wrong tenant's order.
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const order = await getOrderByPaymentIntent(intent.id);
    if (order && event.account && order.stripe_connect_account_id !== event.account) {
      // Should never happen -- payment_intent ids are scoped per
      // connected account -- but never write an order as succeeded
      // based on an event from an account that doesn't match the one it
      // was created under.
      console.error(
        `Connect webhook: payment_intent ${intent.id} account mismatch -- order belongs to ${order.stripe_connect_account_id}, event came from ${event.account}`
      );
    } else if (order) {
      await markOrderSucceeded(intent.id);
    }
  }

  // Sibling case: a card that gets declined/canceled after the
  // PaymentIntent was created (and the orders row written) should end up
  // as a recorded 'failed' order, not stuck on 'pending' with no trace of
  // what happened -- same reasoning as the succeeded case above.
  if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    await markOrderFailed(event.data.object.id);
  }

  return NextResponse.json({ ok: true });
}
