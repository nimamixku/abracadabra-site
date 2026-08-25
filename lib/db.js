// Tiny Postgres helper for the messages (DM) feature. Needs a
// DATABASE_URL (or POSTGRES_URL, which Vercel's own Postgres/Neon
// integration sets automatically) environment variable pointing at a
// Postgres database. See SETUP_MESSAGES.md at the repo root for how to
// set one up -- this file intentionally does nothing until that exists.

import { Pool } from "pg";

let pool;

function getPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING;

    if (!connectionString) {
      throw new Error(
        "No database configured. Set DATABASE_URL (or POSTGRES_URL) in your environment variables -- see SETUP_MESSAGES.md."
      );
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}
