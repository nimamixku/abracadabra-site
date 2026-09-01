// Shared, pure shipping-address helpers for the single-tenant site's
// checkout routes. Unlike the multi-tenant platform (which has its own
// `orders` table), this site has no database at all -- Stripe's own
// PaymentIntent object is where a physical order's address lives, via
// its `shipping` field, both at creation time and (Stripe explicitly
// allows this) via an update after the PaymentIntent has succeeded.
// Deliberately not imported from lib/orders.js (a platform/multi-tenant
// file) to keep this page's dependencies unrelated to the DB.

export function isUsableShippingAddress(addr) {
  if (!addr || typeof addr !== "object") return false;
  const required = ["name", "line1", "city", "state", "postalCode"];
  return required.every((k) => typeof addr[k] === "string" && addr[k].trim().length > 0);
}

// Converts our own flat draft shape ({name, line1, line2, city, state,
// postalCode, country}) into the shape Stripe's PaymentIntent `shipping`
// field expects.
export function toStripeShipping(addr) {
  return {
    name: addr.name,
    address: {
      line1: addr.line1,
      line2: addr.line2 || undefined,
      city: addr.city,
      state: addr.state,
      postal_code: addr.postalCode,
      country: addr.country || "US",
    },
  };
}
