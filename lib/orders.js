// Shared helpers for the two download routes -- both need to answer the
// same question ("does a succeeded order actually exist for this payment
// intent, and which product/tenant does it belong to?") from the same
// trusted source: the orders table written at PaymentIntent-creation time
// in /api/create-intent, never from anything a client submits directly.
import { query } from "@/lib/db";

export async function getSucceededOrder(paymentIntentId) {
  if (!paymentIntentId) return null;
  const { rows } = await query(
    `select o.*, p.title, p.type from orders o
     join products p on p.id = o.product_id
     where o.stripe_payment_intent_id = $1 and o.status = 'succeeded'`,
    [paymentIntentId]
  );
  return rows[0] || null;
}

export async function getProductFile(productId, kind) {
  const { rows } = await query(
    "select r2_key, content_type from product_files where product_id = $1 and kind = $2",
    [productId, kind]
  );
  return rows[0] || null;
}

// Extensions Content-Disposition actually gets right vs. a raw
// content-type second half (image/tiff -> "tif", not "tiff"; audio/mpeg
// -> "mp3", not "mpeg"). Falls back to the content-type's own subtype for
// anything not listed, which is fine for less common types.
const EXTENSION_OVERRIDES = {
  "image/tiff": "tif",
  "image/jpeg": "jpg",
  "audio/mpeg": "mp3",
};

export function extensionForContentType(contentType) {
  return EXTENSION_OVERRIDES[contentType] || contentType.split("/")[1] || "bin";
}

export function safeFilename(title, fallback) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}
