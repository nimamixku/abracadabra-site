"use client";

import { useState } from "react";

// The only two things a shop can customize, per the plan's "palette is
// customizable -- nothing else is" section: background and text color.
// Both swatches share the same small phone-silhouette shape (a rounded
// rectangle) so they read as a matched pair, and are told apart by what's
// inside rather than by shape -- the background swatch is that shape
// filled solid with the chosen color (it IS literally the screen), the
// text-color swatch keeps a fixed neutral screen behind a few short
// "greeked" line segments (the standard wireframe stand-in for text) in
// the chosen color, so picking a text color never gets confused with
// picking the background.
const PHONE_STYLE = {
  width: 64,
  height: 116,
  borderRadius: 14,
  border: "1px solid var(--card-line)",
  cursor: "pointer",
  position: "relative",
  overflow: "hidden",
  flexShrink: 0,
};

const DEFAULT_BG = "#0b0b0d";
const DEFAULT_INK = "#f3f2ee";

function GreekedLines({ color }) {
  const widths = [70, 45, 60, 30];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#1c1c20", padding: "14px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
      {widths.map((w, i) => (
        <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: color }} />
      ))}
    </div>
  );
}

function Swatch({ label, kind, color, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
      <div style={{ ...PHONE_STYLE, background: kind === "bg" ? color : "#1c1c20" }}>
        {kind === "ink" && <GreekedLines color={color} />}
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
        />
      </div>
      <span style={{ color: "var(--ink-dim)", fontSize: "0.8rem" }}>{label}</span>
    </label>
  );
}

export default function ThemePicker({ tenant }) {
  const [bgColor, setBgColor] = useState(tenant.bg_color || DEFAULT_BG);
  const [inkColor, setInkColor] = useState(tenant.ink_color || DEFAULT_INK);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const dirty = bgColor !== (tenant.bg_color || DEFAULT_BG) || inkColor !== (tenant.ink_color || DEFAULT_INK);

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/dashboard/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgColor, inkColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save colors.");
      tenant.bg_color = data.tenant.bg_color;
      tenant.ink_color = data.tenant.ink_color;
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  function reset() {
    setBgColor(DEFAULT_BG);
    setInkColor(DEFAULT_INK);
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
      <strong>Shop colors</strong>
      <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
        Background and text color are the only two things that change shop
        to shop -- the feed, checkout, and every gesture stay identical
        everywhere on the platform, so a buyer always knows how it works.
      </p>
      <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem" }}>
        <Swatch label="Background" kind="bg" color={bgColor} onChange={setBgColor} />
        <Swatch label="Text" kind="ink" color={inkColor} onChange={setInkColor} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === "saving"}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#1a0f24",
            fontWeight: 600,
            cursor: dirty ? "pointer" : "default",
            opacity: dirty ? 1 : 0.5,
          }}
        >
          {status === "saving" ? "Saving…" : "Save colors"}
        </button>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 10,
            border: "1px solid var(--card-line)",
            background: "transparent",
            color: "var(--ink-dim)",
            cursor: "pointer",
          }}
        >
          Reset to default
        </button>
        {status === "saved" && !dirty && (
          <span style={{ color: "var(--success)", fontSize: "0.85rem" }}>Saved.</span>
        )}
      </div>
      {error && <p style={{ color: "#e08a8a", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
