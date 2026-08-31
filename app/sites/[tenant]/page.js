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

  // The only two things a shop can customize (plan's "palette is
  // customizable -- nothing else is" section): background and text
  // color. Set as both the actual background/color (so this fills the
  // viewport regardless of the platform default set on <body>) and as
  // the --bg/--ink custom properties (so anything downstream that reads
  // var(--bg)/var(--ink) -- e.g. an empty-state placeholder -- picks up
  // the same override). Left undefined when a tenant hasn't set one, so
  // the platform default shows through exactly as before.
  const themeStyle = {
    minHeight: "100dvh",
    ...(tenant.bg_color ? { background: tenant.bg_color, "--bg": tenant.bg_color } : {}),
    ...(tenant.ink_color ? { color: tenant.ink_color, "--ink": tenant.ink_color } : {}),
  };

  return (
    <main className="page" style={themeStyle}>
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
