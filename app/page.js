"use client";

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  PaymentRequestButtonElement,
  CardElement,
} from "@stripe/react-stripe-js";
import { PRODUCTS } from "@/lib/products";
import { PLAY_PACK, FEATURES } from "@/lib/experiences";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const SHIPPING_CENTS = 600;
const PLAYS_STORAGE_KEY = "abracadabra-plays-v1";

// Stripe's card entry field lives inside its own iframe, so it can't read
// this page's CSS variables -- these are the same colors as --ink,
// --ink-dim, and #ff8a8a in globals.css, just spelled out literally.
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#f3f2ee",
      fontSize: "16px",
      "::placeholder": { color: "#a5a3ab" },
    },
    invalid: { color: "#ff8a8a" },
  },
};

const MARQUEE_PHRASES = [
  "ABRACADABRA MEANS I CREATE AS I SPEAK",
  "THE HAND IS QUICKER THAN THE EYE",
  "NOTHING UP MY SLEEVE",
  "SAY THE WORD AND WATCH IT APPEAR",
  "EVERY ENDING IS JUST ANOTHER CARD TRICK",
  "POOF",
  "LOOK CLOSER. LOOK AGAIN.",
];

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Digital art shuffles between three price points every time the feed
// reshuffles -- same piece might show up at 50 cents in one pass and $1 in
// another. Clothing keeps its fixed price (real cost + shipping behind it).
const DIGITAL_PRICE_TIERS = [50, 75, 100];

function priceInWords(cents) {
  if (cents === 50) return "fifty cents";
  if (cents === 75) return "seventy-five cents";
  if (cents === 100) return "one dollar";
  return null;
}

function withShuffledPrice(product) {
  if (product.type !== "digital") return product;
  const price = DIGITAL_PRICE_TIERS[Math.floor(Math.random() * DIGITAL_PRICE_TIERS.length)];
  return { ...product, price };
}

// ---- shared play balance (localStorage-backed, no login) ----
// A $1 purchase grants 3 plays, spendable across any of the three
// interactive features. See the note at the top of lib/experiences.js
// for why this lives client-side rather than behind real auth.
const PlayBalanceContext = createContext(null);

function usePlayBalance() {
  return useContext(PlayBalanceContext);
}

// ---- click-to-expand full image view ----
// Cards crop every photo into the same tall frame so the feed looks
// consistent while scrolling -- but that means part of some images gets
// trimmed off. This lets a shopper tap the photo to see the whole,
// uncropped image before they decide to buy.
const LightboxContext = createContext(null);

function useLightbox() {
  return useContext(LightboxContext);
}

// ---- "buy right from the feed" tracking ----
// Apple Pay and Google Pay's on-page button has to be the literal element a
// customer's finger actually lands on -- that's a security rule Apple and
// Google enforce themselves, and there's no way for any site to fake a tap
// on it from a different button. So the floating "tap & pay" shortcut can't
// just be a generic button that triggers *some* purchase; instead every
// card quietly reports how visible it is, and the floating shortcut always
// hosts a real, live buy button for whichever photo is currently most on
// screen -- it just re-points itself as the customer scrolls.
const ActiveCardContext = createContext(null);

function useRegisterCard(product) {
  const register = useContext(ActiveCardContext);
  const ref = useRef(null);
  useEffect(() => {
    if (!register || !ref.current) return;
    return register(ref.current, product);
  }, [register, product]);
  return ref;
}

