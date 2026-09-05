"use client";

import { useState } from "react";

// Sits right in the dashboard's own masthead, styled exactly like the
// real storefront's <span class="brand"> (StorefrontFeed.js/TenantShop.js)
// -- typing over it changes the actual shop name a customer sees, no
// separate settings field for it. Saves on blur; Enter blurs early so
// the keyboard closes on mobile without a separate "done" button.
export default function ShopNameEditor({ tenant }) {
  const [value, setValue] = useState(tenant.shop_name || "");
  const [status, setStatus] = useState("idle");

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === tenant.shop_name) {
      setValue(tenant.shop_name || "");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/dashboard/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      tenant.shop_name = data.tenant.shop_name;
      setStatus("saved");
    } catch (err) {
      setValue(tenant.shop_name || "");
      setStatus("error");
    }
  }

  return (
    <input
      className="dash-brand-input"
      value={value}
      placeholder="Your shop"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label="Shop name"
      size={Math.max(6, value.length || "Your shop".length)}
      title={status === "error" ? "Could not save -- try again" : undefined}
    />
  );
}
