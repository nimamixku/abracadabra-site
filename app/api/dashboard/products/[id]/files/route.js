import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";

const ALLOWED_KINDS = new Set(["full", "preview_image", "preview_clip"]);

// Called after the browser finishes PUTting a file straight to the
// presigned URL from /api/dashboard/uploads -- records which R2 key
// belongs to this product so the download routes can look it up later.
// We don't verify the object actually landed in R2 here; a missing file
// just surfaces as a 500 on download, same failure mode as any other
// storage hiccup, and isn't worth a second round-trip to R2 on every save.
export async function POST(req, { params }) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Next.js 16: dynamic route params are async and must be awaited before
  // reading properties off them -- reading params.id directly here always
  // produced undefined, so productId silently became NaN on every request.
  const { id } = await params;
  const productId = Number.parseInt(id, 10);
  const { kind, key, contentType } = await req.json();
  if (!ALLOWED_KINDS.has(kind) || !key || !contentType) {
    return NextResponse.json({ error: "Missing or invalid file details." }, { status: 400 });
  }

  const { rows: productRows } = await query(
    "select id, details from products where id = $1 and tenant_id = $2",
    [productId, tenant.id]
  );
  const product = productRows[0];
  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  // Only one file per (product, kind) makes sense today -- re-uploading a
  // preview image should replace it, not accumulate duplicates the
  // download routes would need to disambiguate between.
  await query("delete from product_files where product_id = $1 and kind = $2", [productId, kind]);
  const { rows } = await query(
    `insert into product_files (product_id, kind, r2_key, content_type)
     values ($1, $2, $3, $4) returning id, kind, r2_key, content_type`,
    [productId, kind, key, contentType]
  );

  // A manually-uploaded preview_image means this product's preview is
  // the artist's own file again, not a generated one -- clear the flag
  // /api/dashboard/products/[id]/generate-preview sets, same "always
  // reflects the current truth" instinct as that route's own comment.
  if (kind === "preview_image" && product.details?.preview_generated) {
    const details = { ...product.details, preview_generated: false };
    await query("update products set details = $1 where id = $2", [JSON.stringify(details), productId]);
  }

  return NextResponse.json({ ok: true, file: rows[0] });
}