function LightboxProvider({ children }) {
  const [product, setLightboxProduct] = useState(null); // full product object | null

  useEffect(() => {
    if (!product) return;
    function onKey(e) {
      if (e.key === "Escape") setLightboxProduct(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product]);

  return (
    <LightboxContext.Provider value={{ open: (p) => setLightboxProduct(p) }}>
      {children}
      {product && (
        <div className="lightbox-overlay" onClick={() => setLightboxProduct(null)}>
          <button
            className="lightbox-close"
            type="button"
            onClick={() => setLightboxProduct(null)}
            aria-label="Close full view"
          >
            ✕
          </button>
          <img className="lightbox-img" src={product.image} alt={product.title} />
          {/* Same buy option as the card below, so a shopper who stopped to
              look closer at the art can buy right here without going back. */}
          {product.type === "digital" && (
            <div className="lightbox-buy" onClick={(e) => e.stopPropagation()}>
              <p className="lightbox-title">
                {product.title} · {formatPrice(product.price)}
                <span className="tap-pay-chip">✦ tap &amp; pay</span>
              </p>
              <p className="lightbox-note">
                You'll get the full-res TIFF file at 300 DPI — built for
                high-quality physical prints, not for on-screen viewing. It
                may look soft or oversized on an iPhone or laptop screen;
                that's expected, and it'll look sharp once printed.
              </p>
              <Elements stripe={stripePromise}>
                <BuySection product={product} lazy={false} />
              </Elements>
            </div>
          )}
          <p className="lightbox-hint">tap the image to go back</p>
        </div>
      )}
    </LightboxContext.Provider>
  );
}

function PlayBalanceProvider({ children }) {
  const [plays, setPlays] = useState(0);
  const [lastPaymentIntentId, setLastPaymentIntentId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PLAYS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPlays(parsed.plays || 0);
        setLastPaymentIntentId(parsed.lastPaymentIntentId || null);
      }
    } catch {
      // start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(
        PLAYS_STORAGE_KEY,
        JSON.stringify({ plays, lastPaymentIntentId })
      );
    } catch {
      // ignore
    }
  }, [plays, lastPaymentIntentId, loaded]);

  function addPlays(n, paymentIntentId) {
    setPlays((p) => p + n);
    if (paymentIntentId) setLastPaymentIntentId(paymentIntentId);
  }

  function spend() {
    let ok = false;
    setPlays((p) => {
      if (p > 0) {
        ok = true;
        return p - 1;
      }
      return p;
    });
    return ok;
  }

  return (
    <PlayBalanceContext.Provider value={{ plays, addPlays, spend, lastPaymentIntentId }}>
      {children}
    </PlayBalanceContext.Provider>
  );
}

// A generic Apple-Pay-in-place button, reusable for both a product and the
// play pack -- calls onSuccess(paymentIntentId) once Stripe confirms.
function InlineBuyButton({ label, amountCents, onSuccess }) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canApplePay, setCanApplePay] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!stripe) return;
    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label, amount: amountCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.on("paymentmethod", async (ev) => {
      setStatus("processing");
      try {
        const res = await fetch("/api/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceId: PLAY_PACK.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start payment.");

        const confirmResult = await stripe.confirmCardPayment(
          data.clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );
        if (confirmResult.error) {
          ev.complete("fail");
          setStatus("error");
          setErrorMsg(confirmResult.error.message || "Payment failed.");
          return;
        }
        ev.complete("success");

        let intent = confirmResult.paymentIntent;
        if (intent.status === "requires_action") {
          const second = await stripe.confirmCardPayment(data.clientSecret);
          if (second.error) {
            setStatus("error");
            setErrorMsg(second.error.message || "Payment failed.");
            return;
          }
          intent = second.paymentIntent;
        }

        const confirmRes = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.id }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm purchase.");

        setStatus("success");
        onSuccess(intent.id);
      } catch (err) {
        ev.complete("fail");
        setStatus("error");
        setErrorMsg(err.message || "Something went wrong.");
      }
    });

    pr.canMakePayment().then((res) => setCanApplePay(!!res));
    setPaymentRequest(pr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe]);

  if (status === "success") return null;

  return (
    <div>
      {canApplePay && paymentRequest && (
        <PaymentRequestButtonElement
          options={{
            paymentRequest,
            style: { paymentRequestButton: { type: "buy", theme: "dark", height: "48px" } },
          }}
        />
      )}
      {canApplePay === false && (
        <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
          One-tap buying needs Apple Pay or Google Pay — open this page on an
          iPhone/Mac in Safari, or Chrome on Android, to buy.
        </p>
      )}
      {status === "processing" && (
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 8 }}>Confirming…</p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 8 }}>{errorMsg}</p>
      )}
    </div>
  );
}

