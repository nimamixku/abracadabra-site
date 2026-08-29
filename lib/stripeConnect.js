// Stripe Connect helpers -- the "artist gets paid directly" side of
// payments (see the plan's Payments section). Deliberately separate from
// lib/stripe.js's plain client: every call here either targets the
// platform's own account (creating/inspecting a connected account) or
// needs `{ stripeAccount }` to act on behalf of one (never mixed up).

import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";

// Express accounts: Stripe hosts KYC/onboarding UI, right complexity
// level for a solo founder platform (vs. Standard, which assumes the
// artist runs their own Stripe presence, or Custom, which pushes
// compliance liability onto us). See the plan's Architecture section for
// the full reasoning.
export async function ensureConnectAccount(tenant) {
  if (tenant.stripe_connect_account_id) return tenant.stripe_connect_account_id;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await query(
    "update tenants set stripe_connect_account_id = $1, stripe_connect_status = 'onboarding', updated_at = now() where id = $2",
    [account.id, tenant.id]
  );

  return account.id;
}

// A fresh onboarding link -- account links expire quickly and are
// single-use, so this is called fresh every time the artist clicks
// "connect payouts", never cached.
export async function createOnboardingLink({ accountId, refreshUrl, returnUrl }) {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

// Called from the Connect webhook on `account.updated` -- reflects
// Stripe's own view of whether the account can actually take payments
// yet, rather than us guessing from the onboarding redirect alone (a
// returning browser tab doesn't guarantee onboarding actually finished).
export async function syncConnectStatus(account) {
  const status = account.charges_enabled && account.payouts_enabled ? "active" : "onboarding";
  await query(
    "update tenants set stripe_connect_status = $1, updated_at = now() where stripe_connect_account_id = $2",
    [status, account.id]
  );
}
