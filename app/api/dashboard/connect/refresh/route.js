import { NextResponse } from "next/server";

// Stripe sends the browser here if an onboarding link expired or was
// abandoned mid-flow -- just bounce back to the dashboard, where clicking
// "connect payouts" again calls /start fresh (account links are
// single-use and short-lived by design).
export async function GET(req) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/dashboard?connect=refresh`);
}