function PlayBalanceBadge() {
  const { plays } = usePlayBalance();
  return <span className="plays-badge">✦ {plays} play{plays === 1 ? "" : "s"}</span>;
}

function NoPlaysLeft() {
  const { addPlays } = usePlayBalance();
  return (
    <div>
      <p style={{ color: "var(--ink-dim)", fontSize: 14, marginBottom: 10 }}>
        out of plays — {formatPrice(PLAY_PACK.price)} for {PLAY_PACK.playsGranted} more
      </p>
      {/* Its own private Stripe session -- Stripe only allows one wallet
          button per shared session, and the feed can easily have several
          of these "out of plays" prompts and product cards all mounted at
          once, so each one needs to be fully isolated from the others. */}
      <Elements stripe={stripePromise}>
        <InlineBuyButton
          label={PLAY_PACK.title}
          amountCents={PLAY_PACK.price}
          onSuccess={(paymentIntentId) => addPlays(PLAY_PACK.playsGranted, paymentIntentId)}
        />
      </Elements>
    </div>
  );
}

// ---- Light a Candle ----
function CandleFeature() {
  const { plays, spend } = usePlayBalance();
  const [text, setText] = useState("");
  const [lit, setLit] = useState(null);

  function handleLight(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (!spend()) return;
    setLit(value);
    setText("");
  }

  return (
    <div className="feature-body">
      {lit ? (
        <div className="candle-result">
          <div className="candle-flame" aria-hidden="true">
            <span className="flame-glow" />
            <span className="flame" />
          </div>
          <p className="candle-text">&ldquo;{lit}&rdquo;</p>
          <p className="candle-note">your candle is lit.</p>
          {plays > 0 && (
            <button className="link-btn" type="button" onClick={() => setLit(null)}>
              light another (uses 1 play)
            </button>
          )}
        </div>
      ) : plays > 0 ? (
        <form onSubmit={handleLight} className="feature-form">
          <input
            className="feature-input"
            type="text"
            placeholder="make a prayer or a wish…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
          />
          <button className="buy-btn" type="submit">
            Light it — uses 1 play
          </button>
        </form>
      ) : (
        <NoPlaysLeft />
      )}
    </div>
  );
}

// ---- The Marquee ----
function MarqueeFeature() {
  const { plays, spend } = usePlayBalance();
  const [phrase, setPhrase] = useState(null);
  const [display, setDisplay] = useState("");
  const [spinning, setSpinning] = useState(false);
  const tickRef = useRef(null);

  function scrambleTo(target) {
    let ticks = 0;
    const totalTicks = 18;
    setSpinning(true);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(tickRef.current);
        setDisplay(target);
        setSpinning(false);
        return;
      }
      const scrambled = target
        .split("")
        .map((ch) => (ch === " " ? " " : String.fromCharCode(65 + Math.floor(Math.random() * 26))))
        .join("");
      setDisplay(scrambled);
    }, 55);
  }

  function handleFlip() {
    if (spinning) return;
    if (!spend()) return;
    let next = MARQUEE_PHRASES[Math.floor(Math.random() * MARQUEE_PHRASES.length)];
    if (phrase === next && MARQUEE_PHRASES.length > 1) {
      next = MARQUEE_PHRASES[(MARQUEE_PHRASES.indexOf(next) + 1) % MARQUEE_PHRASES.length];
    }
    setPhrase(next);
    scrambleTo(next);
  }

  useEffect(() => () => clearInterval(tickRef.current), []);

  return (
    <div className="feature-body">
      <div className="marquee-board">
        <span className="marquee-text">{display || "· · ·"}</span>
      </div>
      {plays > 0 ? (
        <button className="buy-btn" type="button" onClick={handleFlip} disabled={spinning}>
          {spinning ? "Flipping…" : "Flip it — uses 1 play"}
        </button>
      ) : (
        <NoPlaysLeft />
      )}
    </div>
  );
}

