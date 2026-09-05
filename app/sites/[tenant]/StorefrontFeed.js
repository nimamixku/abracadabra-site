"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  PaymentRequestButtonElement,
  CardElement,
} from "@stripe/react-stripe-js";
import { cropBackgroundStyle } from "@/lib/cropStyle";

// The buyer-facing feed for one tenant's shop -- ported from the original
// single-tenant app/page.js, which is why several comments below still
// read like they're talking about "the" shop rather than "a" shop.
// Deliberately dropped from that original: PlayBalanceProvider + the
// candle/marquee/oracle mini-features (all single-tenant, weakly
// enforced, not worth rebuilding for v1 -- see the plan), and the
// "digital art shuffles its own price" gimmick (every tenant product has
// one real price the artist set, not three random tiers). Kept: the
// shuffle/infinite-scroll feed itself (the core mechanic, per the plan's
// design ethos), the tap-to-expand lightbox, one-tap wallet buy +
// double-click/tap buy, the floating "tap & pay" shortcut, and the
// recent-purchases banner.

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

// Video-only: the buyer-adjustable "give more" step and the fallback
// starting amount if a product's own details are somehow missing it.
// Mirrors TryItDemo.js's DONATE_SUGGESTED_CENTS/GIVE_MORE_STEP_CENTS
// exactly, so a real video product behaves like the demo an artist
// already tried.
const GIVE_MORE_STEP_CENTS = 300;
const DEFAULT_DONATE_SUGGESTED_CENTS = 1200;

function typeLabel(type) {
  if (type === "digital_image") return "Art · digital";
  if (type === "digital_audio") return "Audio · digital";
  if (type === "physical") return "Physical · ships";
  if (type === "video") return "Video · free to watch";
  return type;
}

// What a search matches against: title, description, and the type label
// (so "photo," "audio," "video," "physical" all work) -- plus "donate"/
// "donation" for any video that actually has that turned on, since a
// buyer would otherwise have no way to search specifically for those.
function searchableText(product) {
  const parts = [product.title, product.description, typeLabel(product.type)];
  if (product.type === "video" && product.details?.donate_enabled) {
    parts.push("donate", "donation");
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function isDigital(type) {
  return type === "digital_image" || type === "digital_audio";
}

// ---- "buy right from the feed" tracking ----
// Apple Pay and Google Pay's on-page button has to be the literal element
// a customer's finger actually lands on -- that's a security rule Apple
// and Google enforce themselves, so the floating "tap & pay" shortcut
// can't just be a generic button that triggers *some* purchase; instead
// every card quietly reports how visible it is, and the floating shortcut
// always hosts a real, live buy button for whichever card is currently
// most on screen.
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

// ---- click-to-expand full image view ----
// Cards can crop a photo down to a fixed frame when the artist has chosen
// a crop (see ProductCard below) -- this lets a shopper tap through to
// the whole, uncropped image before deciding to buy. Ported from the
// original app/page.js's LightboxProvider, generalized beyond
// "digital"-only products.
const LightboxContext = createContext(null);

function useLightbox() {
  return useContext(LightboxContext);
}

function LightboxProvider({ children }) {
  const [product, setLightboxProduct] = useState(null);
  const tenantStripe = useTenantStripe();

  useEffect(() => {
    if (!product) return;
    function onKey(e) {
      if (e.key === "Escape") setLightboxProduct(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product]);

  const previewImage = product?.files?.preview_image;

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
          {previewImage && (
            <img
              className="tenant-lightbox-img"
              src={`/api/preview?productId=${product.id}&kind=preview_image`}
              alt={product.title}
            />
          )}
          {/* Same buy option as the card, dropped in here so a shopper who
              stopped to look closer can buy without going back. Sizes
              don't fit well in this overlay, so physical items with size
              options are left to the card itself, same as the original. */}
          {isDigital(product.type) && (
            <div className="lightbox-buy" onClick={(e) => e.stopPropagation()}>
              <p className="lightbox-title">
                {product.title} · {formatPrice(product.price_cents)}
                <span className="tap-pay-chip">✦ tap &amp; pay</span>
              </p>
              <Elements stripe={tenantStripe}>
                <BuySection tenantSlug={product.tenantSlug} product={product} lazy={false} />
              </Elements>
            </div>
          )}
          <p className="lightbox-hint">tap the image to go back</p>
        </div>
      )}
    </LightboxContext.Provider>
  );
}

// ---- recent-purchase banner (sessionStorage-backed, no login needed) ----
const PURCHASES_STORAGE_KEY = "abracadabra-tenant-recent-purchases-v1";
const PURCHASE_VISIBLE_MS = 10 * 60 * 1000;
const PurchaseBannerContext = createContext(null);

function usePurchaseBanner() {
  return useContext(PurchaseBannerContext);
}

function PurchaseBannerProvider({ children }) {
  const [purchases, setPurchases] = useState([]); // [{ id, title, downloadUrl, at }]
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PURCHASES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPurchases((parsed || []).filter((p) => Date.now() - p.at < PURCHASE_VISIBLE_MS));
      }
    } catch {
      // start fresh
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.sessionStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
    } catch {
      // ignore
    }
  }, [purchases, loaded]);

  // Sweeps out anything past its window every so often, so a tab left open
  // for hours doesn't keep an ancient purchase pinned to the screen.
  useEffect(() => {
    const id = setInterval(() => {
      setPurchases((prev) => prev.filter((p) => Date.now() - p.at < PURCHASE_VISIBLE_MS));
    }, 15000);
    return () => clearInterval(id);
  }, []);

  function announcePurchase(purchase) {
    setPurchases((prev) => [
      { ...purchase, at: Date.now() },
      ...prev.filter((p) => p.id !== purchase.id),
    ]);
  }

  function dismiss(id) {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <PurchaseBannerContext.Provider value={{ announcePurchase }}>
      {children}
      {purchases.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          {purchases.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-line)",
                borderRadius: 12,
                padding: "12px 14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: p.downloadUrl ? 8 : 0,
                  gap: 10,
                }}
              >
                <p style={{ color: "var(--success)", fontWeight: 700, margin: 0, fontSize: 14 }}>
                  Purchased ✓ {p.title}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(p.id)}
                  aria-label="Dismiss"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ink-dim)",
                    fontSize: 16,
                    cursor: "pointer",
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
              {p.downloadUrl && (
                <a className="buy-btn" href={p.downloadUrl} download>
                  Download your file
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </PurchaseBannerContext.Provider>
  );
}

