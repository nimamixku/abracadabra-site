import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";

// Tenant + Connect-aware replacement for the single-tenant
// app/api/confirm/route.js. Looks the order up by payment intent id
// first (never trusts a client-submitted tenant/product), re-verifies
// with Stripe against that order's OWN connected account (a PaymentIntent
// id from one connected account means nothing on another), then marks it
// succeeded exactly once.
export async function POST(req) {
  try {
    const { paymentIntentId } = await req.json();
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
    }

    const { rows } = await query(
      `select o.*, p.title, p.type, p.details from orders o
       join products p on p.id = o.product_id
       where o.stripe_payment_intent_id = $1`,
      [paymentIntentId]
    );
    const order = rows[0];
    if (!order) {
      return NextResponse.json({ error: "Unknown payment intent." }, { status: 400 });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: order.stripe_connect_account_id,
    });

    if (intent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 402 });
    }

    if (order.status !== "succeeded") {
      await query("update orders set status = 'succeeded', updated_at = now() where id = $1", [order.id]);
    }

    const origin = new URL(req.url).origin;

    if (order.type === "digital_image" || order.type === "digital_audio") {
      return NextResponse.json({
        ok: true,
        type: order.type,
        title: order.title,
        downloadUrl: `${origin}/api/checkout/download?pi=${encodeURIComponent(paymentIntentId)}`,
      });
    }

    return NextResponse.json({
      ok: true,
      type: order.type,
      title: order.title,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
