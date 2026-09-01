import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isUsableShippingAddress, toStripeShipping } from "@/lib/shipping";

// Lets a shopper add (or fix) a physical order's shipping address AFTER
// paying. The wallet sheet already asks for one up front (BuySection's
// requestShipping: true), but the plain "pay with card" fallback has no
// such prompt, and even a wallet buyer can decline/skip that OS step --
// so this is the catch-all that makes sure an address gets attached
// either way, without ever having blocked the payment itself on it.
// Stripe explicitly allows updating `shipping` on an already-succeeded
// PaymentIntent (one of the few fields still mutable post-success), so
// no separate database is needed for this site.
export async function POST(req) {
  try {
    const { paymentIntentId, shippingAddress } = await req.json();
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
    }
    if (!isUsableShippingAddress(shippingAddress)) {
      return NextResponse.json({ error: "That address looks incomplete." }, { status: 400 });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!intent) {
      return NextResponse.json({ error: "Unknown payment intent." }, { status: 400 });
    }
    if (intent.metadata?.type !== "physical") {
      return NextResponse.json({ error: "This item doesn't ship." }, { status: 400 });
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      shipping: toStripeShipping(shippingAddress),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
