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
// Tiny migration runner -- no ORM, just tracks which migrations/*.sql
// files have already run in a schema_migrations table and applies the
// rest in filename order, each inside its own transaction.
//
// Usage: node scripts/migrate.mjs
// Needs DATABASE_URL (or POSTGRES_URL) set, same as lib/db.js.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error(
    "No database configured. Set DATABASE_URL (or POSTGRES_URL) before running migrations."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
  max: 1,
});

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    );
  `);
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const { rows } = await client.query("select filename from schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ranAny = false;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
        console.log(`  done.`);
        ranAny = true;
      } catch (err) {
        await client.query("rollback");
        console.error(`  FAILED: ${file}`);
        throw err;
      }
    }

    if (!ranAny) console.log("Already up to date -- nothing to apply.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
