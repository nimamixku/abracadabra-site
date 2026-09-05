"use client";

import { useState } from "react";
import StorefrontFeed from "./StorefrontFeed";

// Owns the masthead's search toggle/input plus the feed below it, in one
// client component -- the search query has to reach StorefrontFeed (a
// sibling of the masthead in the old server-only markup), and the
// cleanest way to share that state between the two is a single component
// that renders both, rather than reaching across with a ref/event the way
// TryItClearHint has to (that one exists only because splitting the
// marketing page fully into a client component wasn't worth it there).
// Same tiny toggle-to-input search UI as the original single-tenant site
// (.search-wrap/.search-toggle/.search-icon/.search-input in
// globals.css) -- that CSS was already sitting unused after the
// multi-tenant rebuild; this just reconnects it instead of building
// something new.
export default function TenantShop({ tenant, products }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <div className="masthead">
        <span className="brand">{tenant.shop_name}</span>
        <div className="search-wrap">
          <button
            type="button"
            className="search-toggle"
            aria-label={searchOpen ? "Close search" : "Search"}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <span className="search-icon" aria-hidden="true" />
          </button>
          {searchOpen && (
            <input
              type="text"
              className="search-input"
              placeholder="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          )}
        </div>
      </div>
      {tenant.stripe_connect_status === "active" ? (
        <StorefrontFeed
          tenantSlug={tenant.slug}
          stripeAccount={tenant.stripe_connect_account_id}
          products={products}
          searchQuery={searchOpen ? searchQuery : ""}
        />
      ) : (
        <p style={{ padding: 20, color: "var(--ink-dim)" }}>
          This shop is still getting set up -- check back soon.
        </p>
      )}
    </>
  );
}
