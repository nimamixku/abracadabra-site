import { NextResponse } from "next/server";
import { getSucceededOrder, getProductFile, extensionForContentType, safeFilename } from "@/lib/orders";
import { getObjectStream } from "@/lib/r2";

// Tenant/Connect-aware replacement for the single-tenant
// app/api/download/route.js. Same core mechanic that makes files actually
// save on iPhone Safari (proxy the file with our own Content-Disposition
// header, see the original route's comment for the full explanation) --
// generalized to read the tenant/product from the `orders` table instead
// of a hardcoded product list, and the file's real content-type from
// product_files instead of assuming every product is a TIFF.
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

  const file = await getProductFile(order.product_id, "full");
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  let bytes;
  try {
    const object = await getObjectStream({ key: file.r2_key });
    bytes = await object.Body.transformToByteArray();
  } catch (err) {
    console.error("Download: R2 fetch failed", err);
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }

  const filename = `${safeFilename(order.title, "download")}.${extensionForContentType(file.content_type)}`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
