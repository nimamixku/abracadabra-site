import { NextResponse } from "next/server";
import { verifyLoginToken, sessionCookieOptions } from "@/lib/auth";

// Consumes the one-time token from the emailed link, sets the session
// cookie, and redirects into the dashboard. Redirects to a `?error=` state
// instead of the dashboard on any failure -- expired, already used, or
// just malformed -- rather than a raw JSON error, since this is a link a
// person clicks from their inbox, not an API call.
export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  const result = await verifyLoginToken(token);
  if (!result) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  const res = NextResponse.redirect(`${origin}/dashboard`);
  res.cookies.set({
    ...sessionCookieOptions(result.expiresAt),
    value: result.sessionToken,
  });
  return res;
}
