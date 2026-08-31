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

// Looks an order up regardless of status -- used by the two paths that
// can each independently learn a PaymentIntent succeeded (the browser's
// own /api/checkout/confirm call, and the payment_intent.succeeded
// Connect webhook) so either one can find the order to mark, no matter
// which arrives first.
export async function getOrderByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return null;
  const { rows } = await query(
    `select o.*, p.title, p.type from orders o
     join products p on p.id = o.product_id
     where o.stripe_payment_intent_id = $1`,
    [paymentIntentId]
  );
  return rows[0] || null;
}

// The single place that flips an order to 'succeeded'. Shared by
// /api/checkout/confirm (client-triggered, right after
// stripe.confirmCardPayment resolves in the browser) and the
// payment_intent.succeeded Connect webhook (server-triggered, fires
// independently of whether the browser is even still around) -- so a
// buyer whose tab dies or connection drops the instant after Face ID
// confirms still ends up with a succeeded order, because the webhook
// covers it even if the client-side confirm call never happens. Both
// callers must already have verified success from a trusted source
// before calling this (Stripe's own retrieve for confirm; the
// signature-verified event itself for the webhook) -- this function's
// only job is the idempotent DB write, safe to call twice for the same
// order from either path in either order.
export async function markOrderSucceeded(paymentIntentId) {
  const order = await getOrderByPaymentIntent(paymentIntentId);
  if (!order) return null;
  if (order.status !== "succeeded") {
    await query("update orders set status = 'succeeded', updated_at = now() where id = $1", [order.id]);
    order.status = "succeeded";
  }
  return order;
}

// Sibling to markOrderSucceeded for the failure path -- mainly so a
// failed/canceled PaymentIntent doesn't leave its order stuck on
// 'pending' forever with no record of what actually happened to it.
export async function markOrderFailed(paymentIntentId) {
  const order = await getOrderByPaymentIntent(paymentIntentId);
  if (!order) return null;
  if (order.status !== "succeeded" && order.status !== "failed") {
    await query("update orders set status = 'failed', updated_at = now() where id = $1", [order.id]);
    order.status = "failed";
  }
  return order;
}

// Bare-minimum shape check for a shipping address -- shared by
// /api/checkout/create-intent (an address supplied up front, before
// paying) and /api/checkout/shipping-address (one added after the fact,
// once payment already succeeded -- see that route's own comment for
// why a physical purchase is allowed to happen in either order).
export function isUsableShippingAddress(addr) {
  if (!addr || typeof addr !== "object") return false;
  const required = ["name", "line1", "city", "state", "postalCode"];
  return required.every((k) => typeof addr[k] === "string" && addr[k].trim().length > 0);
}

// Attaches (or replaces) an order's shipping address after the fact --
// used when a shopper paid before filling in where to ship, rather than
// at PaymentIntent-creation time. Doesn't require the order to already
// be 'succeeded': the address is just data about where the item goes,
// independent of payment status, so there's no reason to block saving it
// early either.
export async function setOrderShippingAddress(paymentIntentId, address) {
  const order = await getOrderByPaymentIntent(paymentIntentId);
  if (!order) return null;
  await query("update orders set shipping_address = $1, updated_at = now() where id = $2", [
    JSON.stringify(address),
    order.id,
  ]);
  order.shipping_address = address;
  return order;
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
  // Browsers report .m4a files under several different MIME types
  // depending on OS/browser -- all of them need to come back out as
  // ".m4a", or macOS/iOS has no app association and refuses to open the
  // downloaded file (this is exactly the "no application set to open
  // this document" bug we hit testing digital_audio downloads).
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
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
