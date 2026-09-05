import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionTenant } from "@/lib/auth";
import CreateShopForm from "./CreateShopForm";
import ProductManager from "./ProductManager";
import SignOutButton from "./SignOutButton";
import ConnectPayoutsButton from "./ConnectPayoutsButton";
import ThemePicker from "./ThemePicker";
import ShopNameEditor from "./ShopNameEditor";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const { user, tenant } = await getSessionTenant(cookieStore);

  if (!user) redirect("/login");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        color: "var(--ink)",
        padding: "2rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          {tenant ? <ShopNameEditor tenant={tenant} /> : <h1 style={{ margin: 0 }}>Your dashboard</h1>}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.85rem", flexShrink: 0 }}>
            {tenant && (
              <a
                href={`/sites/${tenant.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--ink-dim)", fontSize: "0.85rem", textDecoration: "none" }}
              >
                View live ↗
              </a>
            )}
            <SignOutButton />
          </div>
        </div>

        {tenant ? (
          <>
            {tenant.selling_mode === "crypto" && (
              <p
                style={{
                  color: "var(--ink-dim)",
                  fontSize: "0.9rem",
                  marginTop: "0.75rem",
                  padding: "0.6rem 0.9rem",
                  border: "1px solid var(--card-line)",
                  borderRadius: 10,
                }}
              >
                Marked as a crypto/NFT shop. Add products the same way as any shop for now —
                NFT checkout unlocks here automatically once that ships.
              </p>
            )}

            {/* Products first -- this IS the shop, the thing an artist
                came here to build. Payouts/colors below are real but
                secondary, and shown right where they're needed too
                (the payouts nag on each product card) rather than
                gating the whole page on connecting them first. */}
            <div style={{ marginTop: "1.25rem" }}>
              <ProductManager tenant={tenant} />
            </div>

            <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--card-line)" }}>
              <h2
                style={{
                  fontSize: "0.85rem",
                  color: "var(--ink-dim)",
                  margin: "0 0 0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                Shop settings
              </h2>
              <ConnectPayoutsButton status={tenant.stripe_connect_status} />
              <ThemePicker tenant={tenant} />
            </div>
          </>
        ) : (
          <CreateShopForm />
        )}
      </div>
    </div>
  );
}