const BLANK_SHIP_DRAFT = { name: "", line1: "", line2: "", city: "", state: "", postalCode: "" };

function isShipDraftUsable(d) {
  return Boolean(
    d.name.trim() && d.line1.trim() && d.city.trim() && d.state.trim() && d.postalCode.trim()
  );
}

// Shared field set for both the inline (card-path) and floating
// (double-click-path) shipping forms -- see BuySection's "ship it here"
// UI below. Domestic-only for now, same as the flat shipping fee this
// platform already assumes elsewhere.
function ShipAddressFields({ value, onChange }) {
  return (
    <>
      <input
        className="card-email-input"
        placeholder="Full name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <input
        className="card-email-input"
        placeholder="Address line 1"
        value={value.line1}
        onChange={(e) => onChange({ ...value, line1: e.target.value })}
      />
      <input
        className="card-email-input"
        placeholder="Address line 2 (optional)"
        value={value.line2}
        onChange={(e) => onChange({ ...value, line2: e.target.value })}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="card-email-input"
          placeholder="City"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        />
        <input
          className="card-email-input"
          style={{ maxWidth: 64 }}
          placeholder="State"
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
        />
        <input
          className="card-email-input"
          style={{ maxWidth: 90 }}
          placeholder="ZIP"
          value={value.postalCode}
          onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
        />
      </div>
    </>
  );
}

