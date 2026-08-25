import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
import { getExperience } from "@/lib/experiences";

// Called right after the Apple Pay sheet confirms, to double-check
// server-side that Stripe actually marked the payment as succeeded before
// handing back the real download link (products) or unlocking the
// interactive feature (experiences). This is what keeps the TIFF URL --
// and the paid interactive features -- from ever being reachable by
// someone who hasn't paid.
export async function POST(req) {
  try {
    const { paymentIntentId } = await req.json();
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 402 });
    }

    if (intent.metadata.kind === "experience") {
      const experience = getExperience(intent.metadata.experienceId);
      if (!experience) {
        return NextResponse.json({ error: "Unknown experience." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        kind: "experience",
        experienceId: experience.id,
        paymentIntentId: intent.id,
      });
    }

    const product = getProduct(intent.metadata.productId);
    if (!product) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }

    if (product.type === "digital") {
      return NextResponse.json({
        ok: true,
        kind: "product",
        type: "digital",
        title: product.title,
        fileUrl: product.fileUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      kind: "product",
      type: "physical",
      title: product.title,
      size: intent.metadata.size || null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
