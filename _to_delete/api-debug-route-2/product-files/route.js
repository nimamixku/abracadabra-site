import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// TEMPORARY debug-only route -- delete after diagnosing test-checkout
// issues. No auth gate; do not leave this in past the debugging session.
export async function GET() {
  const { rows: products } = await query(
    "select id, tenant_id, type, title, price_cents, details, active, created_at from products order by id desc"
  );
  const { rows: files } = await query(
    "select product_id, kind, r2_key, content_type, created_at from product_files order by product_id desc, kind asc"
  );
  const { rows: orders } = await query(
    "select id, stripe_payment_intent_id, product_id, status, amount_cents, created_at from orders order by id desc limit 15"
  );
  return NextResponse.json({ products, files, orders });
}
