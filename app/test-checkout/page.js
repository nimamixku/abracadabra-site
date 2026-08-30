import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionTenant } from "@/lib/auth";
import { query } from "@/lib/db";
import TestCheckout from "./TestCheckout";

// TEMPORARY, dev-only tool -- not linked from anywhere in the real app.
// The real buyer-facing storefront (app/_sites/[tenant]) is Phase 4 work;
// this exists purely so Phase 3's Connect/checkout plumbing can be
// proven end-to-end (a real test-mode card charge, split, and download)
// before that storefront exists. Delete this whole folder once Phase 4
// ships. Gated behind the dashboard's own session -- only the signed-in
// shop owner can reach it, same as the dashboard itself.
export default async function TestCheckoutPage() {
  const cookieStore = await cookies();
  const { user, tenant } = await getSessionTenant(cookieStore);

  if (!user) redirect("/login");
  if (!tenant) redirect("/dashboard");

  const { rows: products } = await query(
    "select id, type, title, price_cents, details, active from products where tenant_id = $1 order by id desc",
    [tenant.id]
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        color: "var(--ink)",
        padding: "2rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Test checkout</h1>
        <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: 0 }}>
          Dev-only tool for {tenant.shop_name}. Use Stripe test card{" "}
          <code>4242 4242 4242 4242</code>, any future expiry, any 3-digit CVC, any ZIP.
          This is not shown to real customers.
        </p>
        {tenant.stripe_connect_status !== "active" && (
          <p style={{ color: "#e08a8a" }}>
            Payouts aren't connected yet, so this shop can't accept a real charge --
            finish "Connect payouts" on the dashboard first.
          </p>
        )}
        <TestCheckout tenantSlug={tenant.slug} products={products} />
      </div>
    </div>
  );
}
