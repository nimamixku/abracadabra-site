// Resolves a tenant for the public storefront (app/sites/[tenant]),
// by slug (the normal <slug>.<rootdomain> case) or by a connected custom
// domain (paid tier, Phase 5). Deliberately separate from
// getSessionTenant in lib/auth.js -- that one answers "which shop does
// THIS SIGNED-IN OWNER manage," this one answers "which shop does this
// PUBLIC URL belong to," and the two must never be conflated (a
// storefront visitor is never authenticated as the shop owner).
import { query } from "@/lib/db";

export async function getTenantBySlug(slug) {
  if (!slug) return null;
  const { rows } = await query(
    `select id, slug, shop_name, stripe_connect_account_id, stripe_connect_status, selling_mode,
            bg_color, ink_color, compact_desktop
     from tenants where slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

export async function getTenantByCustomDomain(domain) {
  if (!domain) return null;
  const { rows } = await query(
    `select id, slug, shop_name, stripe_connect_account_id, stripe_connect_status, selling_mode,
            bg_color, ink_color, compact_desktop
     from tenants where custom_domain = $1`,
    [domain]
  );
  return rows[0] || null;
}

// Active, buyable products for a tenant's public storefront -- never
// exposes inactive/draft products, and joins in just the file metadata
// the feed needs to render a card (preview image/clip keys + dimensions)
// without a second round-trip per product.
export async function getStorefrontProducts(tenantId) {
  const { rows: products } = await query(
    `select id, type, title, description, price_cents, currency, details
     from products
     where tenant_id = $1 and active = true
     order by sort_order asc, id desc`,
    [tenantId]
  );
  if (products.length === 0) return [];

  // Only what the storefront actually needs before a purchase -- never
  // the gated "full" file's key. Nothing in the UI uses it (every image
  // renders through /api/preview, which resolves its own key server-side),
  // so there's no reason to ship a paid asset's storage location to an
  // unpaid visitor's browser at all, even though it isn't independently
  // fetchable today (no public R2 URL is configured anywhere in the app).
  const ids = products.map((p) => p.id);
  const { rows: files } = await query(
    `select product_id, kind, r2_key, content_type, width_px, height_px
     from product_files
     where product_id = any($1::bigint[]) and kind in ('preview_image', 'preview_clip')`,
    [ids]
  );

  const filesByProduct = new Map();
  for (const f of files) {
    if (!filesByProduct.has(f.product_id)) filesByProduct.set(f.product_id, {});
    filesByProduct.get(f.product_id)[f.kind] = f;
  }

  return products.map((p) => ({
    ...p,
    files: filesByProduct.get(p.id) || {},
  }));
}
