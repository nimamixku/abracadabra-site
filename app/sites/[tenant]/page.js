import { notFound } from "next/navigation";
import { getTenantBySlug, getStorefrontProducts } from "@/lib/tenant";
import TenantShop from "./TenantShop";

// The actual buyer-facing shop, reached via <slug>.<rootdomain> through
// middleware.js's rewrite. This is a server component purely to do the
// tenant lookup with a normal `pg` connection (middleware can't -- see
// its own comment) and 404 immediately for a slug that doesn't exist,
// before any client JS or Stripe key ever loads for a dead URL.
//
// The actual page wrapper (colors, width, the "page" class) now lives in
// TenantShop.js instead of here -- it has to be a client component so a
// visitor's own view-size toggle can react live to a click, and there's
// no reason to split that one wrapper element across a server/client
// boundary when TenantShop already owns everything inside it.
export default async function TenantStorefront({ params }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const products = await getStorefrontProducts(tenant.id);

  return <TenantShop tenant={tenant} products={products} />;
}
