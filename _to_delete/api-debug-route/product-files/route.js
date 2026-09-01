import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// TEMPORARY debug-only route -- delete after diagnosing the "File not
// found" download error. No auth gate; do not leave this in past the
// debugging session.
export async function GET() {
  const { rows: products } = await query(
    "select id, type, title, active from products order by id desc"
  );
  const { rows: files } = await query(
    "select product_id, kind, r2_key, content_type from product_files order by product_id desc"
  );
  const { rows: orders } = await query(
    "select stripe_payment_intent_id, product_id, status, created_at from orders order by id desc limit 10"
  );
  return NextResponse.json({ products, files, orders });
}
