"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The landing page's "try it before you sign up" demo (see the plan's
// design ethos section). This deliberately reuses the REAL tenant
// storefront's own classes (.card, .tenant-card-media, .expand-hint-wrap,
// .floating-shuffle, .floating-buy-wrap, .lightbox-overlay, etc. -- see
// app/sites/[tenant]/StorefrontFeed.js) rather than inventing a look-
// alike, so this is a genuine visual copy of the real shop, not an
// approximation of it. The only things that differ from the real thing:
// data comes from locally-dropped files instead of the database, and the
// buy buttons are inert -- clicking one funnels to signup instead of
// opening a real Stripe wallet sheet. Nothing dropped here is ever
// uploaded anywhere; it's gone the moment the tab closes.
//
// variant="interactive" (default) is the hands-on version a visitor
// drags their own photos into. variant="ambient" is the same component,
// driving itself on a timer with the founder's own real preview photos
// (see AMBIENT_SAMPLE_POOL below) and with all interaction disabled --
// the small, passive companion described in the plan, built as one
// literal reuse of the interactive version instead of a second
// hand-maintained copy that could drift out of sync with it.
const DEMO_TITLES = [
  "Untitled",
  "Study No. 1",
  "Morning Light",
  "Fragment",
  "Held",
];
const DEMO_PRICE_CENTS = 2800;
const SLOT_COUNT = 5;

// Crop only ever changes how a piece's PREVIEW shows in the feed -- never
// the actual file a buyer downloads, and never the full uncropped view
// behind "expand" either (that always shows the real preview image as-is,
// same as the real storefront's lightbox). Every new photo starts at
// "natural" (no crop, null here) -- an artist opts into a crop, it's
// never forced by default.
const CROP_CYCLE = [null, "square", "portrait"];

const AMBIENT_SAMPLE_POOL = [
  "flowers-and-roof.jpg",
  "fuchsia.jpg",
  "tassles.jpg",
  "magnolia-in-the-city.jpg",
  "fairy-flower.jpg",
  "porch-drapes.jpg",
  "roses.jpg",
  "flowers-by-the-tracks.jpg",
  "band.jpg",
  "cafe-du-monde.jpg",
  "screens.jpg",
  "house-to-marigny.jpg",
  "nightwork.jpg",
  "red-roses.jpg",
  "french-quarter-door.jpg",
  "sunflower-white-house.jpg",
  "porch-light.jpg",
  "tree-magic.jpg",
  "tower-palm.jpg",
];
const AMBIENT_SLOT_COUNT = 4;
const AMBIENT_DROP_MS = 650;
const AMBIENT_HOLD_MS = 2600;
const AMBIENT_CLEAR_MS = 500;

// Same two knobs as the real dashboard's ThemePicker -- background and
// text color, nothing else -- so a visitor can try that part of running
// a shop too, not just dropping in photos. Preview-only: lives in this
// component's own state, never sent anywhere, gone the moment the tab
// closes, same as the photos themselves.
const DEFAULT_THEME_BG = "#0b0b0d";
const DEFAULT_THEME_INK = "#f3f2ee";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Same starter-title logic as the real dashboard's bulk upload
// (ProductManager.js's titleFromFilename) -- turns "sunset-over-the-
// bay.jpg" into "Sunset Over The Bay". A visitor's own dropped photo gets
// a real starting title pulled from its own filename, editable right on
// the card, same as an artist would see on their own dashboard -- this
// is the "simulate the real experience as much as possible" version of
// the demo: type a title and a price, right here, the same motion as
// actually posting a piece. Still purely local/in-memory -- nothing
// typed here is ever sent anywhere, same as the photos themselves.
function titleFromFilename(filename) {
  const base = String(filename || "").replace(/\.[^./\\]+$/, "");
  const title = base
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return title || "Untitled";
}

// Whatever the visitor typed, or a sensible fallback while the price
// field is still blank -- so the floating "tap & pay" chip and the
// lightbox still show a real-looking number even before anyone bothers
// to type one in.
function priceCentsFor(slot) {
  const parsed = Math.round(Number.parseFloat(slot?.priceInput || "") * 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEMO_PRICE_CENTS;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function emptySlots(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    url: null,
    title: null,
    priceInput: "",
    crop: null,
  }));
}

