import { NextResponse } from "next/server";
import { getSessionUser, getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const SELLING_MODES = new Set(["fiat", "crypto"]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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

// Updates the two customizable colors on the signed-in owner's own shop
// (never any other tenant's -- scoped by getSessionTenant, same instinct
// as every other dashboard route). Either field can be sent alone; the
// other keeps whatever it already was. An explicit null clears a color
// back to the platform default rather than leaving it stuck once set.
export async function PATCH(req) {
  const { user, tenant } = await getSessionTenant(req.cookies);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!tenant) return NextResponse.json({ error: "No shop yet." }, { status: 400 });

  const { bgColor, inkColor, shopName, compactDesktop } = await req.json();

  for (const [label, value] of [["bgColor", bgColor], ["inkColor", inkColor]]) {
    if (value !== undefined && value !== null && !HEX_COLOR_RE.test(value)) {
      return NextResponse.json({ error: `${label} must be a hex color like #0b0b0d.` }, { status: 400 });
    }
  }

  // Typed directly into the dashboard's own masthead (ShopNameEditor.js)
  // -- same "edit it right where it's shown" pattern as the colors
  // above, just for the shop's name instead of its palette. Blank is
  // rejected rather than silently clearing the name a shop already has.
  let normalizedShopName;
  if (shopName !== undefined) {
    normalizedShopName = String(shopName).trim();
    if (!normalizedShopName) {
      return NextResponse.json({ error: "Shop name can't be empty." }, { status: 400 });
    }
  }

  // compact_desktop is a plain boolean (not a nullable "unset means
  // default" field like the colors/name above) -- there's no third
  // state to preserve, so it's simplest to just carry the existing
  // value through unchanged when the field isn't sent.
  const nextCompactDesktop = compactDesktop === undefined ? tenant.compact_desktop : Boolean(compactDesktop);

  const { rows } = await query(
    `update tenants set
       bg_color = case when $2::text is distinct from '__unset__' then $2 else bg_color end,
       ink_color = case when $3::text is distinct from '__unset__' then $3 else ink_color end,
       shop_name = case when $4::text is distinct from '__unset__' then $4 else shop_name end,
       compact_desktop = $5
     where id = $1
     returning id, bg_color, ink_color, shop_name, compact_desktop`,
    [
      tenant.id,
      bgColor === undefined ? "__unset__" : bgColor,
      inkColor === undefined ? "__unset__" : inkColor,
      normalizedShopName === undefined ? "__unset__" : normalizedShopName,
      nextCompactDesktop,
    ]
  );
  return NextResponse.json({ ok: true, tenant: rows[0] });
}
