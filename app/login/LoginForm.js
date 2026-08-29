"use client";

import { useState } from "react";

const styles = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "inherit",
    padding: "1.5rem",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "var(--card)",
    border: "1px solid var(--card-line)",
    borderRadius: 16,
    padding: "2rem",
  },
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
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#1a0f24",
    fontWeight: 600,
    fontSize: "1rem",
    marginTop: "1rem",
    cursor: "pointer",
  },
  dim: { color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.75rem" },
};

export default function LoginForm({ initialError }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(
    initialError === "expired" ? "That link has expired or was already used. Request a new one below." : ""
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Sign in to your shop</h1>
        <p style={styles.dim}>
          Enter your email and we&apos;ll send you a one-time link — no password needed.
        </p>

        {status === "sent" ? (
          <p style={{ ...styles.dim, color: "var(--success)" }}>
            Check your inbox for a sign-in link. It expires in 15 minutes.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              style={styles.input}
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button style={styles.button} type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {error && <p style={{ ...styles.dim, color: "#e08a8a" }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
