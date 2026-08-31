import { NextResponse } from "next/server";

// Resolves <slug>.<rootdomain> to app/sites/[tenant] via a rewrite --
// deliberately does NOT touch the database here (middleware traditionally
// runs on Vercel's Edge runtime, which the `pg` driver this project uses
// everywhere else doesn't support). The actual tenant lookup happens in
// app/sites/[tenant]/page.js instead, a normal server component, which
// 404s if the slug doesn't match a real tenant. This file's only job is
// "does the Host header look like it belongs to a tenant subdomain, and
// if so, which slug" -- pure string parsing, nothing that needs a DB.
//
// PLATFORM_ROOT_DOMAIN isn't set yet (no domain purchased -- see the
// plan's Phase 1 prep step); until it is, only the *.localhost pattern
// below matches, which is enough to develop and test the whole storefront
// locally. Add the real domain to PLATFORM_ROOT_DOMAIN once it exists and
// production subdomains start working with no other code changes needed.
const ROOT_DOMAIN = process.env.PLATFORM_ROOT_DOMAIN || "";

// Hosts that should NEVER be treated as a tenant subdomain, even though
// they technically have a dot in them or otherwise might parse oddly --
// the bare root domain and its www, plus every local-dev spelling.
const RESERVED_HOSTS = new Set(["localhost", "127.0.0.1", "www"]);

function extractSlug(host) {
  if (!host) return null;
  const hostname = host.split(":")[0]; // strip the port, e.g. "bible.localhost:3000"

  // Local dev: anything.localhost -- Chrome/Safari/Firefox all resolve
  // *.localhost to 127.0.0.1 automatically, no /etc/hosts editing needed.
  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    return RESERVED_HOSTS.has(slug) ? null : slug;
  }

  // Production: anything.<rootdomain>, once PLATFORM_ROOT_DOMAIN is set.
  if (ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return RESERVED_HOSTS.has(slug) ? null : slug;
  }

  return null;
}

export function middleware(req) {
  const host = req.headers.get("host");
  const slug = extractSlug(host);

  // No subdomain match -- bare root domain / localhost / an unrelated
  // preview URL. Let it fall through to the normal app router (dashboard,
  // login, marketing page, etc.) untouched.
  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${slug}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and API routes -- a tenant subdomain should still
  // reach the platform's own API routes normally (e.g. checkout), not get
  // rewritten into a page path.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