// One product's buy flow: Apple/Google Pay one-tap (when available), a
// plain-card fallback, and the double-click/double-tap gesture on the
// card's own photo that opens the exact same wallet sheet. Adapted from
// app/page.js's BuySection to call the tenant-aware checkout routes
// (/api/checkout/create-intent + /api/checkout/confirm) instead of the
// old single-tenant /api/create-intent + /api/confirm, and to read
// shipping/sizes from product.details instead of a flat constant.
//
// A physical item needs a real address to ship to -- neither this app
// nor its single-tenant predecessor ever actually collected one (see
// migrations/004_order_shipping_address.sql). Rather than lean on
// Apple/Google Pay's own requestShipping prompt (inconsistent across
// wallets, and doesn't even apply to the plain-card path at all), this
// collects it once, ourselves, through the same "ship it here" UI
// regardless of which payment path a shopper ends up on -- inline,
// under the card's buy buttons, for the plain-card path; a floating
// overlay for the double-click/wallet path, so double-clicking a
// physical item's photo doesn't try to charge a card with nowhere to
// send the item. Either way the shopper never leaves the feed.
function BuySection({ tenantSlug, product, selectedSize = null, lazy = true, registerBuyNow }) {
  const stripe = useStripe();
  const elements = useElements();
  const { announcePurchase } = usePurchaseBanner();

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canApplePay, setCanApplePay] = useState(null); // null = still checking
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardEmail, setCardEmail] = useState("");

  const needsShipping = product.type === "physical";
  const [shipAddress, setShipAddress] = useState(null);
  const [shipDraft, setShipDraft] = useState(BLANK_SHIP_DRAFT);
  const [showShipForm, setShowShipForm] = useState(false);
  // Address and payment are independent -- a shopper can do either first.
  // This just saves the address locally so it's ready to send along
  // whenever payment happens (before or after this point).
  function saveShipAddress() {
    if (!isShipDraftUsable(shipDraft)) return;
    setShipAddress({ ...shipDraft });
    setShowShipForm(false);
  }

  // Post-purchase address prompt (shown in the success state below when a
  // physical order completed with no address yet) has its own draft/status
  // so it doesn't fight with the pre-purchase "ship it" form above.
  const [postDraft, setPostDraft] = useState(BLANK_SHIP_DRAFT);
  const [postShipStatus, setPostShipStatus] = useState("idle"); // idle | saving | error
  const [postShipError, setPostShipError] = useState("");

  async function savePostPurchaseShipAddress(paymentIntentId) {
    if (!isShipDraftUsable(postDraft)) return;
    setPostShipStatus("saving");
    setPostShipError("");
    try {
      const res = await fetch("/api/checkout/shipping-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, shippingAddress: postDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save that address.");
      setShipAddress({ ...postDraft });
      setPostShipStatus("idle");
    } catch (err) {
      setPostShipStatus("error");
      setPostShipError(err.message || "Something went wrong.");
    }
  }

  const sizes = Array.isArray(product.details?.sizes) ? product.details.sizes : [];
  const shippingCents = needsShipping ? Number(product.details?.shipping_cents || 0) : 0;
  const totalCents = product.price_cents + shippingCents;

  // Same lazy-mount reasoning as the original: dozens of cards each
  // spinning up their own Apple/Google Pay iframe at once is what crashed
  // phones on a long scroll, so a card's wallet button waits until it's
  // about to scroll into view. The floating shortcut's own copy
  // (lazy=false) creates it immediately since only one of those ever
  // exists at a time.
  const wrapRef = useRef(null);
  const [nearView, setNearView] = useState(!lazy);

  useEffect(() => {
    if (!lazy) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setNearView(entry.isIntersecting));
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!stripe || !nearView) {
      setPaymentRequest(null);
      setCanApplePay(null);
      return;
    }
    if (product.type === "physical" && sizes.length > 0 && !selectedSize) {
      // No size chosen yet -- don't offer the wallet button until there is
      // one, same as the plain-card path below refusing to submit.
      setPaymentRequest(null);
      setCanApplePay(null);
      return;
    }
    // Deliberately NOT gated on shipAddress -- a shopper can pay first and
    // add where-to-ship afterward (see the post-purchase form below), or
    // fill in "ship it" beforehand instead. Either order works; the
    // address just travels along with whichever step it's ready by.

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      // The flat shipping fee is already folded into totalCents, and the
      // address itself is collected by this app's own "ship it here" UI
      // (see above) -- requestShipping is deliberately left off so the
      // wallet never asks for it a second time in its own sheet.
      total: { label: product.title, amount: totalCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.on("paymentmethod", async (ev) => {
      setStatus("processing");
      try {
        const res = await fetch("/api/checkout/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug,
            productId: product.id,
            size: selectedSize,
            // Apple/Google Pay hand this over on their own -- the
            // customer never types it in -- so a receipt can go out
            // without adding any extra step for them.
            payerEmail: ev.payerEmail,
            ...(needsShipping ? { shippingAddress: shipAddress } : {}),
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

        const confirmRes = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.id }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm purchase.");

        setResult({ ...confirmData, paymentIntentId: intent.id });
        setStatus("success");
        if (isDigital(confirmData.type)) {
          announcePurchase({
            id: intent.id,
            title: confirmData.title || product.title,
            downloadUrl: confirmData.downloadUrl,
          });
        }
      } catch (err) {
        ev.complete("fail");
        setStatus("error");
        setErrorMsg(err.message || "Something went wrong.");
      }
    });

    pr.canMakePayment().then((res) => setCanApplePay(!!res));
    setPaymentRequest(pr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, product.id, totalCents, selectedSize, nearView, needsShipping, shipAddress]);

  // Double-click/double-tap on the card's photo opens this same wallet
  // sheet -- see registerBuyNow below (ProductCard wires it to the photo's
  // onDoubleClick). No new payment path: it just calls .show() on the
  // exact paymentRequest object the wallet button itself would call --
  // for a physical item this proceeds even with no shipping address yet,
  // same as the wallet button and "pay with card" both do; the address
  // gets collected via "ship it" (before or after paying, whichever the
  // shopper prefers) rather than blocking the purchase itself.
  useEffect(() => {
    if (!registerBuyNow) return;
    if (!paymentRequest || !canApplePay) {
      registerBuyNow(null);
      return;
    }
    registerBuyNow(() => paymentRequest.show());
    return () => registerBuyNow(null);
  }, [registerBuyNow, paymentRequest, canApplePay]);

  // Plain-card fallback for anyone without Apple Pay or Google Pay set up.
  async function handleCardPay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;
    if (product.type === "physical" && sizes.length > 0 && !selectedSize) {
      setStatus("error");
      setErrorMsg("Pick a size first.");
      return;
    }
    setStatus("processing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          productId: product.id,
          size: selectedSize,
          payerEmail: cardEmail,
          ...(needsShipping ? { shippingAddress: shipAddress } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment.");

      const confirmResult = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (confirmResult.error) {
        setStatus("error");
        setErrorMsg(confirmResult.error.message || "Payment failed.");
        return;
      }

      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: confirmResult.paymentIntent.id }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm purchase.");

      setResult({ ...confirmData, paymentIntentId: confirmResult.paymentIntent.id });
      setStatus("success");
      if (isDigital(confirmData.type)) {
        announcePurchase({
          id: confirmResult.paymentIntent.id,
          title: confirmData.title || product.title,
          downloadUrl: confirmData.downloadUrl,
        });
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong.");
    }
  }

  if (status === "success" && result) {
    return (
      <div ref={wrapRef} style={{ marginTop: 14 }}>
        {isDigital(result.type) && result.downloadUrl ? (
          <>
            <a className="buy-btn" href={result.downloadUrl} download>
              Purchased ✓ — Download your file
            </a>
            {result.type === "digital_image" && (
              <p className="tiff-note">
                This is the artist's original full-quality file, exactly as
                uploaded -- it may be a large print-ready format that looks
                soft or oversized when opened straight on a phone or
                laptop screen. That's normal, not a flaw.
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ color: "var(--success)", fontWeight: 700, margin: 0 }}>
              Purchased ✓ — shipping your {result.size ? result.size + " " : ""}
              {(result.title || product.title).toLowerCase()} soon
            </p>
            {shipAddress ? (
              <p className="card-desc">
                To {shipAddress.name} — {shipAddress.line1}
                {shipAddress.line2 ? `, ${shipAddress.line2}` : ""}, {shipAddress.city}, {shipAddress.state}{" "}
                {shipAddress.postalCode}
              </p>
            ) : (
              // Its own class (not card-pay-form) so it isn't caught by the
              // floating widget's blanket hide rule -- inside the floating
              // "tap & pay" shortcut this instead renders as a second box
              // right below it (see .floating-buy-wrap .ship-prompt-box in
              // globals.css), so a wallet buyer who paid with no address on
              // file gets prompted right there, without scrolling down to
              // the card itself. It vanishes the moment shipAddress is set
              // (this whole branch stops rendering), so "closes and they
              // keep going" happens for free -- no extra state needed.
              <div className="ship-prompt-box">
                <p className="card-desc">
                  Paid ✓ — we just need to know where to ship it.
                </p>
                <form
                  className="ship-prompt-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePostPurchaseShipAddress(result.paymentIntentId);
                  }}
                >
                  <ShipAddressFields value={postDraft} onChange={setPostDraft} />
                  <button
                    className="buy-btn"
                    type="submit"
                    disabled={!isShipDraftUsable(postDraft) || postShipStatus === "saving"}
                  >
                    {postShipStatus === "saving" ? "Saving…" : "Save shipping address"}
                  </button>
                  {postShipStatus === "error" && (
                    <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 6 }}>{postShipError}</p>
                  )}
                </form>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* A fixed-size marker, not the button/iframe stack itself -- see
          app/page.js's BuySection for why this has to stay a stable 1px
          element rather than the thing whose size actually changes. */}
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
        {showCardForm ? "cancel" : `pay with card — ${formatPrice(totalCents)}`}
      </button>

      {showCardForm && (
        <form onSubmit={handleCardPay} className="card-pay-form">
          <div className="card-element-wrap">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
          <input
            type="email"
            className="card-email-input"
            placeholder="email for receipt (optional)"
            value={cardEmail}
            onChange={(e) => setCardEmail(e.target.value)}
          />
          <button className="buy-btn" type="submit" disabled={status === "processing"}>
            {status === "processing" ? "Processing…" : `Pay ${formatPrice(totalCents)}`}
          </button>
        </form>
      )}

      {/* Below the card button, per the design -- a physical item always
          shows this, filling it in inline without ever leaving the feed.
          Once saved it collapses back down and payment proceeds exactly
          as any other product's would. */}
      {needsShipping && (
        <>
          <button
            type="button"
            className="quick-card-btn"
            style={{ marginTop: 8, display: "block" }}
            onClick={() => {
              setShipDraft(shipAddress || BLANK_SHIP_DRAFT);
              setShowShipForm((s) => !s);
            }}
          >
            {showShipForm ? "cancel" : shipAddress ? "✓ ship it — edit" : "ship it"}
          </button>
          {showShipForm && (
            <form
              className="card-pay-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveShipAddress();
              }}
            >
              <ShipAddressFields value={shipDraft} onChange={setShipDraft} />
              <button className="buy-btn" type="submit" disabled={!isShipDraftUsable(shipDraft)}>
                Save address
              </button>
            </form>
          )}
        </>
      )}

      {canApplePay && paymentRequest && (
        <div className="buy-row">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: { paymentRequestButton: { type: "buy", theme: "dark", height: "50px" } },
            }}
          />
          <span className="buy-hint">✦ tap &amp; pay</span>
        </div>
      )}

      {status === "processing" && (
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 10 }}>Confirming your payment…</p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{errorMsg}</p>
      )}

    </div>
  );
}

