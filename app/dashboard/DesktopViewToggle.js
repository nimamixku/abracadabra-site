"use client";

import { useState } from "react";

// The one deliberate exception to "layout stays uniform, only color is
// customizable" (see the plan): a desktop screen is a lot bigger than
// a phone, and some artists don't want their storefront rendered at
// that larger size just because a visitor happens to be on one. Off
// (the default) is exactly how every shop already looked before this
// existed -- the same 640px-max column. On shrinks that same column
// down to phone width, closer to the try-it demo's own framing,
// leaving mobile visitors completely unaffected either way (a real
// phone's own viewport is already narrower than both numbers).
export default function DesktopViewToggle({ tenant }) {
  const [compact, setCompact] = useState(Boolean(tenant.compact_desktop));
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function toggle() {
    const next = !compact;
    setCompact(next);
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/dashboard/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compactDesktop: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      tenant.compact_desktop = data.tenant.compact_desktop;
      setStatus("saved");
    } catch (err) {
      setCompact(!next);
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-line)",
        borderRadius: 12,
        padding: "1rem",
        marginTop: "0.75rem",
      }}
    >
      <strong>Desktop view</strong>
      <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
        A desktop screen is a lot bigger than a phone. By default your shop
        still shows at its normal size there -- turn this on to have it
        render at phone width for desktop visitors too, the way it looks on
        the try-it demo.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", cursor: "pointer" }}>
        <input type="checkbox" checked={compact} onChange={toggle} />
        <span style={{ fontSize: "0.9rem" }}>Show my shop at phone width on desktop, too</span>
      </label>
      {status === "saving" && <p style={{ color: "var(--ink-dim)", fontSize: "0.8rem", marginTop: "0.4rem" }}>Saving…</p>}
      {error && <p style={{ color: "#e08a8a", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
