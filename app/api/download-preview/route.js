import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/products";

// Sibling to /api/download, same reasoning -- see that route's comment for
// the full explanation. In short: a plain <a href="/previews/foo.jpg"
// download> link works on desktop, but Safari on iPhone ignores the
// `download` attribute for same-origin static files too, and just opens
// the JPG inline instead of saving it -- no obvious way for a customer to
// get it into their Files/Photos app besides pressing and holding. Serving
// it from this route instead, with a real Content-Disposition header, is
// the same fix as the TIFF route: every browser -- including Safari on
// iPhone -- treats that as an unambiguous "download this" instruction.
//
// Unlike the TIFF, the preview JPG is already a public, unpriced asset
// (it's shown on every product card whether or not anyone's bought
// anything) -- so this route re-checks Stripe the same way /api/download
// does purely to keep the "download" experience consistent and to avoid
// this becoming an easy way to bulk-scrape every preview image by id
// without so much as loading the shop page. It's not gating anything
// secret, just matching the one-tap-save behavior customers already get
// for the TIFF.
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
  if (!product || product.type !== "digital" || !product.image) {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  // product.image is always one of our own literal "/previews/xxx.jpg"
  // entries from lib/products.js -- never anything derived from the
  // request -- so there's no path-traversal surface here despite reading
  // from disk by path.
  const filePath = path.join(process.cwd(), "public", product.image);

  let buf;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    console.error("Preview download: read failed", err);
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }

  const safeName =
    product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || product.id;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${safeName}-preview.jpg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
