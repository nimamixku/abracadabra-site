import { NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/auth";
import { ensureConnectAccount, createOnboardingLink } from "@/lib/stripeConnect";

// Starts (or resumes) Connect Express onboarding for the signed-in
// artist's shop. Returns a URL the dashboard redirects the browser to --
// Stripe hosts the actual KYC form, we never see or handle that data.
export async function POST(req) {
  const { tenant } = await getSessionTenant(req.cookies);
  if (!tenant) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const accountId = await ensureConnectAccount(tenant);
    const origin = new URL(req.url).origin;
    const url = await createOnboardingLink({
      accountId,
      refreshUrl: `${origin}/api/dashboard/connect/refresh`,
      returnUrl: `${origin}/dashboard?connect=return`,
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not start payouts setup." }, { status: 500 });
  }
}
