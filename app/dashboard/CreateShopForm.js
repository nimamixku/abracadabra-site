"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const styles = {
  input: {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: 10,
    border: "1px solid var(--card-line)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: "1rem",
    marginTop: "0.75rem",
  },
  button: {
    padding: "0.75rem 1.25rem",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#1a0f24",
    fontWeight: 600,
    fontSize: "1rem",
    marginTop: "1rem",
    cursor: "pointer",
  },
  dim: { color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.5rem" },
  modeCard: (active) => ({
    flex: 1,
    textAlign: "left",
    padding: "0.9rem 1rem",
    borderRadius: 10,
    border: active ? "2px solid var(--accent)" : "1px solid var(--card-line)",
    background: "var(--bg)",
    color: "var(--ink)",
    cursor: "pointer",
  }),
  modeTitle: { fontWeight: 600, marginBottom: "0.25rem" },
};

// Shown once, right after shop name/URL -- this is the only other
// decision before landing on the real dashboard to start adding
// products. "Crypto/NFT" is a forward-looking opt-in: Crossmint
// checkout (Phase 6) isn't built yet, so a crypto-mode shop sells
// ordinary products the same way a fiat shop does today; the choice
// just gets remembered so NFT checkout can turn on later without
// another setup step.
function SellingModePicker({ value, onChange }) {
  return (
    <div>
      <p style={{ ...styles.dim, marginTop: "1.25rem", marginBottom: "0.4rem" }}>
        How will you sell?
      </p>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button
          type="button"
          style={styles.modeCard(value === "fiat")}
          onClick={() => onChange("fiat")}
        >
          <div style={styles.modeTitle}>Card &amp; Apple Pay</div>
          <div style={styles.dim}>Standard checkout. Ready today.</div>
        </button>
        <button
          type="button"
          style={styles.modeCard(value === "crypto")}
          onClick={() => onChange("crypto")}
        >
          <div style={styles.modeTitle}>Crypto / NFT</div>
          <div style={styles.dim}>Via Crossmint. Coming soon -- your choice is saved.</div>
        </button>
      </div>
    </div>
  );
}

export default function CreateShopForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [shopName, setShopName] = useState("");
  const [sellingMode, setSellingMode] = useState("fiat");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/dashboard/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, shopName, sellingMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
      <h2 style={{ marginBottom: 0 }}>Set up your shop</h2>
      <p style={styles.dim}>Your free shop lives at &lt;your-url&gt;.abracadabrashop.com — you can connect your own domain later.</p>
      <input
        style={styles.input}
        placeholder="Shop name (e.g. Jane Doe Art)"
        required
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
      />
      <input
        style={styles.input}
        placeholder="Shop URL (e.g. janedoe)"
        required
        pattern="[a-z0-9-]{3,32}"
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase())}
      />
      <SellingModePicker value={sellingMode} onChange={setSellingMode} />
      <button style={styles.button} type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Creating…" : "Create shop"}
      </button>
      {error && <p style={{ ...styles.dim, color: "#e08a8a" }}>{error}</p>}
    </form>
  );
}
