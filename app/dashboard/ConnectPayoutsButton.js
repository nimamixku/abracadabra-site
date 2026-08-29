"use client";

import { useState } from "react";

export default function ConnectPayoutsButton({ status }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/connect/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = data.url;
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  }

  if (status === "active") {
    return <p style={{ color: "var(--success)", fontSize: "0.9rem" }}>Payouts connected ✓</p>;
  }

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "0.6rem 1rem",
          borderRadius: 10,
          border: "1px solid var(--card-line)",
          background: "var(--card)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        {loading ? "Redirecting…" : status === "onboarding" ? "Finish payouts setup" : "Connect payouts"}
      </button>
      {error && <p style={{ color: "#e08a8a", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}
