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

  const productId = Number.parseInt(params.id, 10);
  const { kind, key, contentType } = await req.json();
  if (!ALLOWED_KINDS.has(kind) || !key || !contentType) {
    return NextResponse.json({ error: "Missing or invalid file details." }, { status: 400 });
  }

  const { rows: productRows } = await query(
    "select id from products where id = $1 and tenant_id = $2",
    [productId, tenant.id]
  );
  if (!productRows[0]) {
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

  return NextResponse.json({ ok: true, file: rows[0] });
}