// ---- Ask the Oracle ----
function OracleFeature() {
  const { plays, spend, lastPaymentIntentId } = usePlayBalance();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e) {
    e.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    if (!spend()) return;
    setAsking(true);
    setError("");
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, paymentIntentId: lastPaymentIntentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAnswer(data.answer);
      setQuestion("");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="feature-body">
      <div className="oracle-window">
        {asking ? (
          <p className="oracle-thinking">the oracle is thinking…</p>
        ) : answer ? (
          <p className="oracle-answer">{answer}</p>
        ) : (
          <p className="oracle-placeholder">✦ ✦ ✦</p>
        )}
      </div>
      {plays > 0 ? (
        <form onSubmit={handleAsk} className="feature-form">
          <input
            className="feature-input"
            type="text"
            placeholder="ask the oracle…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            disabled={asking}
          />
          <button className="buy-btn" type="submit" disabled={asking}>
            {asking ? "…" : "Ask — uses 1 play"}
          </button>
        </form>
      ) : (
        <NoPlaysLeft />
      )}
      {error && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function FeatureCard({ feature }) {
  return (
    <div className="card feature-card">
      <div className="card-body">
        <div className="card-row">
          <p className="card-title">✦ {feature.title}</p>
          <PlayBalanceBadge />
        </div>
        <p className="feature-blurb">{feature.blurb}</p>
        {feature.kind === "candle" && <CandleFeature />}
        {feature.kind === "marquee" && <MarqueeFeature />}
        {feature.kind === "oracle" && <OracleFeature />}
      </div>
    </div>
  );
}

// One scrollable card: its own Apple Pay button, its own size picker (if the
// product has sizes), its own in-place "purchased" state. Nothing here ever
// navigates the page away -- the whole point is that buying happens without
// leaving the feed.
// All the actual buying logic (Apple/Google Pay + the plain-card fallback),
// pulled out into its own piece so it can be dropped into both a feed card
// and the expanded full-image view -- same purchase, same buttons, two
// places to reach it from.
function BuySection({ product, selectedSize = null, lazy = true }) {
  const stripe = useStripe();
  const elements = useElements();

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canApplePay, setCanApplePay] = useState(null); // null = still checking
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardEmail, setCardEmail] = useState("");

  const shippingCents = product.type === "physical" ? SHIPPING_CENTS : 0;

  // Each card's Apple/Google Pay button is a real embedded iframe -- setting
  // one up the instant a card exists (rather than only for the ones
  // actually on screen) is what was crashing phones on a long scroll:
  // dozens of cards, each spinning up its own payment iframe at once. So a
  // card's copy waits until it's about to scroll into view; the one-off
  // copy inside the expanded photo view (lazy=false) just creates it
  // immediately since only one of those ever exists at a time.
  const wrapRef = useRef(null);
  const [nearView, setNearView] = useState(!lazy);

  useEffect(() => {
    if (!lazy) return;
    const el = wrapRef.current;
    if (!el) return;
    // Keeps observing both ways (not just disconnecting after the first
    // "it's near" hit) -- a long scroll was piling up dozens of live Stripe
    // payment iframes that never went away, which is what was crashing
    // phones. Once a card scrolls far enough past, its wallet button gets
    // torn down again in the effect below, same as it never having loaded.
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setNearView(entry.isIntersecting);
        });
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!stripe || !nearView) {
      // Card scrolled far out of view (or hasn't loaded yet) -- make sure
      // no stale wallet button/iframe for it is still sitting in memory.
      setPaymentRequest(null);
      setCanApplePay(null);
      return;
    }

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: product.title,
        amount: product.price + shippingCents,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: product.type === "physical",
      shippingOptions:
        product.type === "physical"
          ? [
              {
                id: "standard",
                label: "Standard Shipping",
                detail: "5-7 business days, US only",
                amount: SHIPPING_CENTS,
              },
            ]
          : undefined,
    });

    pr.on("shippingaddresschange", (ev) => {
      // Flat one-rate shipping -- any address is fine.
      ev.updateWith({ status: "success" });
    });

    pr.on("paymentmethod", async (ev) => {
      setStatus("processing");
      try {
        const res = await fetch("/api/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            size: selectedSize,
            price: product.price,
            // Apple/Google Pay hand this over on their own -- the customer
            // never types it in -- so a receipt and a backup download
            // email can go out without adding any extra step for them.
            payerEmail: ev.payerEmail,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start payment.");

        const confirmResult = await stripe.confirmCardPayment(
          data.clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmResult.error) {
          ev.complete("fail");
          setStatus("error");
          setErrorMsg(confirmResult.error.message || "Payment failed.");
          return;
        }

        ev.complete("success");

        let intent = confirmResult.paymentIntent;
        if (intent.status === "requires_action") {
          const second = await stripe.confirmCardPayment(data.clientSecret);
          if (second.error) {
            setStatus("error");
            setErrorMsg(second.error.message || "Payment failed.");
            return;
          }
          intent = second.paymentIntent;
        }

        const confirmRes = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.id }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm purchase.");

        setResult(confirmData);
        setStatus("success");
      } catch (err) {
        ev.complete("fail");
        setStatus("error");
        setErrorMsg(err.message || "Something went wrong.");
      }
    });

    pr.canMakePayment().then((res) => setCanApplePay(!!res));
    setPaymentRequest(pr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, product.id, product.price, selectedSize, nearView]);

  // Plain-card fallback for anyone without Apple Pay or Google Pay set up
  // (most regular computers) -- without this, those shoppers had no way to
  // buy anything at all. It's shown as a small always-there button rather
  // than only appearing when the wallet button can't, so there's always an
  // obvious click-to-buy path even where a wallet happens to be available.
  async function handleCardPay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setStatus("processing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          size: selectedSize,
          price: product.price,
          payerEmail: cardEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment.");

      // No handleActions:false here -- unlike the wallet flow, a plain card
      // payment can just let Stripe.js pop up its own 3D Secure step
      // automatically if the card needs one.
      const confirmResult = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (confirmResult.error) {
        setStatus("error");
        setErrorMsg(confirmResult.error.message || "Payment failed.");
        return;
      }

      const confirmRes = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: confirmResult.paymentIntent.id }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm purchase.");

      setResult(confirmData);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong.");
    }
  }

  if (status === "success" && result) {
    return (
      <div ref={wrapRef} style={{ marginTop: 14 }}>
        {result.type === "digital" ? (
          <>
            <a className="buy-btn" href={result.fileUrl} download>
              Purchased ✓ — Download full-res TIFF
            </a>
            <p className="tiff-note">
              Heads up: this file is built for high-quality physical prints,
              not for viewing on a phone or laptop screen — it may look soft
              or oversized there. That's normal, not a flaw. Open it in a
              printing app (or send it to a print shop) to see it at full
              quality.
            </p>
          </>
        ) : (
          <p style={{ color: "var(--success)", fontWeight: 700, margin: 0 }}>
            Purchased ✓ — shipping your {result.size ? result.size + " " : ""}
            {result.title.toLowerCase()} soon
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* A fixed-size marker, not the button/iframe stack itself -- if the
          observed element's own size changes every time nearView flips
          (which mounting/unmounting the wallet button does), the resize
          can retrigger the observer and flip it right back, in a tight
          loop that pegs the CPU instantly. Watching a 1px marker instead
          keeps what's being measured stable no matter what renders below. */}
      <span
        ref={wrapRef}
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }}
      />
      <button
        type="button"
        className="quick-card-btn"
        onClick={() => setShowCardForm((s) => !s)}
      >
        {showCardForm ? "cancel" : `pay with card — ${formatPrice(product.price + shippingCents)}`}
      </button>

      {showCardForm && (
        <form onSubmit={handleCardPay} className="card-pay-form">
          <div className="card-element-wrap">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
          {/* Quiet and entirely optional -- the download works the exact
              same either way, this just also emails a receipt and a
              backup copy of the link if someone bothers to fill it in. */}
          <input
            type="email"
            className="card-email-input"
            placeholder="email for receipt + backup link (optional)"
            value={cardEmail}
            onChange={(e) => setCardEmail(e.target.value)}
          />
          <button className="buy-btn" type="submit" disabled={status === "processing"}>
            {status === "processing"
              ? "Processing…"
              : `Pay ${formatPrice(product.price + shippingCents)}`}
          </button>
        </form>
      )}

      {canApplePay && paymentRequest && (
        <div className="buy-row">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: "buy",
                  theme: "dark",
                  height: "50px",
                },
              },
            }}
          />
          <span className="buy-hint">✦ tap &amp; pay</span>
        </div>
      )}

      {status === "processing" && (
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 10 }}>
          Confirming your payment…
        </p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{errorMsg}</p>
      )}
    </div>
  );
}

