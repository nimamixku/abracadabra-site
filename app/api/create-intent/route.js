import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
import { getExperience } from "@/lib/experiences";

// Flat domestic shipping used for physical items' Apple Pay sheet. Edit
// this if you want free shipping, a different rate, or multiple options.
const SHIPPING_CENTS = 600;

export async function POST(req) {
  try {
    const { productId, experienceId, size } = await req.json();
    const stripe = getStripe();

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
    // actually get charged.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: product.price + shipping,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: "product",
        productId: product.id,
        title: product.title,
        size: size || "",
        type: product.type,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: product.price + shipping,
      shipping,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
