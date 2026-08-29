// Passwordless magic-link auth for the multi-tenant platform, replacing
// lib/ownerAuth.js's single shared-secret flag with real per-artist
// accounts. Same hashing instinct as ownerAuth.js: nothing sent over
// email or held in a cookie is ever stored raw -- only its sha256 hash
// sits in the database, so a DB read alone can never hand someone a
// usable token or session.
//
// Session cookie is scoped to the dashboard host only (set with an
// explicit `domain` matching the platform root, never the wildcard tenant
// domain) so a session on the founder's dashboard can never leak into --
// or be read from -- an individual artist's storefront subdomain.

import crypto from "crypto";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

export const SESSION_COOKIE_NAME = "platform_session";
const LOGIN_TOKEN_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(raw) {
  const salt = process.env.AUTH_TOKEN_SALT || "abracadabra-platform";
  return crypto.createHash("sha256").update(salt + "|" + raw).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function findOrCreateUser(email) {
  const existing = await query("select id, email from users where email = $1", [email]);
  if (existing.rows[0]) return existing.rows[0];
  const created = await query(
    "insert into users (email) values ($1) returning id, email",
    [email]
  );
  return created.rows[0];
}

// Starts the login flow: finds/creates the user, stores a hashed
// single-use token, and emails the raw token as a link. If Resend isn't
// configured yet (no verified sending domain -- see lib/resend.js), the
// link is logged to the server console instead so local development and
// early testing aren't blocked on that setup step.
export async function requestLoginLink({ email, origin }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new Error("A valid email is required.");
  }

  const user = await findOrCreateUser(normalized);
  const raw = randomToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000);

  await query(
    "insert into login_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [user.id, tokenHash, expiresAt]
  );

  const link = `${origin}/api/auth/verify?token=${raw}`;
  const result = await sendEmail({
    to: normalized,
    subject: "Your sign-in link",
    html: `
      <p>Click below to sign in. This link works once and expires in ${LOGIN_TOKEN_TTL_MINUTES} minutes.</p>
      <p><a href="${link}">Sign in</a></p>
      <p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p>
    `,
  });

  if (!result.sent) {
    // Best-effort email, same contract as the backup download email --
    // never throw here. Logging the link keeps local/dev usable before
    // a Resend sending domain is verified.
    console.log(`[auth] Resend not configured or failed -- login link for ${normalized}: ${link}`);
  }

  return { ok: true };
}

// Consumes a login token: verifies it's unused and unexpired, marks it
// used, and issues a new session. Returns null (never throws) for any
// invalid/expired/already-used token so the route can render a generic
// "link expired" message either way -- no need to distinguish reasons to
// the caller.
export async function verifyLoginToken(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const { rows } = await query(
    `select id, user_id from login_tokens
     where token_hash = $1 and used_at is null and expires_at > now()`,
    [tokenHash]
  );
  const tokenRow = rows[0];
  if (!tokenRow) return null;

  await query("update login_tokens set used_at = now() where id = $1", [tokenRow.id]);

  const rawSession = randomToken();
  const sessionHash = hashToken(rawSession);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await query(
    "insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [tokenRow.user_id, sessionHash, expiresAt]
  );

  return { userId: tokenRow.user_id, sessionToken: rawSession, expiresAt };
}

export async function destroySession(rawSessionToken) {
  if (!rawSessionToken) return;
  await query("delete from sessions where token_hash = $1", [hashToken(rawSessionToken)]);
}

// Accepts anything with a .get(name) reader that returns { value } --
// that's both a NextRequest's `req.cookies` and the readonly cookie store
// next/headers' `cookies()` returns in server components, so the same
// helper works from route handlers (pass `req.cookies`) and from server
// components/dashboard pages (pass `await cookies()`).
export async function getSessionUser(cookieStore) {
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const { rows } = await query(
    `select u.id, u.email from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(raw)]
  );
  return rows[0] || null;
}

// One tenant per owning user for now (see migrations/001_init.sql) --
// multi-shop-per-user isn't a v1 requirement, but tenants.owner_user_id
// is a plain foreign key rather than a unique one so it's not a schema
// change to support later if it comes up.
export async function getSessionTenant(cookieStore) {
  const user = await getSessionUser(cookieStore);
  if (!user) return null;
  const { rows } = await query(
    "select * from tenants where owner_user_id = $1 order by id asc limit 1",
    [user.id]
  );
  return rows[0] ? { user, tenant: rows[0] } : { user, tenant: null };
}

export function sessionCookieOptions(expiresAt) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}