// One scrollable card: its own size picker (if the product has sizes), its
// own tap-to-expand photo, and a BuySection. Nothing here ever navigates
// the page away -- the whole point is that buying happens without leaving
// the feed.
function ProductCard({ product }) {
  const lightbox = useLightbox();
  const [selectedSize, setSelectedSize] = useState(product.sizes ? product.sizes[0] : null);
  const cardRef = useRegisterCard(product);

  return (
    <div className="card" ref={cardRef}>
      <div className="card-media">
        <span className="card-kind">
          {product.type === "digital" ? "Art · digital" : "Clothing · ships"}
        </span>
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          onClick={() => lightbox.open(product)}
        />
        <button
          type="button"
          className="expand-hint-wrap"
          aria-label="View full image"
          onClick={() => lightbox.open(product)}
        >
          <span className="expand-hint" aria-hidden="true" />
          <span className="expand-label">expand</span>
        </button>
      </div>
      <div className="card-body">
        <div className="card-row">
          <p className="card-title">{product.title}</p>
          <div className="card-price-col">
            <p className="card-price">{formatPrice(product.price)}</p>
            {priceInWords(product.price) && (
              <p className="card-price-words">{priceInWords(product.price)}</p>
            )}
          </div>
        </div>

        {product.sizes && (
          <div className="size-row">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                className={"size-btn" + (selectedSize === s ? " selected" : "")}
                onClick={() => setSelectedSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Its own private Stripe session, same reasoning as above -- every
            card in the feed needs to be able to have a wallet button ready
            at the same time as every other card, without Stripe treating
            that as more than one of the same button existing at once. */}
        <Elements stripe={stripePromise}>
          <BuySection product={product} selectedSize={selectedSize} lazy={true} />
        </Elements>
      </div>
    </div>
  );
}

// The feed mixes shop items (art + clothing) with the three paid
// interactive features, all shuffled together -- so scrolling turns up
// products and little magic moments in no fixed order, and never runs out.
function buildFeedPool() {
  return [
    ...PRODUCTS.map((p) => ({ feedType: "product", data: withShuffledPrice(p) })),
    ...FEATURES.map((f) => ({ feedType: "feature", data: f })),
  ];
}

// Every batch used to be the ENTIRE ~95-item shop dumped in at once, so
// scrolling near the bottom even a couple of times meant hundreds of cards
// -- each with its own images and its own payment button -- piling up in
// memory until the browser killed the tab. Now each scroll only adds a
// small handful.
//
// The cap below isn't an arbitrary cut-off, though -- it's sized to fit one
// full pass through every single product and feature at least once, so a
// full scroll session still shuffles through all the content, just spread
// across smaller, lighter batches instead of one giant one. Once the whole
// shop has come up, it reshuffles and starts again from the top.
const BATCH_SIZE = 18;
const POOL_SIZE = PRODUCTS.length + FEATURES.length;
const MAX_FEED_ITEMS = Math.ceil(POOL_SIZE / BATCH_SIZE) * BATCH_SIZE;

function Feed({ query }) {
  // A shuffled queue that gets drawn from in order -- guarantees every item
  // shows up once before anything repeats, rather than each batch being an
  // independent random draw (which could easily skip pieces or repeat
  // others within the same short session).
  const queueRef = useRef(shuffled(buildFeedPool()));
  const posRef = useRef(0);

  const takeBatch = useCallback((n) => {
    const out = [];
    while (out.length < n) {
      if (posRef.current >= queueRef.current.length) {
        queueRef.current = shuffled(buildFeedPool());
        posRef.current = 0;
      }
      out.push(queueRef.current[posRef.current]);
      posRef.current += 1;
    }
    return out;
  }, []);

  const [items, setItems] = useState(() =>
    takeBatch(BATCH_SIZE).map((it, i) => ({ ...it, feedKey: `${it.data.id}-${i}` }))
  );
  const sentinelRef = useRef(null);
  const batchRef = useRef(1);

  const loadMore = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= MAX_FEED_ITEMS) return prev;
      batchRef.current += 1;
      return [
        ...prev,
        ...takeBatch(BATCH_SIZE).map((it, i) => ({
          ...it,
          feedKey: `${it.data.id}-${batchRef.current}-${i}`,
        })),
      ];
    });
  }, [takeBatch]);

  // A manual reshuffle for anyone who doesn't want to wait for the natural
  // end of the current pass -- starts a brand new shuffled queue from
  // scratch and jumps back to the top so the fresh order is visible right
  // away, as many times as someone wants to click it.
  const reshuffleRef = useRef(0);
  const reshuffle = useCallback(() => {
    queueRef.current = shuffled(buildFeedPool());
    posRef.current = 0;
    batchRef.current = 1;
    reshuffleRef.current += 1;
    setItems(
      takeBatch(BATCH_SIZE).map((it, i) => ({
        ...it,
        feedKey: `${it.data.id}-r${reshuffleRef.current}-${i}`,
      }))
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [takeBatch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) loadMore();
        });
      },
      { rootMargin: "800px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Every card reports its own visibility here; whichever one is most in
  // view becomes the target for the floating "tap & pay" shortcut, so
  // buying "from the feed" always means buying the photo actually being
  // looked at, without having to scroll down to that card's own button.
  const cardEntriesRef = useRef(new Map()); // card element -> { ratio, product }
  const cardObserverRef = useRef(null);
  const [activeProduct, setActiveProduct] = useState(null);

  const getCardObserver = useCallback(() => {
    if (!cardObserverRef.current) {
      cardObserverRef.current = new IntersectionObserver(
        (obsEntries) => {
          obsEntries.forEach((entry) => {
            const info = cardEntriesRef.current.get(entry.target);
            if (info) info.ratio = entry.intersectionRatio;
          });
          let best = null;
          cardEntriesRef.current.forEach((info) => {
            if (info.ratio > 0.15 && (!best || info.ratio > best.ratio)) best = info;
          });
          setActiveProduct(best ? best.product : null);
        },
        { threshold: [0, 0.15, 0.3, 0.5, 0.7, 0.9, 1] }
      );
    }
    return cardObserverRef.current;
  }, []);

  const registerCard = useCallback(
    (el, product) => {
      const obs = getCardObserver();
      cardEntriesRef.current.set(el, { ratio: 0, product });
      obs.observe(el);
      return () => {
        cardEntriesRef.current.delete(el);
        obs.unobserve(el);
      };
    },
    [getCardObserver]
  );

  const atEnd = items.length >= MAX_FEED_ITEMS;

  // A search takes over the feed entirely -- rather than shuffling and
  // paginating, it just shows every title that matches, in catalog order,
  // since that's a much smaller and more predictable list than the full
  // shuffled scroll.
  const trimmedQuery = (query || "").trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const searchResults = searching
    ? PRODUCTS.filter((p) => p.title.toLowerCase().includes(trimmedQuery))
    : [];

  return (
    <>
      <ActiveCardContext.Provider value={registerCard}>
        <div className="feed">
          {searching
            ? searchResults.map((p) => <ProductCard product={p} key={p.id} />)
            : items.map((item) =>
                item.feedType === "product" ? (
                  <ProductCard product={item.data} key={item.feedKey} />
                ) : (
                  <FeatureCard feature={item.data} key={item.feedKey} />
                )
              )}
        </div>
      </ActiveCardContext.Provider>
      {!searching && <div className="feed-end" ref={sentinelRef} />}
      <p className="loading-more">
        {searching
          ? searchResults.length === 0
            ? "nothing matches that title"
            : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"}`
          : atEnd
          ? "that's everything for now — refresh to shuffle a new set"
          : "keep scrolling — it reshuffles"}
      </p>
      {!searching && (
        <button
          type="button"
          className="floating-shuffle"
          onClick={reshuffle}
          aria-label="Shuffle the feed"
        >
          ✦ shuffle
        </button>
      )}
      {activeProduct && activeProduct.type === "digital" && (
        // Its own private Stripe session, same as every card's -- and a
        // fresh one each time the active photo changes (the key forces a
        // full remount) so there's never a stale wallet button left over
        // from the last photo someone scrolled past.
        <Elements stripe={stripePromise} key={activeProduct.id}>
          <FloatingBuy product={activeProduct} />
        </Elements>
      )}
    </>
  );
}

