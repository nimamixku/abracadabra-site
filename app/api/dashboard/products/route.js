import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";
import { sanitizeCrop } from "@/lib/cropStyle";

// Phase 3: generalized beyond the v1 digital_image-only version -- now
// accepts any of the three launched types. New types still don't need a
// schema migration (see migrations/001_init.sql's comment on `details`),
// just a new branch here for whatever that type's own fields are.
const PRODUCT_TYPES = new Set(["digital_image", "digital_audio", "physical", "video"]);

export async function GET(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { rows } = await query(
    "select id, type, title, description, price_cents, details, active, created_at from products where tenant_id = $1 order by sort_order asc, id desc",
    [tenant.id]
  );

  // Dashboard-only view (the owner looking at their own shop), so unlike
  // the public storefront's getStorefrontProducts there's no reason to
  // withhold the "full" file's key here -- ProductManager needs to know
  // which kinds already exist per product (e.g. to show "Generate
  // preview" only when there's a full file and no preview yet).
  if (rows.length > 0) {
    const ids = rows.map((p) => p.id);
    const { rows: files } = await query(
      "select product_id, kind, r2_key, content_type from product_files where product_id = any($1::bigint[])",
      [ids]
    );
    const filesByProduct = new Map();
    for (const f of files) {
      if (!filesByProduct.has(f.product_id)) filesByProduct.set(f.product_id, {});
      filesByProduct.get(f.product_id)[f.kind] = f;
    }
    for (const p of rows) {
      p.files = filesByProduct.get(p.id) || {};
    }
  }

  return NextResponse.json({ products: rows });
}

export async function POST(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { title, description, priceCents, type, sizes, shippingCents, crop, draft, donateEnabled, donateSuggestedCents } =
    await req.json();
  const normalizedTitle = String(title || "").trim();
  const priceInt = Number.parseInt(priceCents, 10);
  const normalizedType = PRODUCT_TYPES.has(type) ? type : "digital_image";

  // Draft: saved immediately on file-drop, before an artist has typed a
  // title or price -- see ProductManager's immediate-upload-on-drop flow.
  // A draft can be created with nothing but a type; it stays invisible to
  // the real storefront (active=false, same column the storefront query
  // already filters on -- no separate "draft" flag needed) until it's
  // published later via PATCH .../[id] with active:true, which is where
  // title/price actually become required.
  const isDraft = Boolean(draft);

  if (!isDraft) {
    if (!normalizedTitle) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    // Every other type charges a price to unlock the file; a video
    // product is free to watch by design -- an optional donation is a
    // separate, buyer-adjustable amount at checkout time, never this
    // product's own price_cents (see the details block below).
    if (normalizedType !== "video" && (!Number.isFinite(priceInt) || priceInt <= 0)) {
      return NextResponse.json({ error: "Price must be a positive number of cents." }, { status: 400 });
    }
  }
  const safePriceInt =
    normalizedType === "video" ? 0 : Number.isFinite(priceInt) && priceInt >= 0 ? priceInt : 0;

  // Only `physical` has extra fields today -- sizes (optional; an item
  // with no size options just skips the size picker at checkout) and a
  // flat shipping fee added on top of the item price. Kept in `details`
  // rather than new columns, same reasoning as the schema comment.
  let details = {};
  if (normalizedType === "physical") {
    const sizeList = Array.isArray(sizes)
      ? sizes.map((s) => String(s).trim()).filter(Boolean)
      : String(sizes || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const shippingInt = Number.parseInt(shippingCents, 10);
    details = {
      ...(sizeList.length > 0 ? { sizes: sizeList } : {}),
      shipping_cents: Number.isFinite(shippingInt) && shippingInt >= 0 ? shippingInt : 0,
    };
  }

  // Free to watch, with an optional per-piece donation -- both the
  // opt-in itself and its suggested starting amount live here in
  // `details`, same reasoning as physical's sizes/shipping above. The
  // suggested amount is only ever a starting point shown on the donate
  // button (mirrors TryItDemo.js's DONATE_SUGGESTED_CENTS) -- never the
  // amount actually charged, which a buyer can always adjust upward via
  // the give-more stepper before paying.
  if (normalizedType === "video") {
    const suggestedInt = Number.parseInt(donateSuggestedCents, 10);
    details = {
      donate_enabled: Boolean(donateEnabled),
      donate_suggested_cents: Number.isFinite(suggestedInt) && suggestedInt > 0 ? suggestedInt : 1200,
    };
  }

  // Every type shows a photo in the feed (a cover image for audio, the
  // piece itself for digital_image, a product shot for physical) -- the
  // storefront's default is to never force-crop it (see the plan's "No
  // forced cropping, ever" principle), but an artist can opt a specific
  // product into an exact custom crop instead (see lib/cropStyle.js),
  // same idea as choosing a crop when posting to social media. Left out
  // of `details` entirely when not set, so "natural" isn't a stored value
  // the storefront has to special-case. In practice crop is never sent
  // this early anyway -- there's no photo yet at draft-creation time --
  // but this stays consistent with the PATCH route's own validation.
  const sanitizedCrop = sanitizeCrop(crop);
  if (sanitizedCrop) {
    details.crop = sanitizedCrop;
  }

  const { rows } = await query(
    `insert into products (tenant_id, type, title, description, price_cents, details, active)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, type, title, description, price_cents, details, active, created_at`,
    [
      tenant.id,
      normalizedType,
      normalizedTitle,
      String(description || "").trim(),
      safePriceInt,
      JSON.stringify(details),
      !isDraft,
    ]
  );
  return NextResponse.json({ ok: true, product: rows[0] });
}
