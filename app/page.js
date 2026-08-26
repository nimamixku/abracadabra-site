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

function LightboxProvider({ children }) {
  const [image, setImage] = useState(null); // { src, alt } | null

  useEffect(() => {
    if (!image) return;
    function onKey(e) {
      if (e.key === "Escape") setImage(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image]);

  return (
    <LightboxContext.Provider value={{ open: (src, alt) => setImage({ src, alt }) }}>
      {children}
      {image && (
        <div className="lightbox-overlay" onClick={() => setImage(null)}>
          <button
            className="lightbox-close"
            type="button"
            onClick={() => setImage(null)}
            aria-label="Close full view"
          >
            ✕
          </button>
          <img className="lightbox-img" src={image.src} alt={image.alt} />
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
      <InlineBuyButton
        label={PLAY_PACK.title}
        amountCents={PLAY_PACK.price}
        onSuccess={(paymentIntentId) => addPlays(PLAY_PACK.playsGranted, paymentIntentId)}
      />
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
function ProductCard({ product }) {
  const stripe = useStripe();
  const elements = useElements();
  const lightbox = useLightbox();
  const [selectedSize, setSelectedSize] = useState(product.sizes ? product.sizes[0] : null);
  const selectedSizeRef = useRef(selectedSize);
  selectedSizeRef.current = selectedSize;

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canApplePay, setCanApplePay] = useState(null); // null = still checking
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);

  const shippingCents = product.type === "physical" ? SHIPPING_CENTS : 0;

  // Plain-card fallback for anyone without Apple Pay or Google Pay set up
  // (most regular computers) -- without this, those shoppers had no way to
  // buy anything at all.
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
          size: selectedSizeRef.current,
          price: product.price,
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

  // Each card's Apple/Google Pay button is a real embedded iframe -- setting
  // one up for every card the instant it's created (rather than only the
  // ones actually on screen) is what was crashing phones on a long scroll:
  // dozens of cards, each spinning up its own payment iframe at once. So we
  // wait until a card is about to scroll into view before creating its
  // payment request at all.
  const cardRef = useRef(null);
  const [nearView, setNearView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setNearView(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!stripe || !nearView) return;

    const shippingCents = product.type === "physical" ? SHIPPING_CENTS : 0;
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
            size: selectedSizeRef.current,
            price: product.price,
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
  }, [stripe, product.id, nearView]);

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
          onClick={() => lightbox.open(product.image, product.title)}
        />
        <button
          type="button"
          className="expand-hint-wrap"
          aria-label="View full image"
          onClick={() => lightbox.open(product.image, product.title)}
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

        {product.sizes && status !== "success" && (
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

        {status === "success" && result && (
          <div style={{ marginTop: 14 }}>
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
        )}

        {status !== "success" && (
          <>
            {canApplePay && paymentRequest && (
              <div style={{ marginTop: 14 }}>
                <span className="buy-hint">✦ tap to buy</span>
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
              </div>
            )}
            {canApplePay === false && !showCardForm && (
              <button
                className="buy-btn"
                type="button"
                style={{ marginTop: 14 }}
                onClick={() => setShowCardForm(true)}
              >
                Pay with card — {formatPrice(product.price + shippingCents)}
              </button>
            )}
            {canApplePay === false && showCardForm && (
              <form onSubmit={handleCardPay} className="card-pay-form">
                <div className="card-element-wrap">
                  <CardElement options={CARD_ELEMENT_OPTIONS} />
                </div>
                <button
                  className="buy-btn"
                  type="submit"
                  disabled={status === "processing"}
                >
                  {status === "processing"
                    ? "Processing…"
                    : `Pay ${formatPrice(product.price + shippingCents)}`}
                </button>
              </form>
            )}
            {status === "processing" && (
              <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 10 }}>
                Confirming your payment…
              </p>
            )}
            {status === "error" && (
              <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{errorMsg}</p>
            )}
          </>
        )}
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

// Hard ceiling on how many cards can pile up in the DOM at once. Without
// this, "infinite" scroll really was infinite -- every batch added ~95
// more cards (each with its own images and its own Apple Pay button) and
// nothing was ever removed, so a long scroll session would slowly eat a
// phone's memory until the browser killed the tab. Once the cap is hit we
// just stop adding more; nobody scrolls through 300+ cards in one sitting.
const MAX_FEED_ITEMS = 150;

function Feed() {
  const [items, setItems] = useState(() =>
    shuffled(buildFeedPool()).map((it, i) => ({ ...it, feedKey: `${it.data.id}-${i}` }))
  );
  const sentinelRef = useRef(null);
  const batchRef = useRef(1);

  const loadMore = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= MAX_FEED_ITEMS) return prev;
      batchRef.current += 1;
      return [
        ...prev,
        ...shuffled(buildFeedPool()).map((it, i) => ({
          ...it,
          feedKey: `${it.data.id}-${batchRef.current}-${i}`,
        })),
      ];
    });
  }, []);

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

  return (
    <>
      <div className="feed">
        {items.map((item) =>
          item.feedType === "product" ? (
            <ProductCard product={item.data} key={item.feedKey} />
          ) : (
            <FeatureCard feature={item.data} key={item.feedKey} />
          )
        )}
      </div>
      <div className="feed-end" ref={sentinelRef} />
      <p className="loading-more">keep scrolling — it reshuffles</p>
    </>
  );
}

export default function Home() {
  return (
    <main className="page">
      <div className="masthead">
        <span className="brand">
          ABRACADABRA <span className="brand-sub">shop</span>
        </span>
      </div>
      {stripePromise ? (
        <LightboxProvider>
          <Elements stripe={stripePromise}>
            <PlayBalanceProvider>
              <Feed />
            </PlayBalanceProvider>
          </Elements>
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