// Sibling to BuySection, for the one product type with no fixed price at
// all: a video is always free to watch, and this is the entirely
// separate, buyer-adjustable donation flow for pieces the artist has
// opted into accepting them for (ProductManager.js's "let viewers
// donate" toggle). Kept as its own component rather than a branch
// inside BuySection on purpose -- a donation's amount is chosen by the
// buyer every time, nothing else's price ever is, and keeping those two
// mechanisms fully apart means a future change to one can never
// accidentally change how the other charges someone.
function DonateSection({ tenantSlug, product, lazy = true }) {
  const stripe = useStripe();
  const elements = useElements();

  const suggestedCents = Number(product.details?.donate_suggested_cents) || DEFAULT_DONATE_SUGGESTED_CENTS;
  const [amountCents, setAmountCents] = useState(suggestedCents);
  const [giveMoreOpen, setGiveMoreOpen] = useState(false);

  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canApplePay, setCanApplePay] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [thankYou, setThankYou] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardEmail, setCardEmail] = useState("");

  // Same lazy-mount reasoning as BuySection -- a card's wallet button
  // waits until it's about to scroll into view.
  const wrapRef = useRef(null);
  const [nearView, setNearView] = useState(!lazy);

  useEffect(() => {
    if (!lazy) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setNearView(entry.isIntersecting));
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  // Rebuilding the paymentRequest whenever amountCents changes (via the
  // give-more stepper) is the same approach BuySection already takes for
  // totalCents -- keeps this consistent with the one other place a
  // wallet total can change after mount, rather than introducing a
  // second pattern (Stripe's paymentRequest.update() would also work,
  // but this matches the existing code).
  useEffect(() => {
    if (!stripe || !nearView) {
      setPaymentRequest(null);
      setCanApplePay(null);
      return;
    }

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: `Donate — ${product.title}`, amount: amountCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.on("paymentmethod", async (ev) => {
      setStatus("processing");
      try {
        const res = await fetch("/api/checkout/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug,
            productId: product.id,
            payerEmail: ev.payerEmail,
            donationAmountCents: amountCents,
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

        const confirmRes = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.id }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm donation.");

        setThankYou(true);
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
  }, [stripe, product.id, amountCents, nearView]);

  // Plain-card fallback, same shape as BuySection's.
  async function handleCardPay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;
    setStatus("processing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          productId: product.id,
          payerEmail: cardEmail,
          donationAmountCents: amountCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment.");

      const confirmResult = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (confirmResult.error) {
        setStatus("error");
        setErrorMsg(confirmResult.error.message || "Payment failed.");
        return;
      }

      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: confirmResult.paymentIntent.id }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Could not confirm donation.");

      setThankYou(true);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong.");
    }
  }

  if (thankYou) {
    return (
      <div ref={wrapRef} style={{ marginTop: 14 }}>
        <p style={{ color: "var(--success)", fontWeight: 700, margin: 0 }}>
          Thank you for donating {formatPrice(amountCents)} ✓
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ marginTop: 14, position: "relative" }}>
      {canApplePay && paymentRequest ? (
        <div className="buy-row">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: { paymentRequestButton: { type: "donate", theme: "dark", height: "50px" } },
            }}
          />
          <span className="buy-hint">✦ tap &amp; give</span>
        </div>
      ) : (
        <>
          <button type="button" className="quick-card-btn" onClick={() => setShowCardForm((s) => !s)}>
            {showCardForm ? "cancel" : `give by card — ${formatPrice(amountCents)}`}
          </button>
          {showCardForm && (
            <form onSubmit={handleCardPay} className="card-pay-form">
              <div className="card-element-wrap">
                <CardElement options={CARD_ELEMENT_OPTIONS} />
              </div>
              <input
                type="email"
                className="card-email-input"
                placeholder="email for receipt (optional)"
                value={cardEmail}
                onChange={(e) => setCardEmail(e.target.value)}
              />
              <button className="buy-btn" type="submit" disabled={status === "processing"}>
                {status === "processing" ? "Processing…" : `Donate ${formatPrice(amountCents)}`}
              </button>
            </form>
          )}
        </>
      )}

      {giveMoreOpen && (
        <div className="tryit-give-more-stepper">
          <button
            type="button"
            className="tryit-step-btn"
            onClick={() =>
              setAmountCents((c) => Math.max(GIVE_MORE_STEP_CENTS, c - GIVE_MORE_STEP_CENTS))
            }
          >
            −
          </button>
          <span className="tryit-amount-readout">{formatPrice(amountCents)}</span>
          <button
            type="button"
            className="tryit-step-btn"
            onClick={() => setAmountCents((c) => c + GIVE_MORE_STEP_CENTS)}
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        className="tryit-give-more-link"
        onClick={() => {
          if (giveMoreOpen) setAmountCents(suggestedCents);
          setGiveMoreOpen((o) => !o);
        }}
      >
        {giveMoreOpen ? `never mind — back to ${formatPrice(suggestedCents)}` : "give more"}
      </button>

      {status === "processing" && (
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 10 }}>Confirming your donation…</p>
      )}
      {status === "error" && (
        <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{errorMsg}</p>
      )}
    </div>
  );
}

