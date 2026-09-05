"use client";

import { useEffect, useState } from "react";
import StorefrontFeed from "./StorefrontFeed";

// Owns the masthead's search toggle/input, the feed below it, and now
// the page's own color theme + width, all in one client component --
// the search query has to reach StorefrontFeed (a sibling of the
// masthead in the old server-only markup), and the width toggle below
// needs to react live to a click, which a server component can't do.
// Same tiny toggle-to-input search UI as the original single-tenant site
// (.search-wrap/.search-toggle/.search-icon/.search-input in
// globals.css) -- that CSS was already sitting unused after the
// multi-tenant rebuild; this just reconnects it instead of building
// something new.
const COMPACT_WIDTH = "430px";

export default function TenantShop({ tenant, products }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // The artist's own "Desktop view" choice (Shop settings) is always the
  // starting point every visitor sees -- nothing here changes that
  // default or how it's stored. A visitor can additionally flip it for
  // themselves on top of that default, remembered per-shop in their own
  // browser (localStorage) so it holds as they browse/return, without
  // touching the artist's own setting or affecting any other visitor.
  // null means "no override yet -- use the artist's default."
  const [compactOverride, setCompactOverride] = useState(null);
  const storageKey = `abracadabra-compact-view-${tenant.slug}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "true") setCompactOverride(true);
      else if (saved === "false") setCompactOverride(false);
    } catch {
      // Best-effort only -- a visitor's own view preference isn't worth
      // breaking the page over (private browsing, storage disabled).
    }
  }, [storageKey]);

  const effectiveCompact = compactOverride === null ? Boolean(tenant.compact_desktop) : compactOverride;

  function toggleView() {
    const next = !effectiveCompact;
    setCompactOverride(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // Same best-effort note as above.
    }
  }

  const themeStyle = {
    minHeight: "100dvh",
    ...(tenant.bg_color ? { background: tenant.bg_color, "--bg": tenant.bg_color } : {}),
    ...(tenant.ink_color ? { color: tenant.ink_color, "--ink": tenant.ink_color } : {}),
    ...(effectiveCompact ? { maxWidth: COMPACT_WIDTH } : {}),
  };

  return (
    <main className="page" style={themeStyle}>
      <div className="masthead">
        <span className="brand">{tenant.shop_name}</span>
        <div className="masthead-actions">
          <button
            type="button"
            className="view-size-toggle"
            onClick={toggleView}
            aria-label={effectiveCompact ? "Switch to full-width view" : "Switch to phone-width view"}
            title={effectiveCompact ? "Full-width view" : "Phone-width view"}
          >
            {effectiveCompact ? "⤢" : "⤡"}
          </button>
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
    </main>
  );
}
