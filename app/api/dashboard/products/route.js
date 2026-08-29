import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";

// v1 dashboard only creates digital_image products directly (the type
// the founder's own ~90-product catalog already is) -- audio/physical
// generalization lands in Phase 3 alongside Stripe Connect, per the plan.
export async function GET(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { rows } = await query(
    "select id, type, title, description, price_cents, active, created_at from products where tenant_id = $1 order by sort_order asc, id desc",
    [tenant.id]
  );
  return NextResponse.json({ products: rows });
}

export async function POST(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { title, description, priceCents } = await req.json();
  const normalizedTitle = String(title || "").trim();
  const priceInt = Number.parseInt(priceCents, 10);

  if (!normalizedTitle) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!Number.isFinite(priceInt) || priceInt <= 0) {
    return NextResponse.json({ error: "Price must be a positive number of cents." }, { status: 400 });
  }

  const { rows } = await query(
    `insert into products (tenant_id, type, title, description, price_cents)
     values ($1, 'digital_image', $2, $3, $4)
     returning id, type, title, description, price_cents, active, created_at`,
    [tenant.id, normalizedTitle, String(description || "").trim(), priceInt]
  );
  return NextResponse.json({ ok: true, product: rows[0] });
}
