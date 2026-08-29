import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const SELLING_MODES = new Set(["fiat", "crypto"]);

// Creates the artist's shop. One per user for now (see lib/auth.js's
// getSessionTenant comment) -- this route 400s if the session already
// owns one rather than silently creating a second.
export async function POST(req) {
  const user = await getSessionUser(req.cookies);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const existing = await query("select id from tenants where owner_user_id = $1", [user.id]);
  if (existing.rows[0]) {
    return NextResponse.json({ error: "You already have a shop." }, { status: 400 });
  }

  const { slug, shopName, sellingMode } = await req.json();
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const normalizedName = String(shopName || "").trim();
  // Defaults to fiat if omitted or unrecognized, rather than 400ing --
  // this field is a forward-looking preference, not something worth
  // blocking shop creation over.
  const normalizedSellingMode = SELLING_MODES.has(sellingMode) ? sellingMode : "fiat";

  if (!SLUG_RE.test(normalizedSlug)) {
    return NextResponse.json(
      { error: "Shop URL must be 3-32 lowercase letters, numbers, or hyphens." },
      { status: 400 }
    );
  }
  if (!normalizedName) {
    return NextResponse.json({ error: "Shop name is required." }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `insert into tenants (owner_user_id, slug, shop_name, selling_mode)
       values ($1, $2, $3, $4) returning id, slug, shop_name, selling_mode`,
      [user.id, normalizedSlug, normalizedName, normalizedSellingMode]
    );
    return NextResponse.json({ ok: true, tenant: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return NextResponse.json({ error: "That shop URL is already taken." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
