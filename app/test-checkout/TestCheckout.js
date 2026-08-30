"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const boxStyle = {
  padding: "0.8rem",
  borderRadius: 10,
  border: "1px solid var(--card-line)",
  background: "var(--card)",
  marginBottom: "0.75rem",
};

const buttonStyle = {
  padding: "0.6rem 1rem",
  borderRadius: 10,
  border: "1px solid var(--card-line)",
  background: "var(--accent, #b98cf0)",
  color: "#1b1420",
  fontWeight: 600,
  cursor: "pointer",
};

// Every connected account needs ITS OWN Stripe.js instance -- a client
// secret from a connected account's PaymentIntent only resolves against
// that account's context (loadStripe(pk, { stripeAccount })), never the
// platform's own default one. So we always create the intent FIRST (to
// learn which connected account we're dealing with), then load Stripe.js
// scoped to that account, then mount the card field -- never the other
// order.
function PayForm({ clientSecret, title, amountCents, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState("idle"); // idle | paying | error
  const [error, setError] = useState("");

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setStatus("paying");
    setError("");

    try {
      const confirmResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || "Card was declined.");
      }

      const paymentIntentId = confirmResult.paymentIntent.id;

      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Payment succeeded but confirm failed.");

      onDone(confirmData);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handlePay} style={{ marginTop: "0.5rem" }}>
      <div style={boxStyle}>
        <CardElement options={{ style: { base: { fontSize: "16px", color: "#fff" } } }} />
      </div>
      {error && <p style={{ color: "#e08a8a" }}>{error}</p>}
      <button type="submit" disabled={!stripe || status === "paying"} style={buttonStyle}>
        {status === "paying" ? "Paying…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

function ProductRow({ tenantSlug, product }) {
  const [phase, setPhase] = useState("idle"); // idle | loading | ready | done | error
  const [error, setError] = useState("");
  const [checkoutInfo, setCheckoutInfo] = useState(null); // { clientSecret, stripeAccount, amount }
  const [result, setResult] = useState(null);
  const sizes = Array.isArray(product.details?.sizes) ? product.details.sizes : [];
  const [size, setSize] = useState(sizes[0] || "");

  async function startCheckout() {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          productId: product.id,
          payerEmail: "test-buyer@example.com",
          ...(sizes.length > 0 ? { size } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout.");
      setCheckoutInfo(data);
      setPhase("ready");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }

  return (
    <div style={{ border: "1px solid var(--card-line)", borderRadius: 12, padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{product.title}</strong>
        <span>${(product.price_cents / 100).toFixed(2)}</span>
      </div>
      {!product.active && <p style={{ color: "#e08a8a", fontSize: "0.85rem" }}>Inactive product</p>}
      {error && <p style={{ color: "#e08a8a" }}>{error}</p>}

      {sizes.length > 0 && (phase === "idle" || phase === "error") && (
        <select value={size} onChange={(e) => setSize(e.target.value)} style={{ marginTop: "0.5rem" }}>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {phase === "idle" || phase === "error" ? (
        <button type="button" onClick={startCheckout} style={{ ...buttonStyle, marginTop: "0.5rem" }}>
          Test buy this
        </button>
      ) : null}

      {phase === "loading" && <p style={{ color: "var(--ink-dim)" }}>Starting checkout…</p>}

      {phase === "ready" && checkoutInfo && (
        <Elements
          stripe={loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, {
            stripeAccount: checkoutInfo.stripeAccount,
          })}
        >
          <PayForm
            clientSecret={checkoutInfo.clientSecret}
            amountCents={checkoutInfo.amount}
            onDone={(data) => {
              setResult(data);
              setPhase("done");
            }}
          />
        </Elements>
      )}

      {phase === "done" && result && (
        <div style={{ marginTop: "0.5rem" }}>
          <p style={{ margin: 0 }}>Test purchase succeeded for "{result.title}".</p>
          {result.downloadUrl && (
            <p style={{ marginBottom: 0 }}>
              <a href={result.downloadUrl} style={{ color: "var(--accent, #b98cf0)" }}>
                Download the file
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestCheckout({ tenantSlug, products }) {
  if (!products.length) {
    return <p style={{ color: "var(--ink-dim)" }}>No products yet — add one on the dashboard first.</p>;
  }

  return (
    <div>
      {products.map((product) => (
        <ProductRow key={product.id} tenantSlug={tenantSlug} product={product} />
      ))}
    </div>
  );
}
