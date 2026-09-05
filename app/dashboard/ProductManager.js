"use client";

import { useEffect, useRef, useState } from "react";

const TYPE_LABELS = {
  digital_image: "Digital image",
  digital_audio: "Digital audio",
  physical: "Physical item",
  video: "Video",
};

// The three types that don't fit the top dropzone's "just drop photos"
// model -- shown as their own small cards with a one-line caption so a
// first-time artist isn't left guessing what each type means before
// picking one (same instinct as CreateShopForm's selling-mode cards).
const OTHER_TYPES = [
  { value: "digital_audio", label: "Digital audio", caption: "A track with a short preview clip" },
  { value: "physical", label: "Physical item", caption: "A shipped piece — sizes & shipping cost" },
  { value: "video", label: "Video", caption: "Free to watch, with an optional donate button" },
];

// Uploads a file for one product (full-res / preview image / preview
// clip / video, whatever `kind` fits the product's type): gets a
// presigned URL, PUTs the file straight to R2, then tells the platform
// which R2 key belongs to this product. Same flow for every type --
// only which `kind`s a given type shows in the UI changes.
async function uploadProductFile({ productId, kind, file }) {
  const presignRes = await fetch("/api/dashboard/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, kind, filename: file.name, contentType: file.type }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || "Could not start upload.");

  const putRes = await fetch(presignData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed.");

  const recordRes = await fetch(`/api/dashboard/products/${productId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, key: presignData.key, contentType: file.type }),
  });
  const recordData = await recordRes.json();
  if (!recordRes.ok) throw new Error(recordData.error || "Could not save file record.");
}

// Which upload fields a product needs, purely a function of its type.
// The first entry for each type is its "primary" file -- the one shown
// as the card's own photo/video, tappable/droppable right on the media
// itself rather than as a separate field further down.
function fileFieldsFor(type) {
  if (type === "digital_audio") {
    return [
      { kind: "preview_image", label: "Cover image (what customers see in the feed)" },
      { kind: "full", label: "Full audio file (what the customer downloads)" },
      { kind: "preview_clip", label: "Preview clip (what customers hear before buying)" },
    ];
  }
  if (type === "physical") {
    return [{ kind: "preview_image", label: "Photo (what customers see in the feed)" }];
  }
  if (type === "video") {
    // Free to watch, so there's no gated "full" file separate from a
    // preview -- the uploaded file itself IS what plays in the feed,
    // same as TryItDemo.js's donate-card slot. Short-form only for now.
    return [{ kind: "video", label: "Short video clip (what customers watch — free, no purchase needed)" }];
  }
  // digital_image, and the fallback for anything unrecognized
  return [
    { kind: "preview_image", label: "Preview image (what the customer sees online)" },
    { kind: "full", label: "Full-res file (what the customer downloads)" },
  ];
}

function primaryKindFor(type) {
  return type === "video" ? "video" : "preview_image";
}

// Turns a "title (no extension), title-case" filename into a starter
// product title -- e.g. "sunset-over-the-bay.tiff" -> "Sunset Over The
// Bay". Just a starting point; the artist can change it any time.
function titleFromFilename(filename) {
  const base = filename.replace(/\.[^./\\]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function baseNameKey(filename) {
  return filename.replace(/\.[^./\\]+$/, "").toLowerCase();
}

// Groups a batch of dropped files into one product per shared filename
// (before the extension) -- e.g. sunset.tiff + sunset.jpg become one
// product's full-res file and preview. No matching file dropped at all
// just means that product starts with a full-res file and no preview
// yet -- nothing is auto-generated here. When more than one candidate
// shares a name, the larger file is assumed to be the full-res original
// and the smaller one its preview -- true for every real case here (a
// TIFF/RAW original is always far bigger than a compressed preview).
function groupDroppedFiles(fileList) {
  const groups = new Map();
  Array.from(fileList).forEach((file) => {
    const key = baseNameKey(file.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  });
  return Array.from(groups.entries()).map(([key, files]) => {
    const sorted = [...files].sort((a, b) => b.size - a.size);
    return {
      key: `${key}-${Date.now()}-${Math.random()}`,
      title: titleFromFilename(sorted[0].name),
      full: sorted[0],
      previewImage: sorted.length > 1 ? sorted[1] : null,
    };
  });
}

// One product, rendered as a real feed card -- same classes
// (.card/.tenant-card-media/.card-body/.card-row/.card-title/.card-price)
// StorefrontFeed.js uses for the real storefront, so this IS what it'll
// look like live, not a preview of it. Title, price, description, and
// the photo/video itself are all directly click-in-and-type editable
// right here -- no separate "open this card to edit it" step. Anything
// that isn't part of how the piece looks (the gated full-res file,
// shipping, removing it) sits behind a small "more" toggle so the card
// itself doesn't turn into an admin form.
function ProductCard({ product, tenantSlug, payoutsActive, onChanged, onRemoved }) {
  const [title, setTitle] = useState(product.title || "");
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.price_cents ? (product.price_cents / 100).toFixed(2) : "");
  const [sizes, setSizes] = useState(
    Array.isArray(product.details?.sizes) ? product.details.sizes.join(", ") : ""
  );
  const [shipping, setShipping] = useState(
    product.details?.shipping_cents ? (product.details.shipping_cents / 100).toFixed(2) : ""
  );
  const [crop, setCrop] = useState(product.details?.crop || "natural");
  const [donateEnabled, setDonateEnabled] = useState(Boolean(product.details?.donate_enabled));
  const [donateSuggested, setDonateSuggested] = useState(
    product.details?.donate_suggested_cents
      ? (product.details.donate_suggested_cents / 100).toFixed(2)
      : "12.00"
  );
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryInputRef = useRef(null);

  const CROP_ORDER = ["natural", "square", "portrait"];
  const primaryKind = primaryKindFor(product.type);
  const files = product.files || {};
  const hasPrimary = Boolean(files[primaryKind]);
  const secondaryFields = fileFieldsFor(product.type).filter((f) => f.kind !== primaryKind);
  const previewIsGenerated = Boolean(product.details?.preview_generated);
  const canGeneratePreview = product.type === "digital_image" && Boolean(files.full) && !files.preview_image;
  const busy = status === "saving" || status === "removing";

  async function handleFile(kind, file) {
    if (!file) return;
    setStatus(`uploading-${kind}`);
    setError("");
    try {
      await uploadProductFile({ productId: product.id, kind, file });
      setStatus("done");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  // Opt-in only -- this button only appears once there's a full-res file
  // with no preview yet, and nothing calls it automatically (a
  // machine-generated preview isn't guaranteed to look as good as one
  // exported by hand -- see the plan's open verification item).
  async function handleGeneratePreview() {
    setStatus("generating");
    setError("");
    try {
      const res = await fetch(`/api/dashboard/products/${product.id}/generate-preview`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate a preview.");
      setStatus("done");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  // Every field saves itself on blur/change -- there's no separate
  // "Save" step. `overrides` lets a caller (the crop toggle, the donate
  // checkbox, publish/unpublish) supply a value that hasn't finished
  // landing in state yet, rather than reading a stale closure.
  async function persist(overrides = {}) {
    setStatus("saving");
    setError("");
    const eff = {
      title, description, price, crop, sizes, shipping,
      donateEnabled, donateSuggested, active: product.active,
      ...overrides,
    };
    try {
      const priceInt = Math.round(Number.parseFloat(eff.price || "0") * 100);
      const body = {
        title: eff.title,
        description: eff.description,
        priceCents: Number.isFinite(priceInt) ? priceInt : 0,
        active: eff.active,
        crop: eff.crop === "natural" ? null : eff.crop,
        ...(product.type === "physical"
          ? { sizes: eff.sizes, shippingCents: Math.round(Number.parseFloat(eff.shipping || "0") * 100) }
          : {}),
        ...(product.type === "video"
          ? {
              donateEnabled: eff.donateEnabled,
              donateSuggestedCents: Math.round(Number.parseFloat(eff.donateSuggested || "0") * 100),
            }
          : {}),
      };
      const res = await fetch(`/api/dashboard/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setStatus("saved");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  function cycleCrop() {
    const next = CROP_ORDER[(CROP_ORDER.indexOf(crop) + 1) % CROP_ORDER.length];
    setCrop(next);
    persist({ crop: next });
  }

  async function remove() {
    if (status === "removing") return;
    setStatus("removing");
    setError("");
    try {
      const res = await fetch(`/api/dashboard/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove.");
      onRemoved?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  const mediaEmptyClass = "tenant-card-media-empty tryit-card-empty" + (mediaDragOver ? " tryit-card-dragover" : "");

  return (
    <div className="card">
      <div
        className="tenant-card-media dash-card-media"
        style={product.type === "video" ? { aspectRatio: "auto" } : undefined}
        onClick={() => primaryInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setMediaDragOver(true); }}
        onDragLeave={() => setMediaDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMediaDragOver(false);
          handleFile(primaryKind, e.dataTransfer.files?.[0]);
        }}
      >
        <span className="card-kind">{TYPE_LABELS[product.type] || product.type}</span>
        {!product.active && <span className="dash-draft-badge">Draft</span>}
        <input
          ref={primaryInputRef}
          type="file"
          accept={product.type === "video" ? "video/*" : "image/*"}
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(primaryKind, e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {hasPrimary ? (
          product.type === "video" ? (
            <video
              src={`/api/preview?productId=${product.id}&kind=video`}
              controls
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={`/api/preview?productId=${product.id}&kind=preview_image`}
              alt={product.title || ""}
              style={crop === "natural" ? { objectFit: "contain" } : undefined}
            />
          )
        ) : (
          <div className={mediaEmptyClass} aria-hidden="true">
            <span className="tryit-card-plus">+</span>
          </div>
        )}
        {/* Crop toggle (photos) / replace button (video) -- the two never
            coexist on the same card, so they safely share one slot
            (bottom-right, since top-right is the draft badge). */}
        {hasPrimary && product.type !== "video" && (
          <button
            type="button"
            className="dash-crop-toggle"
            aria-label="Change photo crop"
            onClick={(e) => { e.stopPropagation(); cycleCrop(); }}
          >
            ⋯
          </button>
        )}
        {hasPrimary && product.type === "video" && (
          <button
            type="button"
            className="dash-crop-toggle"
            aria-label="Replace video"
            onClick={(e) => { e.stopPropagation(); primaryInputRef.current?.click(); }}
          >
            ⟳
          </button>
        )}
      </div>

      <div className="card-body">
        <div className="card-row">
          <input
            className="card-title tryit-title-input"
            placeholder="Untitled — name this piece"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => persist()}
          />
          {product.type === "video" ? (
            <span className="card-price">Free to watch</span>
          ) : (
            <input
              className="card-price tryit-price-input"
              placeholder="$0.00"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => persist()}
            />
          )}
        </div>

        <input
          className="dash-desc-input"
          placeholder="add a short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => persist()}
        />

        {product.type === "video" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={donateEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDonateEnabled(v);
                  persist({ donateEnabled: v });
                }}
              />
              Let viewers donate
            </label>
            {donateEnabled && (
              <input
                className="dash-input"
                placeholder="Suggested donation (e.g. 12.00)"
                inputMode="decimal"
                value={donateSuggested}
                onChange={(e) => setDonateSuggested(e.target.value)}
                onBlur={() => persist()}
                style={{ maxWidth: 220 }}
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => persist({ active: !product.active })}
          disabled={busy}
          style={{
            alignSelf: "flex-start",
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            border: "1px solid var(--card-line)",
            background: product.active ? "rgba(120, 200, 150, 0.12)" : "transparent",
            color: product.active ? "var(--success)" : "var(--ink-dim)",
            fontSize: "0.78rem",
            cursor: "pointer",
            marginTop: "0.65rem",
            display: "inline-block",
          }}
        >
          {product.active ? "● Live — tap to unpublish" : "○ Draft — tap to publish"}
        </button>

        {!payoutsActive && (
          <p className="dash-payouts-nag" style={{ marginTop: "0.5rem" }}>
            Buyers can&apos;t check out yet — connect payouts in Shop settings below to get paid.
          </p>
        )}

        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-dim)",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "0.78rem",
              padding: 0,
            }}
          >
            {moreOpen ? "hide details" : "⋯ more (files, shipping, remove)"}
          </button>
        </div>

        {moreOpen && (
          <div className="dash-card-expand">
            {product.type === "physical" && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  className="dash-input"
                  placeholder="Sizes (optional, e.g. S, M, L)"
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                  onBlur={() => persist()}
                  style={{ flex: "1 1 160px" }}
                />
                <input
                  className="dash-input"
                  placeholder="Shipping cost (e.g. 6.00)"
                  inputMode="decimal"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  onBlur={() => persist()}
                  style={{ flex: "1 1 140px" }}
                />
              </div>
            )}

            {secondaryFields.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {secondaryFields.map((f) => (
                  <label key={f.kind} className="dash-dropzone">
                    {f.label} — {files[f.kind] ? "✓ uploaded, tap to replace" : "tap or drop a file here"}
                    <input
                      type="file"
                      style={{ display: "block", marginTop: "0.25rem" }}
                      onChange={(e) => handleFile(f.kind, e.target.files?.[0])}
                    />
                  </label>
                ))}
                {canGeneratePreview && (
                  <button
                    type="button"
                    className="dash-type-btn"
                    onClick={handleGeneratePreview}
                    disabled={status === "generating"}
                  >
                    {status === "generating" ? "Generating…" : "Generate preview from full-res file"}
                  </button>
                )}
              </div>
            )}
            {product.type === "digital_image" && files.preview_image && (
              <p style={{ color: "var(--ink-dim)", fontSize: "0.78rem", margin: 0 }}>
                Preview: {previewIsGenerated ? "generated from your full-res file" : "your own file"}
              </p>
            )}
            {product.type !== "video" && (
              <p style={{ color: "var(--ink-dim)", fontSize: "0.78rem", margin: 0 }}>
                Photo crop: {crop === "natural" ? "natural (no crop)" : crop} — tap the ⋯ on the photo above to change it.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {product.active && tenantSlug && (
                <a className="dash-btn dash-btn-secondary" href={`/sites/${tenantSlug}`} target="_blank" rel="noreferrer">
                  View in your live feed ↗
                </a>
              )}
              <button type="button" className="dash-btn dash-btn-danger" onClick={remove} disabled={busy}>
                {status === "removing" ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        )}

        {status.startsWith("uploading") && (
          <p style={{ color: "var(--ink-dim)", fontSize: "0.8rem", marginTop: "0.4rem" }}>Uploading…</p>
        )}
        {error && <p style={{ color: "#e08a8a", fontSize: "0.85rem", marginTop: "0.4rem" }}>{error}</p>}
      </div>
    </div>
  );
}

export default function ProductManager({ tenant }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("feed");
  const [dragOver, setDragOver] = useState(false);
  const [banner, setBanner] = useState("");
  const cardRefs = useRef({});
  const payoutsActive = tenant?.stripe_connect_status === "active";

  async function loadProducts() {
    const res = await fetch("/api/dashboard/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function scrollToCard(id) {
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Immediate create-on-drop: every group of dropped files is saved as a
  // real draft product (active:false) right away, with its file(s)
  // uploaded immediately too -- not held in local/browser-only state, so
  // dropping a batch, finishing only a few, and closing the tab leaves
  // the rest sitting here as drafts next time, not lost.
  async function createDraftFromGroup(group) {
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "digital_image", title: group.title, priceCents: 0, draft: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      const productId = data.product.id;
      // The primary/largest dropped file is always the real sellable
      // "full" file. If a smaller matched preview was dropped alongside
      // it, that becomes the feed photo; otherwise the same file doubles
      // as its own preview so the card shows something immediately
      // instead of an empty placeholder (an artist can always swap in a
      // distinct preview later).
      await uploadProductFile({ productId, kind: "full", file: group.full });
      await uploadProductFile({ productId, kind: "preview_image", file: group.previewImage || group.full });
      return productId;
    } catch (err) {
      setBanner(`Couldn't save ${group.full.name}: ${err.message}`);
      return null;
    }
  }

  async function addDroppedFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const groups = groupDroppedFiles(fileList);
    let lastId = null;
    for (const group of groups) {
      // Sequential on purpose -- these all PUT straight to R2; running a
      // big batch at once would just contend for the same upload bandwidth.
      // eslint-disable-next-line no-await-in-loop
      const id = await createDraftFromGroup(group);
      if (id) lastId = id;
    }
    setViewMode("feed");
    await loadProducts();
    if (lastId) scrollToCard(lastId);
  }

  // "+ type" cards: a blank draft of the chosen type, no files yet.
  async function addBlank(type) {
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: "", priceCents: 0, draft: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create product.");
      setViewMode("feed");
      await loadProducts();
      scrollToCard(data.product.id);
    } catch (err) {
      setBanner(err.message);
    }
  }

  const drafts = products.filter((p) => !p.active);
  const published = products.filter((p) => p.active);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Products</h2>
        {products.length > 1 && (
          <button
            type="button"
            onClick={() => setViewMode((v) => (v === "feed" ? "grid" : "feed"))}
            style={{
              background: "none",
              border: "1px solid var(--card-line)",
              borderRadius: 999,
              padding: "0.35rem 0.8rem",
              color: "var(--ink-dim)",
              fontSize: "0.8rem",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {viewMode === "feed" ? "▦ see all as thumbnails" : "▤ back to feed"}
          </button>
        )}
      </div>
      <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
        This is your shop — drop in photos below to add new pieces, then tap right on any photo,
        title, or price to change it. Changes save as you go.
      </p>

      <label
        className={"dash-main-dropzone" + (dragOver ? " dash-main-dropzone-active" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addDroppedFiles(e.dataTransfer.files);
        }}
      >
        Drag &amp; drop photos here, or tap to choose
        <input
          type="file"
          multiple
          accept="image/*"
          style={{ display: "block", marginTop: "0.5rem" }}
          onChange={(e) => {
            addDroppedFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
        {OTHER_TYPES.map((t) => (
          <button key={t.value} type="button" className="dash-type-chip" onClick={() => addBlank(t.value)}>
            <div className="dash-type-chip-title">+ {t.label}</div>
            <div className="dash-type-chip-caption">{t.caption}</div>
          </button>
        ))}
      </div>

      {banner && (
        <p style={{ color: "#e08a8a", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          {banner}{" "}
          <button
            type="button"
            onClick={() => setBanner("")}
            style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", textDecoration: "underline" }}
          >
            dismiss
          </button>
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--ink-dim)", marginTop: "1rem" }}>Loading…</p>
      ) : products.length === 0 ? (
        <p style={{ color: "var(--ink-dim)", marginTop: "1rem" }}>No pieces yet — drop in a few photos above to get started.</p>
      ) : viewMode === "grid" ? (
        <div className="dash-grid" style={{ marginTop: "1rem" }}>
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className="dash-grid-tile"
              aria-label={p.title || "Untitled piece"}
              onClick={() => {
                setViewMode("feed");
                scrollToCard(p.id);
              }}
            >
              {p.type === "video" && p.files?.video ? (
                <video src={`/api/preview?productId=${p.id}&kind=video`} muted playsInline preload="metadata" />
              ) : p.files?.preview_image ? (
                <img src={`/api/preview?productId=${p.id}&kind=preview_image`} alt="" />
              ) : null}
              <span className={"dash-grid-tile-dot" + (p.active ? " dash-grid-tile-dot-live" : "")} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="feed" style={{ padding: 0, marginTop: "1.25rem" }}>
          {drafts.length > 0 && (
            <p
              style={{
                color: "var(--ink-dim)",
                fontSize: "0.8rem",
                margin: "0 0 -0.35rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Drafts — not visible in your shop yet
            </p>
          )}
          {drafts.map((p) => (
            <div key={p.id} ref={(el) => { cardRefs.current[p.id] = el; }}>
              <ProductCard
                product={p}
                tenantSlug={tenant?.slug}
                payoutsActive={payoutsActive}
                onChanged={loadProducts}
                onRemoved={loadProducts}
              />
            </div>
          ))}
          {published.length > 0 && (
            <p
              style={{
                color: "var(--ink-dim)",
                fontSize: "0.8rem",
                margin: drafts.length > 0 ? "0.5rem 0 -0.35rem" : "0 0 -0.35rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Live in your shop
            </p>
          )}
          {published.map((p) => (
            <div key={p.id} ref={(el) => { cardRefs.current[p.id] = el; }}>
              <ProductCard
                product={p}
                tenantSlug={tenant?.slug}
                payoutsActive={payoutsActive}
                onChanged={loadProducts}
                onRemoved={loadProducts}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
