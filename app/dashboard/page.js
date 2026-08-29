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