// The floating "tap & pay" shortcut -- a real, live buy button for
// whichever photo is currently most visible, not a decorative stand-in.
// Apple/Google Pay require the actual tap to land on the actual wallet
// button, so this is that button, just kept within reach without having
// to scroll down to the card it belongs to. Physical items are left out
// here since buying one means picking a size first, and that choice lives
// on the specific card, not up in this floating shortcut.
function FloatingBuy({ product }) {
  return (
    <div className="floating-buy-wrap">
      <p className="floating-buy-title">
        <span className="floating-buy-title-text">{product.title}</span>
        <span className="tap-pay-chip">✦ tap &amp; pay</span>
      </p>
      <BuySection product={product} lazy={false} />
    </div>
  );
}

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <main className="page">
      <div className="masthead">
        <span className="brand">
          ABRACADABRA <span className="brand-sub">shop</span>
        </span>
        <div className="search-wrap">
          {searchOpen && (
            <input
              type="text"
              className="search-input"
              placeholder="find"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <button
            type="button"
            className="search-toggle"
            aria-label={searchOpen ? "Close search" : "Search by title"}
            onClick={() => {
              setSearchOpen((s) => !s);
              if (searchOpen) setQuery("");
            }}
          >
            <span className="search-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
      {stripePromise ? (
        // No single shared <Elements> wrapper here anymore -- Stripe only
        // allows one wallet button to exist at a time per Elements group,
        // and this feed can easily have several cards (plus the expanded
        // photo view, plus an "out of plays" prompt) all mounted at once.
        // Each one now brings its own private <Elements> right where it's
        // used, so none of them ever compete with each other.
        <LightboxProvider>
          <PlayBalanceProvider>
            <Feed query={query} />
          </PlayBalanceProvider>
        </LightboxProvider>
      ) : (
        <p style={{ padding: 20, color: "var(--ink-dim)" }}>
          Add your Stripe publishable key to .env.local to turn on buying —
          see .env.local.example.
        </p>
      )}
    </main>
  );
}
