import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildKey, putObject } from "@/lib/r2";
import { generatePreviewJpeg, isPreviewGeneratable } from "@/lib/imagePreview";

// Opt-in only -- never runs automatically anywhere in the app. An artist
// explicitly triggers this per product (the "Generate preview" button in
// ProductManager, or the per-item/"for all of these" opt-in in bulk
// upload) because a machine-generated preview isn't guaranteed to look
// as good as one they exported by hand -- see the plan's open
// verification item on color management and sharpening.
export async function POST(req, { params }) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const productId = Number.parseInt(id, 10);

  const { rows: productRows } = await query(
    "select id, details from products where id = $1 and tenant_id = $2",
    [productId, tenant.id]
  );
  const product = productRows[0];
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  const { rows: fileRows } = await query(
    "select r2_key, content_type from product_files where product_id = $1 and kind = 'full'",
    [productId]
  );
  const fullFile = fileRows[0];
  if (!fullFile) {
    return NextResponse.json(
      { error: "This product has no full-res file to generate a preview from yet." },
      { status: 400 }
    );
  }
  if (!isPreviewGeneratable(fullFile.content_type, fullFile.r2_key)) {
    return NextResponse.json(
      {
        error:
          "This file type can't be auto-converted -- camera RAW formats (CR2/NEF/ARW/DNG) need your own exported preview for now.",
      },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await generatePreviewJpeg({ key: fullFile.r2_key });
  } catch (err) {
    console.error("Preview generation failed:", err);
    return NextResponse.json({ error: "Could not generate a preview from that file." }, { status: 500 });
  }

  const previewKey = buildKey(tenant.id, "preview_image", "generated.jpg");
  await putObject({ key: previewKey, body: result.buffer, contentType: "image/jpeg" });

  // Only one preview_image per product, same rule as a manual upload
  // (see app/api/dashboard/products/[id]/files/route.js) -- this replaces
  // whatever preview existed before, generated or not.
  await query("delete from product_files where product_id = $1 and kind = 'preview_image'", [productId]);
  await query(
    `insert into product_files (product_id, kind, r2_key, content_type, width_px, height_px)
     values ($1, 'preview_image', $2, 'image/jpeg', $3, $4)`,
    [productId, previewKey, result.width, result.height]
  );

  // Durable label (plan: "visibly and durably label whether its current
  // preview is the artist's own file or platform-generated ... not just
  // ask once and then hide the fact forever"). Stored in `details`
  // alongside the crop flag, same pattern.
  const details = { ...(product.details || {}), preview_generated: true };
  await query("update products set details = $1 where id = $2", [JSON.stringify(details), productId]);

  return NextResponse.json({ ok: true });
}
