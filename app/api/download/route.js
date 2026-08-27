import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";
// Server-only -- never import this from a "use client" file. See the
// comment at the top of lib/product-files.js for why it's kept separate
// from lib/products.js.
import { getFileUrl } from "@/lib/product-files";

// Streams the real TIFF back to the browser with an explicit
// Content-Disposition: attachment header, instead of just linking the
// customer straight to the raw file sitting on Vercel Blob / Cloudflare
// R2.
//
// Why this exists: on a computer, a plain link to the storage URL mostly
// works fine. But iPhone's Safari has no reliable way to know that a
// random cross-origin URL is meant to be saved rather than viewed -- it
// just renders the TIFF inline as a photo, with no obvious way to save
// it (customers have to know to press-and-hold the image). Serving the
// file from our own domain, with a real Content-Disposition header, is
// the standard fix: every browser -- including Safari on iPhone --
// treats that as an unambiguous "download this" instruction and drops it
// straight into the customer's Files app instead of just displaying it.
//
// This also re-checks with Stripe that the payment actually succeeded,
// rather than trusting the link alone -- so this URL can't be used to
// pull a file for a payment that never went through.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const paymentIntentId = searchParams.get("pi");
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
  }

  const stripe = getStripe();
  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return NextResponse.json({ error: "Invalid payment intent." }, { status: 400 });
  }

  if (intent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment not completed." }, { status: 402 });
  }

  const product = getProduct(intent.metadata.productId);
  if (!product || product.type !== "digital") {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  const fileUrl = getFileUrl(product.id);
  if (!fileUrl || fileUrl === "PENDING_TIFF_UPLOAD") {
    return NextResponse.json(
      { error: "This file isn't uploaded yet -- contact support." },
      { status: 404 }
    );
  }

  let upstream;
  try {
    // no-store: this is a per-purchase file fetch, not something Next.js
    // should ever try to cache/reuse across requests.
    upstream = await fetch(fileUrl, { cache: "no-store" });
  } catch (err) {
    console.error("Download proxy: upstream fetch threw", err);
    return NextResponse.json(
      { error: "Could not retrieve file.", detail: String(err && err.message) },
      { status: 502 }
    );
  }
  if (!upstream.ok || !upstream.body) {
    console.error(
      "Download proxy: upstream responded",
      upstream.status,
      upstream.statusText
    );
    return NextResponse.json(
      {
        error: "Could not retrieve file.",
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText,
      },
      { status: 502 }
    );
  }

  // A clean, human-readable filename for the download, e.g. "her-curves"
  // -> "her-curves.tif" -- falls back to the raw product id if the title
  // has nothing but punctuation in it for some reason.
  const safeName =
    product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || product.id;

  const headers = {
    "Content-Type": "image/tiff",
    "Content-Disposition": `attachment; filename="${safeName}.tif"`,
    "Cache-Control": "private, no-store",
  };
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(upstream.body, { status: 200, headers });
}
