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
};

export default function CreateShopForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [shopName, setShopName] = useState("");
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
        body: JSON.stringify({ slug, shopName }),
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
      <button style={styles.button} type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Creating…" : "Create shop"}
      </button>
      {error && <p style={{ ...styles.dim, color: "#e08a8a" }}>{error}</p>}
    </form>
  );
}
