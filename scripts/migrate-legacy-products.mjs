#!/usr/bin/env node
// Plain `node scripts/....mjs` doesn't auto-load .env.local the way
// `next dev` does -- this reads it manually so this script (and anyone
// else running it locally) doesn't need to prefix every invocation with
// their own env-loading flags. Real environment variables (e.g. set by
// Vercel in production) always take precedence over anything in the file.
import { readFileSync as __readFileSync } from "node:fs";
import __path from "node:path";
(function loadEnvLocal() {
  try {
    const text = __readFileSync(__path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local -- fine, real env vars take over (e.g. on Vercel).
  }
})();
// One-time migration: moves the founder's existing ~90 hardcoded products
// (lib/products.js + lib/product-files.js) into the new multi-tenant
// schema, as tenant #1. Parses both files as TEXT rather than importing
// them -- same reasoning as scripts/upload-tiffs.mjs: they're plain .js
// (not .mjs) files using `export const`, which node's CommonJS-by-default
// loader can't import directly without a package.json "type" change we
// don't want to make.
//
// Does NOT re-upload the full-res TIFFs -- they already live on R2 at
// their current keys, so this just records those same keys against the
// new product rows. It DOES upload each local public/previews/*.jpg to
// R2, since the new download-preview route serves previews from R2 like
// everything else, not from the local filesystem.
//
// Safe to re-run: skips any product that already has a row for this
// tenant (matched by title).
//
// Usage (needs DATABASE_URL + the same 5 R2_* vars as upload-tiffs.mjs):
//   TENANT_OWNER_EMAIL=you@example.com TENANT_SLUG=abracadabra \
//   TENANT_SHOP_NAME="ABRACADABRA" node scripts/migrate-legacy-products.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { putObject } from "../lib/r2.js";

const { Pool } = pg;

const {
  DATABASE_URL,
  POSTGRES_URL,
  POSTGRES_URL_NON_POOLING,
  TENANT_OWNER_EMAIL,
  TENANT_SLUG,
  TENANT_SHOP_NAME,
} = process.env;

const connectionString = DATABASE_URL || POSTGRES_URL || POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) before running this.");
  process.exit(1);
}
for (const [name, val] of Object.entries({ TENANT_OWNER_EMAIL, TENANT_SLUG, TENANT_SHOP_NAME })) {
  if (!val) {
    console.error(`Set ${name} before running this.`);
    process.exit(1);
  }
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  max: 1,
});

// --- Parse lib/products.js -------------------------------------------
async function loadLegacyProducts() {
  const text = await readFile(path.join(process.cwd(), "lib", "products.js"), "utf8");
  const products = [];
  // Each product is a single `{ ... }` block with no nested braces
  // (sizes is an array, not an object), so a non-greedy match to the
  // next `}` is safe here.
  for (const match of text.matchAll(/\{\s*id:\s*"[^"]+"[\s\S]*?\}/g)) {
    const block = match[0];
    const get = (re) => block.match(re)?.[1] ?? null;
    const id = get(/id:\s*"([^"]+)"/);
    const type = get(/type:\s*"([^"]+)"/);
    const title = get(/title:\s*"([^"]+)"/);
    const priceStr = get(/price:\s*(\d+)/);
    const image = get(/image:\s*"([^"]+)"/);
    if (!id || !type || !title || !priceStr) continue; // not a real product block
    products.push({ id, type, title, priceCents: Number.parseInt(priceStr, 10), image });
  }
  return products;
}

// --- Parse lib/product-files.js (digital TIFF URLs) -------------------
async function loadLegacyFiles() {
  const text = await readFile(path.join(process.cwd(), "lib", "product-files.js"), "utf8");
  const files = {};
  for (const match of text.matchAll(/"([^"]+)":\s*"(https:\/\/[^"]+)"/g)) {
    files[match[1]] = match[2];
  }
  return files;
}

// A full R2 public URL looks like https://pub-xxxx.r2.dev/tiffs/foo.tif --
// everything after the host is the key already stored in that same
// bucket, so no re-upload is needed for these.
function keyFromPublicUrl(url) {
  const marker = ".r2.dev/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function findOrCreateUser(client, email) {
  const existing = await client.query("select id from users where email = $1", [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query("insert into users (email) values ($1) returning id", [email]);
  return created.rows[0].id;
}

async function findOrCreateTenant(client, ownerUserId, slug, shopName) {
  const existing = await client.query("select id from tenants where slug = $1", [slug]);
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query(
    "insert into tenants (owner_user_id, slug, shop_name) values ($1, $2, $3) returning id",
    [ownerUserId, slug, shopName]
  );
  return created.rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    const [legacyProducts, legacyFiles] = await Promise.all([loadLegacyProducts(), loadLegacyFiles()]);
    console.log(`Found ${legacyProducts.length} legacy products.`);

    const ownerUserId = await findOrCreateUser(client, TENANT_OWNER_EMAIL.trim().toLowerCase());
    const tenantId = await findOrCreateTenant(client, ownerUserId, TENANT_SLUG.trim().toLowerCase(), TENANT_SHOP_NAME);
    console.log(`Using tenant #${tenantId} (${TENANT_SLUG}).`);

    let created = 0;
    let skipped = 0;

    for (const legacy of legacyProducts) {
      const existing = await client.query(
        "select id from products where tenant_id = $1 and title = $2",
        [tenantId, legacy.title]
      );
      if (existing.rows[0]) {
        skipped++;
        continue;
      }

      const dbType = legacy.type === "digital" ? "digital_image" : "physical";
      const details = legacy.type === "physical" ? {} : {}; // sizes could be added here if needed later

      const { rows } = await client.query(
        `insert into products (tenant_id, type, title, price_cents, details)
         values ($1, $2, $3, $4, $5) returning id`,
        [tenantId, dbType, legacy.title, legacy.priceCents, details]
      );
      const productId = rows[0].id;

      // Record the existing TIFF's key (already on R2 -- not re-uploaded).
      if (dbType === "digital_image") {
        const fullUrl = legacyFiles[legacy.id];
        const key = fullUrl ? keyFromPublicUrl(fullUrl) : null;
        if (key) {
          await client.query(
            `insert into product_files (product_id, kind, r2_key, content_type) values ($1, 'full', $2, 'image/tiff')`,
            [productId, key]
          );
        } else {
          console.warn(`  no TIFF URL found for "${legacy.title}" (${legacy.id}) -- skipping full file.`);
        }

        // Upload the local preview JPG to R2 so the new download-preview
        // route (R2-backed, unlike the old filesystem-backed one) has
        // something to serve.
        if (legacy.image) {
          try {
            const localPath = path.join(process.cwd(), "public", legacy.image);
            const buf = await readFile(localPath);
            const previewKey = `tenants/${tenantId}/preview_image/${legacy.id}.jpg`;
            await putObject({ key: previewKey, body: buf, contentType: "image/jpeg" });
            await client.query(
              `insert into product_files (product_id, kind, r2_key, content_type) values ($1, 'preview_image', $2, 'image/jpeg')`,
              [productId, previewKey]
            );
          } catch (err) {
            console.warn(`  preview upload failed for "${legacy.title}": ${err.message}`);
          }
        }
      }

      created++;
    }

    console.log(`Done. Created ${created}, skipped ${skipped} (already migrated).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
