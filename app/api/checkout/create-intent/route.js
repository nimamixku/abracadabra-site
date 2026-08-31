import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { isUsableShippingAddress } from "@/lib/orders";

// A very loose sanity check, same as the original single-tenant route --
// not real validation, just enough to avoid handing Stripe something
// obviously wrong. Apple/Google Pay supply this themselves.
function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Tenant + Connect-aware replacement for the single-tenant
// app/api/create-intent/route.js. Price, shipping, and the platform's cut
// are all computed here from the database -- never trusted from the
// client -- and an `orders` row is written before the PaymentIntent is
// even returned to the browser, so /api/download and /api/confirm always
// have a trustworthy record to resolve the right tenant/Connect account
// from, no matter what a client sends later.
//
// This is a NEW route path (not yet wired into any frontend -- the
// tenant storefront that will call it is Phase 4 work). It exists now so
// the Connect payment mechanics can be tested directly (e.g. via curl or
// a minimal test page) against a Stripe test-mode Connect account before
// any real UI depends on it.
export async function POST(req) {
  try {
    const { tenantSlug, productId, payerEmail, size, shippingAddress } = await req.json();
    if (!tenantSlug || !productId) {
      return NextResponse.json({ error: "Missing tenant or product." }, { status: 400 });
    }

    const { rows: tenantRows } = await query(
      "select id, stripe_connect_account_id, stripe_connect_status, platform_fee_bps from tenants where slug = $1",
      [tenantSlug]
    );
    const tenant = tenantRows[0];
    if (!tenant || !tenant.stripe_connect_account_id || tenant.stripe_connect_status !== "active") {
      return NextResponse.json({ error: "This shop can't accept payments yet." }, { status: 400 });
    }

    const { rows: productRows } = await query(
      "select id, type, title, price_cents, currency, details from products where id = $1 and tenant_id = $2 and active = true",
      [productId, tenant.id]
    );
    const product = productRows[0];
    if (!product) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }

    const sizes = product.details?.sizes;
    if (product.type === "physical" && Array.isArray(sizes) && sizes.length > 0 && !size) {
      return NextResponse.json({ error: "Size is required." }, { status: 400 });
    }
    // A shipping address is welcome here if the shopper already filled it
    // in, but NOT required -- per the plan's shopping-order flexibility,
    // a physical purchase can go through first and pick up its address
    // afterward via /api/checkout/shipping-address instead. Either order
    // ends up with the same thing: an order row with a usable address
    // before it ships, never a charge silently missing one forever.
    const shippingCents = product.type === "physical" ? Number(product.details?.shipping_cents || 0) : 0;

    const amount = product.price_cents + shippingCents;
    const applicationFeeCents = Math.round((amount * tenant.platform_fee_bps) / 10000);

    const stripe = getStripe();
    const receiptEmail = looksLikeEmail(payerEmail) ? payerEmail : undefined;

    // Direct charge on the artist's own connected account -- the artist
    // is the merchant of record, money lands with them minus the
    // platform's cut. See the plan's Payments section for why this is
    // structurally separate from the platform's own Stripe Billing
    // subscription relationship.
    // Only stored if it's actually well-formed -- an optional, possibly
    // half-filled address from the client is worth ignoring rather than
    // saving garbage; the shopper (or the post-purchase prompt) can
    // always supply a real one via /api/checkout/shipping-address.
    const usableShipping =
      product.type === "physical" && isUsableShippingAddress(shippingAddress) ? shippingAddress : null;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: product.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: receiptEmail,
        application_fee_amount: applicationFeeCents,
        metadata: {
          tenantId: String(tenant.id),
          productId: String(product.id),
          size: size || "",
        },
        // Also attached directly on the PaymentIntent (visible in Stripe's
        // own dashboard) as a convenient second copy -- `orders` below is
        // still the source of truth the app itself reads from.
        ...(usableShipping
          ? {
              shipping: {
                name: usableShipping.name,
                address: {
                  line1: usableShipping.line1,
                  line2: usableShipping.line2 || undefined,
                  city: usableShipping.city,
                  state: usableShipping.state,
                  postal_code: usableShipping.postalCode,
                  country: usableShipping.country || "US",
                },
              },
            }
          : {}),
      },
      { stripeAccount: tenant.stripe_connect_account_id }
    );

    await query(
      `insert into orders
        (tenant_id, product_id, stripe_payment_intent_id, stripe_connect_account_id,
         application_fee_cents, amount_cents, currency, customer_email, status, shipping_address)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)`,
      [
        tenant.id,
        product.id,
        paymentIntent.id,
        tenant.stripe_connect_account_id,
        applicationFeeCents,
        amount,
        product.currency,
        receiptEmail || null,
        usableShipping ? JSON.stringify(usableShipping) : null,
      ]
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      // The frontend must initialize Stripe.js with this same connected
      // account (loadStripe(pk, { stripeAccount })) -- a client secret
      // from a connected account's PaymentIntent only works against that
      // account's context, not the platform's own.
      stripeAccount: tenant.stripe_connect_account_id,
      amount,
      shipping: shippingCents,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
