import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";

const CROP_OPTIONS = new Set(["square", "portrait"]);

// Finishing a draft (see POST .../products' `draft` flag) or editing an
// already-published product -- same endpoint either way, since the only
// real difference is whether `active` flips from false to true. Partial
// update: only fields present in the body are touched, so ProductManager
// can send just `{ active: true }` to unpublish without resending
// everything else, or the full edited form when saving changes.
export async function PATCH(req, { params }) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const productId = Number.parseInt(id, 10);

  const { rows: productRows } = await query(
    "select id, type, details from products where id = $1 and tenant_id = $2",
    [productId, tenant.id]
  );
  const product = productRows[0];
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  const { title, description, priceCents, sizes, shippingCents, crop, active, donateEnabled, donateSuggestedCents } =
    await req.json();

  const fields = [];
  const values = [];
  let i = 1;

  // Publishing (active:true) is the one moment a draft's missing title/
  // price actually has to be filled in -- same requirement as a non-draft
  // POST. Editing an already-published product, or just saving progress
  // on a draft without publishing, never forces this.
  if (title !== undefined) {
    const normalizedTitle = String(title || "").trim();
    if (active === true && !normalizedTitle) {
      return NextResponse.json({ error: "Title is required to publish." }, { status: 400 });
    }
    fields.push(`title = $${i++}`);
    values.push(normalizedTitle);
  }
  if (description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(String(description || "").trim());
  }
  if (priceCents !== undefined) {
    const priceInt = Number.parseInt(priceCents, 10);
    // Video is free to watch -- its price_cents always stays 0, and
    // publishing one never requires a price the way every other type
    // does. A donation amount is unrelated and lives in `details` below.
    if (product.type !== "video" && active === true && (!Number.isFinite(priceInt) || priceInt <= 0)) {
      return NextResponse.json(
        { error: "Price must be a positive number of cents to publish." },
        { status: 400 }
      );
    }
    fields.push(`price_cents = $${i++}`);
    values.push(product.type === "video" ? 0 : Number.isFinite(priceInt) && priceInt >= 0 ? priceInt : 0);
  }
  if (active !== undefined) {
    fields.push(`active = $${i++}`);
    values.push(Boolean(active));
  }

  // sizes/shippingCents/crop all live in the same `details` jsonb column,
  // merged into the existing value rather than replacing it wholesale
  // (same pattern as generate-preview's preview_generated flag) -- so
  // setting one doesn't clobber the others.
  const details = { ...(product.details || {}) };
  let detailsChanged = false;
  if (product.type === "physical") {
    if (sizes !== undefined) {
      const sizeList = Array.isArray(sizes)
        ? sizes.map((s) => String(s).trim()).filter(Boolean)
        : String(sizes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (sizeList.length > 0) details.sizes = sizeList;
      else delete details.sizes;
      detailsChanged = true;
    }
    if (shippingCents !== undefined) {
      const shippingInt = Number.parseInt(shippingCents, 10);
      details.shipping_cents = Number.isFinite(shippingInt) && shippingInt >= 0 ? shippingInt : 0;
      detailsChanged = true;
    }
  }
  if (product.type === "video") {
    if (donateEnabled !== undefined) {
      details.donate_enabled = Boolean(donateEnabled);
      detailsChanged = true;
    }
    if (donateSuggestedCents !== undefined) {
      const suggestedInt = Number.parseInt(donateSuggestedCents, 10);
      details.donate_suggested_cents = Number.isFinite(suggestedInt) && suggestedInt > 0 ? suggestedInt : 1200;
      detailsChanged = true;
    }
  }
  if (crop !== undefined) {
    if (CROP_OPTIONS.has(crop)) details.crop = crop;
    else delete details.crop;
    detailsChanged = true;
  }
  if (detailsChanged) {
    fields.push(`details = $${i++}`);
    values.push(JSON.stringify(details));
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  fields.push("updated_at = now()");
  values.push(productId, tenant.id);
  const { rows } = await query(
    `update products set ${fields.join(", ")}
     where id = $${i++} and tenant_id = $${i}
     returning id, type, title, description, price_cents, details, active, created_at`,
    values
  );
  return NextResponse.json({ ok: true, product: rows[0] });
}

// Ownership-checked delete. product_files cascades with the product (see
// migrations/001_init.sql's "on delete cascade"), so there's nothing extra
// to clean up here -- the R2 objects themselves are left orphaned rather
// than deleted inline, same tradeoff the app already makes elsewhere.
export async function DELETE(req, { params }) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const productId = Number.parseInt(id, 10);

  const { rows } = await query("delete from products where id = $1 and tenant_id = $2 returning id", [
    productId,
    tenant.id,
  ]);
  if (!rows[0]) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