// One scrollable card. Unlike the original single-tenant .card-media, the
// image here is never force-cropped by default (see the plan's "No forced
// cropping, ever" principle) -- it keeps its own natural shape, with only
// a soft max-height guardrail via CSS. An artist can still opt a specific
// product into an exact custom crop from the dashboard's own CropEditor
// (product.details.crop -- see lib/cropStyle.js, an exact rectangle the
// artist drew over their own photo, never a preset shape); when set, that
// crop applies here, but the lightbox (tap/click to expand) always shows
// the whole, uncropped original regardless, same as the original
// single-tenant site's own tap-to-expand behavior. When
// product_files.width_px/height_px are captured, the natural (uncropped)
// case's aspect-ratio locks in ahead of time and prevents layout shift;
// until then it just renders at its natural size once the image loads.
function ProductCard({ tenantSlug, product }) {
  const sizes = Array.isArray(product.details?.sizes) ? product.details.sizes : [];
  const [selectedSize, setSelectedSize] = useState(sizes[0] || null);
  const cardRef = useRegisterCard(product);
  const buyNowRef = useRef(null);
  const lightbox = useLightbox();
  // A single click/tap opens the lightbox; a second one within the same
  // window is a double-click/tap and buys instead (see handleDoubleClick
  // below). Delaying the single-click action long enough to know which one
  // this is keeps the two gestures from fighting -- without this, the
  // first click would open the lightbox and cover the photo before the
  // second click/dblclick event ever had a chance to land on it.
  const clickTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);
  // Hooks must run unconditionally on every render (Rules of Hooks) --
  // read the shared tenant Stripe instance here, once, rather than inline
  // inside the JSX below.
  const tenantStripe = useTenantStripe();

  const previewImage = product.files?.preview_image;
  const previewClip = product.files?.preview_clip;
  const crop = product.details?.crop; // undefined/null = natural (default); otherwise an exact { x, y, w, h, srcW, srcH } rectangle
  const isVideo = product.type === "video";
  const hasVideoFile = Boolean(product.files?.video);
  const donateEnabled = isVideo && Boolean(product.details?.donate_enabled);

  function openLightbox() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    lightbox.open({ ...product, tenantSlug });
  }

  const handleClick = useCallback(() => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      lightbox.open({ ...product, tenantSlug });
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, product, tenantSlug]);

  // Double-click (desktop) / double-tap (touch, via two fast clicks) on
  // the photo opens the same wallet sheet the Apple/Google Pay button
  // would -- see the plan's "Buy gesture" section. No-ops harmlessly if
  // the wallet button isn't available/ready yet.
  const handleDoubleClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (buyNowRef.current) buyNowRef.current();
  }, []);

  return (
    <div className="card" ref={cardRef}>
      <div
        className="tenant-card-media"
        // A video fills this whole area with its own native controls --
        // no separate cover photo to route single/double-click through,
        // so those gestures (lightbox open, double-click-to-buy) are
        // deliberately left off here rather than fighting the video
        // player for taps. Donating happens through the button below,
        // same as how digital_audio's buy flow never sits on the audio
        // element itself either.
        onClick={isVideo ? undefined : handleClick}
        onDoubleClick={isVideo ? undefined : handleDoubleClick}
      >
        <span className="card-kind">{typeLabel(product.type)}</span>
        {isVideo ? (
          hasVideoFile ? (
            <video
              src={`/api/preview?productId=${product.id}&kind=video`}
              controls
              playsInline
              preload="none"
            />
          ) : (
            <div className="tenant-card-media-empty" aria-hidden="true" />
          )
        ) : previewImage && crop ? (
          <div
            className="tenant-card-cropped"
            role="img"
            aria-label={product.title}
            style={{
              ...cropBackgroundStyle(crop),
              backgroundImage: `url(/api/preview?productId=${product.id}&kind=preview_image)`,
            }}
          />
        ) : previewImage ? (
          <img
            src={`/api/preview?productId=${product.id}&kind=preview_image`}
            alt={product.title}
            loading="lazy"
            style={
              previewImage.width_px && previewImage.height_px
                ? { aspectRatio: `${previewImage.width_px} / ${previewImage.height_px}` }
                : undefined
            }
          />
        ) : (
          <div className="tenant-card-media-empty" aria-hidden="true" />
        )}
        {!isVideo && previewImage && (
          <button
            type="button"
            className="expand-hint-wrap"
            aria-label="View full image"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox();
            }}
          >
            <span className="expand-hint" aria-hidden="true" />
            <span className="expand-label">expand</span>
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="card-row">
          <p className="card-title">{product.title}</p>
          <div className="card-price-col">
            <p className="card-price">{isVideo ? "Free to watch" : formatPrice(product.price_cents)}</p>
          </div>
        </div>

        {product.description && <p className="card-desc">{product.description}</p>}

        {previewClip && (
          <audio
            controls
            preload="none"
            src={`/api/preview?productId=${product.id}&kind=preview_clip`}
            style={{ width: "100%", marginTop: 12 }}
          >
            Your browser doesn&apos;t support inline audio -- buy to download the full track.
          </audio>
        )}

        {sizes.length > 0 && (
          <div className="size-row">
            {sizes.map((s) => (
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

        {/* Its own Elements instance, same reasoning as the original: Stripe
            only allows one wallet-button group to behave predictably at a
            time, and this feed can have many cards mounted at once. Every
            card here shares the SAME tenant-scoped stripePromise (one
            Connect account per shop), unlike the platform-wide one in the
            old single-tenant page. */}
        {isVideo ? (
          donateEnabled && (
            <Elements stripe={tenantStripe}>
              <DonateSection tenantSlug={tenantSlug} product={product} lazy={true} />
            </Elements>
          )
        ) : (
          <Elements stripe={tenantStripe}>
            <BuySection
              tenantSlug={tenantSlug}
              product={product}
              selectedSize={selectedSize}
              lazy={true}
              registerBuyNow={(fn) => {
                buyNowRef.current = fn;
              }}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

// Shared per-shop Stripe.js instance -- every card and the floating buy
// shortcut all need the SAME one (loadStripe(pk, { stripeAccount }) is
// expensive to redo per-card and must point at this tenant's own Connect
// account, never the platform's default one). Provided once at the top of
// the tree and read here via context rather than prop-drilling through
// every card.
const TenantStripeContext = createContext(null);
function useTenantStripe() {
  return useContext(TenantStripeContext);
}

const BATCH_SIZE = 18;

function Feed({ tenantSlug, products, searchQuery }) {
  const poolSize = products.length;
  const maxFeedItems = poolSize === 0 ? 0 : Math.ceil(poolSize / BATCH_SIZE) * BATCH_SIZE;

  // A shuffled queue drawn from in order -- guarantees every product shows
  // up once before anything repeats, rather than each batch being an
  // independent random draw. Starts UNSHUFFLED (plain catalog order) so
  // the very first render matches between server and client -- Math.random()
  // isn't shared between the two, so shuffling here in the initial state
  // (like the original single-tenant app/page.js does) causes a real
  // hydration mismatch. The actual shuffle happens once, client-side only,
  // in the mount effect below; React treats that as a normal post-mount
  // update rather than a mismatch.
  const queueRef = useRef([...products]);
  const posRef = useRef(0);

  const takeBatch = useCallback(
    (n) => {
      if (products.length === 0) return [];
      const out = [];
      while (out.length < n) {
        if (posRef.current >= queueRef.current.length) {
          queueRef.current = shuffled(products);
          posRef.current = 0;
        }
        out.push(queueRef.current[posRef.current]);
        posRef.current += 1;
      }
      return out;
    },
    [products]
  );

  const [items, setItems] = useState(() =>
    takeBatch(BATCH_SIZE).map((p, i) => ({ ...p, feedKey: `${p.id}-${i}` }))
  );
  const sentinelRef = useRef(null);
  const batchRef = useRef(1);

  const loadMore = useCallback(() => {
    setItems((prev) => {
      if (prev.length >= maxFeedItems) return prev;
      batchRef.current += 1;
      return [
        ...prev,
        ...takeBatch(BATCH_SIZE).map((p, i) => ({ ...p, feedKey: `${p.id}-${batchRef.current}-${i}` })),
      ];
    });
  }, [takeBatch, maxFeedItems]);

  const reshuffleRef = useRef(0);
  const reshuffle = useCallback(() => {
    queueRef.current = shuffled(products);
    posRef.current = 0;
    batchRef.current = 1;
    reshuffleRef.current += 1;
    setItems(
      takeBatch(BATCH_SIZE).map((p, i) => ({ ...p, feedKey: `${p.id}-r${reshuffleRef.current}-${i}` }))
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [takeBatch, products]);

  // The actual shuffle -- see the comment on queueRef above for why this
  // can't happen during the initial render. Runs once, right after mount,
  // before the shopper has had a chance to actually look at anything, so
  // in practice this reorder is invisible -- it just means the very first
  // paint (server-rendered or from a disabled-JS crawler) shows plain
  // catalog order, and real visitors see the shuffled order a moment later.
  useEffect(() => {
    queueRef.current = shuffled(products);
    posRef.current = 0;
    batchRef.current = 1;
    setItems(takeBatch(BATCH_SIZE).map((p, i) => ({ ...p, feedKey: `${p.id}-m${i}` })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Every card reports its own visibility here; whichever one is most in
  // view becomes the target for the floating "tap & pay" shortcut.
  const cardEntriesRef = useRef(new Map());
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

  const atEnd = items.length >= maxFeedItems;
  // Physical products with sizes need that choice made on their own card,
  // so they're left out of the floating shortcut -- same as the original.
  const floatingEligible =
    activeProduct &&
    !(activeProduct.type === "physical" && Array.isArray(activeProduct.details?.sizes) && activeProduct.details.sizes.length > 0) &&
    // A video with no donations turned on has nothing for this shortcut
    // to offer -- watching itself is never gated behind any buy action.
    !(activeProduct.type === "video" && !activeProduct.details?.donate_enabled);
  // Read unconditionally (Rules of Hooks) even though it's only used in
  // the floatingEligible branch below.
  const tenantStripe = useTenantStripe();

  if (products.length === 0) {
    return <p style={{ padding: 20, color: "var(--ink-dim)" }}>Nothing for sale here yet -- check back soon.</p>;
  }

  // Searching shows exactly the matches, not a shuffled stream they
  // might happen to appear in -- so this deliberately skips the whole
  // batching/reshuffling machinery above rather than filtering the
  // queue that feeds it. Nothing about the shuffle behavior itself
  // changes; a cleared search box falls straight back to it untouched.
  const trimmedQuery = (searchQuery || "").trim().toLowerCase();
  if (trimmedQuery) {
    const matches = products.filter((p) => searchableText(p).includes(trimmedQuery));
    return (
      <>
        <ActiveCardContext.Provider value={registerCard}>
          <div className="feed">
            {matches.length === 0 ? (
              <p style={{ padding: 20, color: "var(--ink-dim)" }}>
                No matches for &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              matches.map((p) => <ProductCard tenantSlug={tenantSlug} product={p} key={p.id} />)
            )}
          </div>
        </ActiveCardContext.Provider>
        {floatingEligible && matches.some((p) => p.id === activeProduct.id) && (
          <Elements stripe={tenantStripe} key={activeProduct.id}>
            <FloatingBuy tenantSlug={tenantSlug} product={activeProduct} />
          </Elements>
        )}
      </>
    );
  }

  return (
    <>
      <ActiveCardContext.Provider value={registerCard}>
        <div className="feed">
          {items.map((item) => (
            <ProductCard tenantSlug={tenantSlug} product={item} key={item.feedKey} />
          ))}
        </div>
      </ActiveCardContext.Provider>
      <div className="feed-end" ref={sentinelRef} />
      <p className="loading-more">
        {atEnd ? "that's everything for now — refresh to shuffle a new set" : "keep scrolling — it reshuffles"}
      </p>
      <button type="button" className="floating-shuffle" onClick={reshuffle} aria-label="Shuffle the feed">
        ✦ shuffle
      </button>
      {floatingEligible && (
        <Elements stripe={tenantStripe} key={activeProduct.id}>
          <FloatingBuy tenantSlug={tenantSlug} product={activeProduct} />
        </Elements>
      )}
    </>
  );
}

// The floating "tap & pay" shortcut -- a real, live buy button for
// whichever card is currently most visible.
function FloatingBuy({ tenantSlug, product }) {
  const isVideo = product.type === "video";
  return (
    <div className="floating-buy-wrap">
      <p className="floating-buy-title">
        <span className="floating-buy-title-text">{product.title}</span>
        <span className="tap-pay-chip">✦ tap &amp; {isVideo ? "donate" : "pay"}</span>
      </p>
      {isVideo ? (
        <DonateSection tenantSlug={tenantSlug} product={product} lazy={false} />
      ) : (
        <BuySection tenantSlug={tenantSlug} product={product} lazy={false} />
      )}
    </div>
  );
}

export default function StorefrontFeed({ tenantSlug, stripeAccount, products, searchQuery }) {
  const tenantStripePromise = useMemo(() => {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk || !stripeAccount) return null;
    // A connected account's PaymentIntent only resolves against THAT
    // account's Stripe.js context -- never the platform's own default one.
    return loadStripe(pk, { stripeAccount });
  }, [stripeAccount]);

  if (!tenantStripePromise) {
    return (
      <p style={{ padding: 20, color: "var(--ink-dim)" }}>
        This shop can&apos;t accept payments right now — check back soon.
      </p>
    );
  }

  return (
    <TenantStripeContext.Provider value={tenantStripePromise}>
      <PurchaseBannerProvider>
        <LightboxProvider>
          <Feed tenantSlug={tenantSlug} products={products} searchQuery={searchQuery} />
        </LightboxProvider>
      </PurchaseBannerProvider>
    </TenantStripeContext.Provider>
  );
}
