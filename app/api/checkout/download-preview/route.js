import { NextResponse } from "next/server";
import { getSucceededOrder, getProductFile, extensionForContentType, safeFilename } from "@/lib/orders";
import { getObjectStream } from "@/lib/r2";

// Sibling to app/api/checkout/download/route.js -- same reasoning, for
// the preview image instead of the full-res file. Still gated behind a
// succeeded order (same as the original single-tenant download-preview
// route) purely to keep the one-tap-save experience consistent and avoid
// this becoming a way to bulk-scrape every preview across every tenant by
// guessing product ids -- it's not gating anything secret, previews are
// already shown publicly on every card.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const paymentIntentId = searchParams.get("pi");
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
  }

  const order = await getSucceededOrder(paymentIntentId);
  if (!order) {
    return NextResponse.json({ error: "Payment not completed." }, { status: 402 });
  }

  const file = await getProductFile(order.product_id, "preview_image");
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  let bytes;
  try {
    const object = await getObjectStream({ key: file.r2_key });
    bytes = await object.Body.transformToByteArray();
  } catch (err) {
    console.error("Preview download: R2 fetch failed", err);
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }

  const filename = `${safeFilename(order.title, "preview")}-preview.${extensionForContentType(file.content_type)}`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
