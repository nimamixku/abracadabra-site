import { notFound } from "next/navigation";
import { getTenantBySlug, getStorefrontProducts } from "@/lib/tenant";
import StorefrontFeed from "./StorefrontFeed";

// The actual buyer-facing shop, reached via <slug>.<rootdomain> through
// middleware.js's rewrite. This is a server component purely to do the
// tenant lookup with a normal `pg` connection (middleware can't -- see
// its own comment) and 404 immediately for a slug that doesn't exist,
// before any client JS or Stripe key ever loads for a dead URL.
export default async function TenantStorefront({ params }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const products = await getStorefrontProducts(tenant.id);

  return (
    <main className="page">
      <div className="masthead">
        <span className="brand">{tenant.shop_name}</span>
      </div>
      {tenant.stripe_connect_status === "active" ? (
        <StorefrontFeed
          tenantSlug={tenant.slug}
          stripeAccount={tenant.stripe_connect_account_id}
          products={products}
        />
      ) : (
        <p style={{ padding: 20, color: "var(--ink-dim)" }}>
          This shop is still getting set up -- check back soon.
        </p>
      )}
    </main>
  );
}