export default function TryItDemo({ variant = "interactive" }) {
  const isAmbient = variant === "ambient";
  const slotCount = isAmbient ? AMBIENT_SLOT_COUNT : SLOT_COUNT;

  const [slots, setSlots] = useState(() => emptySlots(slotCount));
  const [expandedId, setExpandedId] = useState(null);
  const [buyHint, setBuyHint] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [themeBg, setThemeBg] = useState(DEFAULT_THEME_BG);
  const [themeInk, setThemeInk] = useState(DEFAULT_THEME_INK);
  // Crop toggle visibility: whichever card the mouse is currently over
  // (desktop) OR whichever card has a title/price field focused (mobile,
  // where there's no hover) -- shows for either, hides once neither
  // applies anymore. Two separate pieces of state, combined with OR when
  // rendering, so hovering and editing never fight each other or flicker.
  const [hoverId, setHoverId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const fileInputRef = useRef(null);
  const pendingIdRef = useRef(null);
  const screenRef = useRef(null);
  const cardRefs = useRef({});
  const titleInputRefs = useRef({});
  const clickTimerRef = useRef(null);

  // Scoped scroll: moves the card within the phone's OWN scroll
  // container only, by measuring how far off it is from that
  // container's center and nudging screenEl.scrollTop directly.
  // Never touches window/document -- scrollIntoView() on the card
  // element bubbles up and scrolls the whole marketing page too,
  // which is exactly the bug this replaces.
  const scrollCardIntoView = useCallback((id) => {
    const screenEl = screenRef.current;
    const cardEl = cardRefs.current[id];
    if (!screenEl || !cardEl) return;
    const screenRect = screenEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const delta = cardRect.top + cardRect.height / 2 - (screenRect.top + screenRect.height / 2);
    screenEl.scrollTo({ top: screenEl.scrollTop + delta, behavior: "smooth" });
  }, []);

  useEffect(() => {
    return () => {
      slots.forEach((s) => s.url && s.url.startsWith("blob:") && URL.revokeObjectURL(s.url));
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient mode: drive the whole thing on a timer instead of user
  // input -- drop in, hold, shuffle, hold, clear, repeat, forever.
  useEffect(() => {
    if (!isAmbient) return undefined;
    let cancelled = false;
    let timer = null;
    let pool = shuffleArray(AMBIENT_SAMPLE_POOL).slice(0, AMBIENT_SLOT_COUNT);
    let filledCount = 0;

    function dropNext() {
      if (cancelled) return;
      if (filledCount < AMBIENT_SLOT_COUNT) {
        const id = filledCount;
        const title = DEMO_TITLES[Math.floor(Math.random() * DEMO_TITLES.length)];
        setSlots((prev) =>
          prev.map((s) => (s.id === id ? { ...s, url: `/previews/${pool[id]}`, title } : s))
        );
        filledCount++;
        // Auto-scroll the newly dropped card into view -- the phone's
        // screen is real feed height, taller than this small frame shows
        // at a glance, so without this the later cards would silently
        // drop in off-screen. Scoped to the phone's own scroll
        // container -- never the page.
        setTimeout(() => {
          scrollCardIntoView(id);
        }, 60);
        timer = setTimeout(dropNext, AMBIENT_DROP_MS);
      } else {
        timer = setTimeout(shuffleOnce, AMBIENT_HOLD_MS);
      }
    }
    function shuffleOnce() {
      if (cancelled) return;
      setSlots((prev) => shuffleArray(prev));
      timer = setTimeout(clearAll, AMBIENT_HOLD_MS);
    }
    function clearAll() {
      if (cancelled) return;
      screenRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setSlots(emptySlots(AMBIENT_SLOT_COUNT));
      filledCount = 0;
      pool = shuffleArray(AMBIENT_SAMPLE_POOL).slice(0, AMBIENT_SLOT_COUNT);
      timer = setTimeout(dropNext, AMBIENT_CLEAR_MS);
    }

    timer = setTimeout(dropNext, AMBIENT_DROP_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAmbient]);

  const filled = slots.filter((s) => s.url);
  const hasAny = filled.length > 0;

  // Mirrors the real storefront's ActiveCardContext -- tracks whichever
  // filled card is most visible in the phone's own scroll area, so the
  // floating widget always points at what's actually on screen.
  useEffect(() => {
    const screenEl = screenRef.current;
    if (!screenEl || !hasAny) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (entry.intersectionRatio > 0 && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }
        if (best) setActiveId(Number(best.target.dataset.slotId));
      },
      { root: screenEl, threshold: [0.3, 0.6, 0.9] }
    );
    Object.values(cardRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [isAmbient, hasAny, slots]);

  // "Fit text" for the editable title -- a title auto-filled from a real
  // filename (see titleFromFilename above) can easily be one long
  // unbroken word ("Neworleansnight") that's wider than the card, and a
  // single-line <input> just clips it instead of wrapping like a <p>
  // would. Rather than truncate it, shrink that one title's font size
  // just enough to fit on its own line, same idea as iOS's
  // adjusts-font-size-to-fit-width. Resets to the base size and
  // re-measures every time any title changes, so editing back down to a
  // short title grows it back to normal.
  useEffect(() => {
    const BASE_PX = 18; // matches .card-title's own font-size
    const MIN_PX = 11;
    slots.forEach((slot) => {
      const el = titleInputRefs.current[slot.id];
      if (!el) return;
      el.style.fontSize = `${BASE_PX}px`;
      let size = BASE_PX;
      while (el.scrollWidth > el.clientWidth && size > MIN_PX) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    });
  }, [slots]);

  const fillSlot = useCallback(
    (id, file) => {
      if (isAmbient || id == null || !file || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const title = titleFromFilename(file.name);
      setSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, url, title, priceInput: "", crop: null } : s))
      );
    },
    [isAmbient]
  );

  // Cycles a piece's own preview crop -- natural -> square -> portrait ->
  // natural. A tap-to-cycle instead of a menu, since there are only three
  // options and this is meant to be as unobtrusive as possible (see the
  // crop toggle button below, which only shows while this specific card
  // is actively being edited).
  function cycleCrop(id) {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const idx = CROP_CYCLE.indexOf(s.crop ?? null);
        const next = CROP_CYCLE[(idx + 1) % CROP_CYCLE.length];
        return { ...s, crop: next };
      })
    );
  }

  // Editable title/price, typed right on the card -- see titleFromFilename
  // above for why title starts pre-filled from the dropped file's own
  // name while price starts blank for the visitor to set themselves.
  function updateSlotField(id, field, value) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }


  function handlePhoneDrop(e) {
    if (isAmbient) return;
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const target = slots.find((s) => !s.url);
    if (target) fillSlot(target.id, file);
  }

  function handleSlotDrop(id, e) {
    if (isAmbient) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    fillSlot(id, e.dataTransfer.files?.[0]);
  }

  // Same single-click-delay-vs-double-click pattern as the real
  // ProductCard: a lone click opens the lightbox, but if a second click
  // lands within the window it's a double-click and buys instead.
  function handleSlotClick(slot) {
    if (isAmbient) return;
    if (!slot.url) {
      pendingIdRef.current = slot.id;
      fileInputRef.current?.click();
      return;
    }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setExpandedId(slot.id);
    }, 250);
  }

  function handleSlotDoubleClick(slot, e) {
    if (isAmbient) return;
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (!slot.url) return;
    setBuyHint(true);
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (file && pendingIdRef.current != null) fillSlot(pendingIdRef.current, file);
    e.target.value = "";
  }

  function handleShuffle() {
    if (isAmbient) return;
    setSlots((prev) => shuffleArray(prev));
  }

  function handleClear() {
    if (isAmbient) return;
    slots.forEach((s) => s.url && URL.revokeObjectURL(s.url));
    setSlots(emptySlots(slotCount));
    setExpandedId(null);
    setBuyHint(false);
    setActiveId(null);
  }

  const expandedSlot = !isAmbient && expandedId != null ? slots.find((s) => s.id === expandedId) : null;
  // The interactive demo's floating shuffle/buy chrome should read as
  // "always active" the same as the real storefront, not just appear
  // once a photo's been dropped in -- an empty phone with no floating
  // widgets at all looks broken/unfinished rather than like a real shop
  // waiting for content. The ambient loop keeps its original hasAny-gated
  // behavior (nothing floats until it actually drops a photo in).
  const showChrome = !isAmbient || hasAny;
  const activeSlot =
    slots.find((s) => s.id === activeId && s.url) ||
    filled[filled.length - 1] ||
    (!isAmbient ? { id: -1, url: null, title: DEMO_TITLES[0] } : null);

  return (
    <div className={`tryit-wrap${isAmbient ? " tryit-wrap-ambient" : ""}`} aria-hidden={isAmbient || undefined}>
      <div
        className={`tryit-phone${isAmbient ? " tryit-phone-ambient" : ""}`}
        onDragOver={(e) => !isAmbient && e.preventDefault()}
        onDrop={handlePhoneDrop}
      >
        <div className="tryit-notch" />
        {!isAmbient && !hasAny && (
          <>
            <p className="tryit-floating-hint tryit-hint-drag">
              drag &amp; drop / tap &amp; upload any image to preview
            </p>
            <p className="tryit-floating-hint tryit-hint-tap">
              tap &amp; upload any image to preview
            </p>
          </>
        )}

        <div
          className="tryit-screen"
          ref={screenRef}
          style={
            !isAmbient
              ? { background: themeBg, color: themeInk, "--bg": themeBg, "--ink": themeInk }
              : undefined
          }
        >
          <div className="feed tryit-feed">
            {slots.map((slot) => (
              <div
                className="card"
                key={slot.id}
                ref={(el) => {
                  cardRefs.current[slot.id] = el;
                }}
                data-slot-id={slot.id}
                onMouseEnter={() => !isAmbient && setHoverId(slot.id)}
                onMouseLeave={() => setHoverId((cur) => (cur === slot.id ? null : cur))}
              >
                <div
                  className={`tenant-card-media${
                    dragOverId === slot.id ? " tryit-card-dragover" : ""
                  }`}
                  onClick={() => handleSlotClick(slot)}
                  onDoubleClick={(e) => handleSlotDoubleClick(slot, e)}
                  onDragOver={(e) => {
                    if (isAmbient) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverId(slot.id);
                  }}
                  onDragLeave={() => setDragOverId((d) => (d === slot.id ? null : d))}
                  onDrop={(e) => handleSlotDrop(slot.id, e)}
                >
                  <span className="card-kind">photo</span>
                  {slot.url ? (
                    <img
                      src={slot.url}
                      alt=""
                      style={
                        slot.crop === "square"
                          ? { aspectRatio: "1 / 1", objectFit: "cover" }
                          : slot.crop === "portrait"
                          ? { aspectRatio: "4 / 5", objectFit: "cover" }
                          : undefined
                      }
                    />
                  ) : (
                    <div className="tenant-card-media-empty tryit-card-empty" aria-hidden="true">
                      {!isAmbient && <span className="tryit-card-plus">+</span>}
                    </div>
                  )}
                  {slot.url && (
                    <button
                      type="button"
                      className="expand-hint-wrap"
                      aria-label="View full image"
                      tabIndex={isAmbient ? -1 : 0}
                      onClick={(e) => {
                        if (isAmbient) return;
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        setExpandedId(slot.id);
                      }}
                    >
                      <span className="expand-hint" aria-hidden="true" />
                      <span className="expand-label">expand</span>
                    </button>
                  )}
                  {/* Crop toggle -- only while this specific card is being
                      edited (title/price focused), never a permanent
                      fixture on the card. One tap cycles natural -> square
                      -> portrait -> natural; the photo's own shape
                      changing is the feedback, no label needed. Preview
                      only -- never touches the full-res file a buyer
                      downloads, and "expand" always shows the real,
                      uncropped preview regardless of this setting. */}
                  {!isAmbient && slot.url && (hoverId === slot.id || focusId === slot.id) && (
                    <button
                      type="button"
                      className="tryit-crop-toggle"
                      aria-label="Change photo crop"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleCrop(slot.id);
                      }}
                    >
                      ⋯
                    </button>
                  )}
                </div>
                {slot.url && (
                  <div className="card-body">
                    <div className="card-row">
                      {/* Editable title/price only on the real interactive
                          demo -- the passive ambient loop (isAmbient) resets
                          its own slots on a timer, so it must stay
                          non-interactive plain text like a real card,
                          never an <input>, or anything typed into it would
                          get wiped out a couple seconds later by the loop. */}
                      {isAmbient ? (
                        <>
                          <p className="card-title">{slot.title}</p>
                          <div className="card-price-col">
                            <p className="card-price">{formatPrice(DEMO_PRICE_CENTS)}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            className="card-title tryit-title-input"
                            ref={(el) => {
                              titleInputRefs.current[slot.id] = el;
                            }}
                            value={slot.title ?? ""}
                            onChange={(e) => updateSlotField(slot.id, "title", e.target.value)}
                            onFocus={() => setFocusId(slot.id)}
                            onBlur={() => setFocusId((cur) => (cur === slot.id ? null : cur))}
                            placeholder="Add a title"
                            maxLength={60}
                            aria-label="Title"
                          />
                          <div className="card-price-col">
                            <input
                              className="card-price tryit-price-input"
                              type="text"
                              value={slot.priceInput ?? ""}
                              onChange={(e) => updateSlotField(slot.id, "priceInput", e.target.value)}
                              onFocus={() => setFocusId(slot.id)}
                              onBlur={() => setFocusId((cur) => (cur === slot.id ? null : cur))}
                              placeholder={formatPrice(DEMO_PRICE_CENTS)}
                              aria-label="Price"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {hasAny && !isAmbient && <p className="loading-more">keep scrolling — it reshuffles</p>}
        </div>

        {showChrome && (
          <button
            type="button"
            className="floating-shuffle"
            onClick={handleShuffle}
            aria-label="Shuffle the feed"
            tabIndex={isAmbient ? -1 : 0}
          >
            ✦ shuffle
          </button>
        )}

        {showChrome && activeSlot && (
          <div
            className="floating-buy-wrap tryit-floating-buy"
            onClick={() => !isAmbient && setBuyHint(true)}
            role="button"
            tabIndex={isAmbient ? -1 : 0}
          >
            <p className="floating-buy-title">
              <span className="floating-buy-title-text">{activeSlot.title || "Untitled"}</span>
              <span className="tap-pay-chip">✦ tap &amp; pay</span>
            </p>
          </div>
        )}

        {hasAny && !isAmbient && (
          <button type="button" className="tryit-clear" onClick={handleClear}>
            clear
          </button>
        )}

        {!isAmbient && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChosen}
          />
        )}
      </div>

      {/* Below the copy area and right under the phone, not above it --
          this sits below both the "Try it before you buy it" text block
          and the phone itself, close to the phone's own bottom edge. */}
      {!isAmbient && (
        <div className="tryit-theme-row">
          <span className="tryit-theme-label">try your colors too</span>
          <div className="tryit-theme-swatches">
            <div className="tryit-swatch-col">
              <label className="tryit-swatch tryit-swatch-bg" style={{ background: themeBg }}>
                <input
                  type="color"
                  value={themeBg}
                  onChange={(e) => setThemeBg(e.target.value)}
                  aria-label="Preview background color"
                />
              </label>
              <span className="tryit-swatch-caption">change background</span>
            </div>
            <div className="tryit-swatch-col">
              <label className="tryit-swatch tryit-swatch-ink">
                <span className="tryit-swatch-ink-lines">
                  <span style={{ background: themeInk }} />
                  <span style={{ background: themeInk }} />
                  <span style={{ background: themeInk }} />
                </span>
                <input
                  type="color"
                  value={themeInk}
                  onChange={(e) => setThemeInk(e.target.value)}
                  aria-label="Preview text color"
                />
              </label>
              <span className="tryit-swatch-caption">change text</span>
            </div>
            {(themeBg !== DEFAULT_THEME_BG || themeInk !== DEFAULT_THEME_INK) && (
              <button
                type="button"
                className="tryit-theme-reset"
                onClick={() => {
                  setThemeBg(DEFAULT_THEME_BG);
                  setThemeInk(DEFAULT_THEME_INK);
                }}
              >
                reset
              </button>
            )}
          </div>
        </div>
      )}

      {expandedSlot && (
        <div className="lightbox-overlay" onClick={() => setExpandedId(null)}>
          <button
            className="lightbox-close"
            type="button"
            onClick={() => setExpandedId(null)}
            aria-label="Close full view"
          >
            ✕
          </button>
          <img className="tenant-lightbox-img" src={expandedSlot.url} alt="" />
          <div className="lightbox-buy" onClick={(e) => e.stopPropagation()}>
            <p className="lightbox-title">
              {expandedSlot.title || "Untitled"} · {formatPrice(priceCentsFor(expandedSlot))}
              <span className="tap-pay-chip">✦ tap &amp; pay</span>
            </p>
            <button type="button" className="quick-card-btn" onClick={() => setBuyHint(true)}>
              pay with card — {formatPrice(priceCentsFor(expandedSlot))}
            </button>
          </div>
          <p className="lightbox-hint">tap the image to go back</p>
        </div>
      )}

      {buyHint && !isAmbient && (
        <div className="tryit-buy-hint" onClick={() => setBuyHint(false)}>
          <div className="tryit-buy-hint-card" onClick={(e) => e.stopPropagation()}>
            <p>Like what you feel?</p>
            <a href="/login">Create your shop</a>
          </div>
        </div>
      )}
    </div>
  );
}
