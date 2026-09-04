import { NextResponse } from "next/server";
import { getProductFile } from "@/lib/orders";
import { getObjectStream } from "@/lib/r2";

// Public, ungated proxy for preview_image/preview_clip -- unlike
// /api/checkout/download and /api/checkout/download-preview (which both
// require a succeeded order), a storefront visitor browsing the feed has
// never bought anything yet and never will if they can't see the preview
// first. This is exactly what migrations/001_init.sql's schema comment on
// product_files means by "the public preview image, and (for audio) a
// short public preview clip" -- these were never meant to be gated.
//
// The `full` file a buyer pays for is deliberately NOT reachable through
// this route (kind is restricted below) -- that one only ever comes back
// through the order-gated download route.
//
// `video` is different from both: a video product's playable file is
// never gated at all -- watching is always free, with an optional
// donation as a completely separate, buyer-adjustable transaction (see
// the video+donate feature) -- so it belongs in this public set too,
// not behind the order-gated download route the way a paid `full` file is.
const PUBLIC_KINDS = new Set(["preview_image", "preview_clip", "video"]);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const productId = Number.parseInt(searchParams.get("productId"), 10);
  const kind = searchParams.get("kind");

  if (!Number.isFinite(productId) || !PUBLIC_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const file = await getProductFile(productId, kind);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let bytes;
  try {
    const object = await getObjectStream({ key: file.r2_key });
    bytes = await object.Body.transformToByteArray();
  } catch (err) {
    console.error("Preview: R2 fetch failed", err);
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.content_type,
      // Public and cacheable -- unlike the gated downloads (no-store),
      // there's nothing per-buyer about a preview; the same bytes are
      // shown to every visitor, so browsers/CDNs are free to cache them.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
