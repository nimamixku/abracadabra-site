import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildKey, createUploadUrl } from "@/lib/r2";

const ALLOWED_KINDS = new Set(["full", "preview_image", "preview_clip"]);

// Hands back a short-lived presigned PUT URL so the browser uploads
// straight to R2 -- large TIFFs never pass through a Vercel function
// body (same reasoning as scripts/upload-tiffs.mjs, just moved into the
// request path instead of a one-off script). The browser PUTs the file
// itself directly to the returned `uploadUrl`, then calls back to record
// the resulting key against the product (a second, small endpoint --
// not built yet, tracked in the Phase 2 task).
export async function POST(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { productId, kind, filename, contentType } = await req.json();
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid file kind." }, { status: 400 });
  }

  // Verify the product actually belongs to this tenant before handing out
  // an upload URL scoped to it -- never trust a client-submitted productId
  // alone (same instinct as the orders table's role in /api/download).
  const { rows } = await query("select id from products where id = $1 and tenant_id = $2", [
    productId,
    tenant.id,
  ]);
  if (!rows[0]) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const key = buildKey(tenant.id, kind, filename || "upload.bin");
  const uploadUrl = await createUploadUrl({ key, contentType: contentType || "application/octet-stream" });

  return NextResponse.json({ ok: true, key, uploadUrl });
}
