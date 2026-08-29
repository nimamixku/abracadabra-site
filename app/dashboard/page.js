import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionTenant } from "@/lib/auth";
import CreateShopForm from "./CreateShopForm";
import ProductManager from "./ProductManager";
import SignOutButton from "./SignOutButton";
import ConnectPayoutsButton from "./ConnectPayoutsButton";

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ margin: 0 }}>{tenant ? tenant.shop_name : "Your dashboard"}</h1>
          <SignOutButton />
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
            <ConnectPayoutsButton status={tenant.stripe_connect_status} />
            <ProductManager />
          </>
        ) : (
          <CreateShopForm />
        )}
      </div>
    </div>
  );
}
