#!/usr/bin/env node
// One-off test for the Phase 3 verification item: "a webhook-only
// completion (simulate closing the tab right after payment) still marks
// the order succeeded." This deliberately never calls our own
// /api/checkout/confirm -- it creates a real order the same way the
// browser does, then confirms the PaymentIntent directly against
// Stripe's API (as if the buyer's tab died the instant after paying), so
// the ONLY thing that can flip the order to 'succeeded' is the
// payment_intent.succeeded Connect webhook we just built.
//
// Requires: `next dev` running on localhost:3000, and `stripe listen
// --forward-to localhost:3000/api/webhooks/connect` running in another
// terminal (so Stripe can actually deliver the webhook to your machine).
//
// Usage: node scripts/test-webhook-only-completion.mjs

import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import Stripe from "stripe";

(function loadEnvLocal() {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // fine, real env vars take over
  }
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: tenantRows } = await client.query(
    "select id, slug, shop_name, stripe_connect_account_id, stripe_connect_status, platform_fee_bps from tenants order by id asc limit 1"
  );
  const tenant = tenantRows[0];
  if (!tenant) throw new Error("No tenant found -- create a shop first.");
  if (tenant.stripe_connect_status !== "active") {
    throw new Error(`Tenant "${tenant.shop_name}" payouts aren't active yet -- finish Connect onboarding first.`);
  }

  const { rows: productRows } = await client.query(
    "select id, title, type, price_cents from products where tenant_id = $1 and active = true order by id desc limit 1",
    [tenant.id]
  );
  const product = productRows[0];
  if (!product) throw new Error("No active product found for this tenant.");

  console.log(`Using tenant "${tenant.shop_name}" (${tenant.slug}), product "${product.title}" (${product.type}, id ${product.id})`);

  // Step 1: create the order + PaymentIntent exactly the way the real
  // checkout UI does -- same endpoint, same code path.
  const createRes = await fetch("http://localhost:3000/api/checkout/create-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantSlug: tenant.slug,
      productId: product.id,
      payerEmail: "webhook-only-test@example.com",
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(`create-intent failed: ${createData.error}`);

  const paymentIntentId = createData.clientSecret.split("_secret_")[0];
  console.log(`Created PaymentIntent ${paymentIntentId} (order should be 'pending' now)`);

  const { rows: pendingCheck } = await client.query(
    "select status from orders where stripe_payment_intent_id = $1",
    [paymentIntentId]
  );
  console.log(`Order status right after creation: ${pendingCheck[0]?.status}`);

  // Step 2: confirm the PaymentIntent DIRECTLY against Stripe -- not
  // through our app at all. This is the "buyer's tab died right after
  // Face ID" simulation: Stripe now has a succeeded charge, but our
  // server has no idea yet except via the webhook.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const confirmed = await stripe.paymentIntents.confirm(
    paymentIntentId,
    {
      payment_method: "pm_card_visa",
      // Required because create-intent enables automatic_payment_methods
      // broadly (so real checkout can offer Apple/Google Pay later) --
      // Stripe wants a return_url on hand in case a redirect-based method
      // gets used, even though pm_card_visa itself never redirects.
      return_url: "http://localhost:3000/test-checkout",
    },
    { stripeAccount: tenant.stripe_connect_account_id }
  );
  console.log(`Confirmed directly via Stripe API -- Stripe's own status: ${confirmed.status}`);
  console.log(`(Deliberately did NOT call /api/checkout/confirm -- only the webhook can save us now.)`);

  // Step 3: give the webhook a few seconds to arrive via `stripe listen`
  // and update the order, then check.
  console.log("Waiting up to 10s for the payment_intent.succeeded webhook to land...");
  let finalStatus = null;
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const { rows } = await client.query(
      "select status, updated_at from orders where stripe_payment_intent_id = $1",
      [paymentIntentId]
    );
    finalStatus = rows[0]?.status;
    if (finalStatus === "succeeded") break;
  }

  console.log("");
  if (finalStatus === "succeeded") {
    console.log("✅ PASS -- order was marked 'succeeded' by the webhook alone, with no browser/confirm call involved.");
  } else {
    console.log(`❌ FAIL -- order status is still '${finalStatus}'. Is \`stripe listen --forward-to localhost:3000/api/webhooks/connect\` running?`);
  }

  // Second check: did the platform's cut actually come out to what
  // tenant.platform_fee_bps says it should be, and does what we told
  // Stripe to collect (application_fee_amount) match what Stripe itself
  // recorded on the PaymentIntent? This is the plan's other outstanding
  // Phase 3 verification item -- not just "a charge went through" but
  // "the split was actually computed and applied correctly."
  const { rows: orderRows } = await client.query(
    "select amount_cents, application_fee_cents from orders where stripe_payment_intent_id = $1",
    [paymentIntentId]
  );
  const orderRow = orderRows[0];
  const expectedFee = Math.round((orderRow.amount_cents * tenant.platform_fee_bps) / 10000);
  const artistNetCents = orderRow.amount_cents - orderRow.application_fee_cents;

  console.log("");
  console.log(`Order amount: $${(orderRow.amount_cents / 100).toFixed(2)} | platform_fee_bps: ${tenant.platform_fee_bps} (${(tenant.platform_fee_bps / 100).toFixed(2)}%)`);
  console.log(`Expected platform fee: $${(expectedFee / 100).toFixed(2)} | orders.application_fee_cents: $${(orderRow.application_fee_cents / 100).toFixed(2)}`);
  console.log(`Stripe's own application_fee_amount on the PaymentIntent: $${(confirmed.application_fee_amount / 100).toFixed(2)}`);
  console.log(`Artist's net (amount - platform fee): $${(artistNetCents / 100).toFixed(2)}`);

  const feeMathCorrect = expectedFee === orderRow.application_fee_cents;
  const stripeMatchesOurRecord = confirmed.application_fee_amount === orderRow.application_fee_cents;

  if (feeMathCorrect && stripeMatchesOurRecord) {
    console.log("✅ PASS -- platform fee math is correct, and Stripe actually applied the same amount we recorded.");
  } else {
    console.log("❌ FAIL -- fee mismatch. feeMathCorrect=" + feeMathCorrect + " stripeMatchesOurRecord=" + stripeMatchesOurRecord);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Test script error:", err.message);
  process.exit(1);
});
