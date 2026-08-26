import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
import { getExperience } from "@/lib/experiences";

// A backup copy of the download link, sent to whatever email Apple/Google
// Pay handed over automatically -- nobody types anything for this, it's
// just a safety net in case someone closes the tab before saving the file
// on-page. Best-effort only: if this fails (no RESEND_API_KEY set yet, a
// bad address, Resend having a bad moment) the purchase itself still
// succeeded and the on-page download still works, so this never blocks
// or fails the actual sale.
async function sendBackupDownloadEmail({ to, title, fileUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Your download: ${title}`,
        html: `
          <p>Thanks for your purchase from ABRACADABRA — here's your download link again, in case you missed grabbing it on the page:</p>
          <p><a href="${fileUrl}">Download ${title} (full-res TIFF)</a></p>
          <p style="color:#888;font-size:13px">This file is built for high-quality physical prints, at 300 DPI — it may look soft or oversized on a phone or laptop screen. That's expected; it'll look sharp once printed.</p>
        `,
      }),
    });
  } catch (err) {
    console.error("Backup download email failed:", err);
  }
}

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
      // Fire-and-forget -- doesn't hold up the response, and never fails
      // the sale if it errors.
      sendBackupDownloadEmail({
        to: intent.receipt_email,
        title: product.title,
        fileUrl: product.fileUrl,
      });

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
