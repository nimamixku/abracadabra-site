import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
import { getExperience } from "@/lib/experiences";

// Flat domestic shipping used for physical items' Apple Pay sheet. Edit
// this if you want free shipping, a different rate, or multiple options.
const SHIPPING_CENTS = 600;

// Digital art's price shuffles between these three points on the client
// (see withShuffledPrice in app/page.js) purely for fun. We still never
// trust whatever the client says it saw -- only accept the request's price
// if it's one of these exact, pre-approved amounts.
const DIGITAL_PRICE_TIERS = [50, 75, 100];

// A very loose sanity check -- not real validation, just enough to avoid
// handing Stripe something obviously not an email (or a client sending
// junk on purpose). Apple/Google Pay supply this themselves; it's never
// typed in by hand for that flow.
function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req) {
  try {
    const { productId, experienceId, size, price, payerEmail } = await req.json();
    const stripe = getStripe();
    const receiptEmail = looksLikeEmail(payerEmail) ? payerEmail : undefined;

    // ---- a paid interactive feature (candle / marquee / oracle) ----
    if (experienceId) {
      const experience = getExperience(experienceId);
      if (!experience) {
        return NextResponse.json({ error: "Unknown experience." }, { status: 400 });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: experience.price,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: receiptEmail,
        metadata: {
          kind: "experience",
          experienceId: experience.id,
          title: experience.title,
        },
      });
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        amount: experience.price,
      });
    }

    // ---- a product (art print or clothing) ----
    const product = getProduct(productId);
    if (!product) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }
    if (product.type === "physical" && product.sizes && !size) {
      return NextResponse.json({ error: "Size is required." }, { status: 400 });
    }

    const shipping = product.type === "physical" ? SHIPPING_CENTS : 0;

    // Price and amount are computed here, server-side, from the catalog --
    // never trusted from the client -- so nobody can tamper with what they
    // actually get charged. The one exception is digital art's shuffled
    // price, which is only honored if it exactly matches one of the
    // pre-approved tiers above; anything else falls back to the catalog
    // price.
    const amount =
      product.type === "digital" && DIGITAL_PRICE_TIERS.includes(price)
        ? price
        : product.price;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount + shipping,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: receiptEmail,
      metadata: {
        kind: "product",
        productId: product.id,
        title: product.title,
        size: size || "",
        type: product.type,
        price: String(amount),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amount + shipping,
      shipping,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
