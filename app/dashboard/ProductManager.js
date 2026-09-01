"use client";

import { useEffect, useState } from "react";

const TYPE_LABELS = {
  digital_image: "Digital image",
  digital_audio: "Digital audio",
  physical: "Physical item",
};

function formatPrice(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

// Uploads a file for one product (full-res / preview image / preview
// clip, whatever `kind` fits the product's type): gets a presigned URL,
// PUTs the file straight to R2, then tells the platform which R2 key
// belongs to this product. Same flow for every type -- only which
// `kind`s a given type shows in the UI below changes.
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

// Which upload fields a product needs, purely a function of its type --
// a digital sale needs a gated full-res file, a physical item never does
// (nothing to download; the buyer gets a shipped object instead).
function fileFieldsFor(type) {
  if (type === "digital_audio") {
    return [
      { kind: "full", label: "Full audio file (what the customer downloads)" },
      { kind: "preview_clip", label: "Preview clip (what customers hear before buying)" },
      { kind: "preview_image", label: "Cover image (what customers see in the feed)" },
    ];
  }
  if (type === "physical") {
    return [{ kind: "preview_image", label: "Photo (what customers see in the feed)" }];
  }
  // digital_image, and the fallback for anything unrecognized
  return [
    { kind: "full", label: "Full-res file (what the customer downloads)" },
    { kind: "preview_image", label: "Preview image (what the customer sees online)" },
  ];
}

// Turns a "title (no extension), title-case" filename into a starter
// product title -- e.g. "sunset-over-the-bay.tiff" -> "Sunset Over The
// Bay". Just a starting point; the artist can change it any time in the
// card below.
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
// just means that product starts with a full-res file and no preview yet
// (addable later through the per-product dropzone in its own card, same
// as any other product) -- nothing is auto-generated here. When more
// than one candidate shares a name, the larger file is assumed to be the
// full-res original and the smaller one its preview -- true for every
// real case here (a TIFF/RAW original is always far bigger than a
// compressed preview).
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

// One product's row -- styled like the real feed card it'll become
// (.card / .tenant-card-media / .card-kind / .card-body / .card-row /
// .card-title / .card-price-col / .card-price, all from globals.css,
// shared verbatim with app/sites/[tenant]/StorefrontFeed.js) so an
// artist sees roughly what a shopper will see, not an admin form.
// Collapsed by default -- tap the photo or title row to expand in place,
// no page navigation, ever (per the "someone should easily do this on
// their phone" requirement).
function ProductCard({ product, expanded, onToggle, onChanged, tenantSlug }) {
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
  const CROP_ORDER = ["natural", "square", "portrait"];
  function cycleCrop() {
    setCrop((c) => CROP_ORDER[(CROP_ORDER.indexOf(c) + 1) % CROP_ORDER.length]);
  }
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [dragOverKind, setDragOverKind] = useState(null);

  // Only re-sync local edit fields from the server copy while this card
  // is collapsed -- once someone's actively editing an open card, a
  // background reload (from another card's onChanged) shouldn't wipe out
  // what they're mid-typing.
  useEffect(() => {
    if (expanded) return;
    setTitle(product.title || "");
    setDescription(product.description || "");
    setPrice(product.price_cents ? (product.price_cents / 100).toFixed(2) : "");
    setSizes(Array.isArray(product.details?.sizes) ? product.details.sizes.join(", ") : "");
    setShipping(product.details?.shipping_cents ? (product.details.shipping_cents / 100).toFixed(2) : "");
    setCrop(product.details?.crop || "natural");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, expanded]);

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

  function handleDrop(kind, e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKind(null);
    handleFile(kind, e.dataTransfer.files?.[0]);
  }

  // Opt-in only -- this button only appears once there's a full-res file
  // with no preview yet, and nothing calls it automatically (a
  // machine-generated preview isn't guaranteed to look as good as one
  // exported by hand -- see the plan's open verification item).
  async function handleGeneratePreview() {
    setStatus("generating");
    setError("");
    try {
      const res = await fetch(`/api/dashboard/products/${product.id}/generate-preview`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate a preview.");
      setStatus("done");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  async function save({ active }) {
    setStatus(active ? "publishing" : "saving");
    setError("");
    try {
      const priceInt = Math.round(Number.parseFloat(price || "0") * 100);
      const body = {
        title,
        description,
        priceCents: Number.isFinite(priceInt) ? priceInt : 0,
        active,
        crop: crop === "natural" ? null : crop,
        ...(product.type === "physical"
          ? { sizes, shippingCents: Math.round(Number.parseFloat(shipping || "0") * 100) }
          : {}),
      };
      const res = await fetch(`/api/dashboard/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setStatus("done");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  async function remove() {
    if (status === "removing") return;
    setStatus("removing");
    setError("");
    try {
      const res = await fetch(`/api/dashboard/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove.");
      onChanged?.();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  const fields = fileFieldsFor(product.type);
  const files = product.files || {};
  const hasFull = Boolean(files.full);
  const hasPreview = Boolean(files.preview_image);
  const previewIsGenerated = Boolean(product.details?.preview_generated);
  // Only worth offering for types whose preview_image is meant to come
  // FROM the full-res file (a digital image is its own preview source) --
  // physical/audio's cover photo is a separate shot, not a derivative of
  // the gated file.
  const canGeneratePreview = product.type === "digital_image" && hasFull && !hasPreview;
  const busy = status === "saving" || status === "publishing" || status === "removing";
  const displayTitle = product.title || "Untitled — tap to finish";
  const displayPrice = product.price_cents > 0 ? formatPrice(product.price_cents) : "no price yet";

  return (
    <div className="card">
      <div className="tenant-card-media dash-card-media" onClick={onToggle}>
        <span className="card-kind">{TYPE_LABELS[product.type] || product.type}</span>
        {!product.active && <span className="dash-draft-badge">Draft</span>}
        {hasPreview ? (
          <img
            src={`/api/preview?productId=${product.id}&kind=preview_image`}
            alt={product.title || ""}
            style={crop === "natural" ? { objectFit: "contain" } : undefined}
          />
        ) : (
          <div className="tenant-card-media-empty" aria-hidden="true" />
        )}
        {/* Crop toggle -- only while this card is open for editing, never
            a permanent fixture on the feed view. One tap cycles
            natural -> square -> portrait -> natural; saved along with
            everything else when "Save changes"/"Publish" is tapped below.
            Preview-only, same as the try-it demo's own crop toggle --
            never touches the full-res file a buyer downloads. */}
        {expanded && hasPreview && (
          <button
            type="button"
            className="tryit-crop-toggle dash-crop-toggle"
            aria-label="Change photo crop"
            onClick={(e) => {
              e.stopPropagation();
              cycleCrop();
            }}
          >
            ⋯
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="card-row dash-card-header" onClick={onToggle}>
          <p className={"card-title dash-card-title" + (!product.title ? " dash-card-title-empty" : "")}>
            {displayTitle}
          </p>
          <div className="card-price-col" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p className="card-price">{displayPrice}</p>
            <span className="dash-chevron" aria-hidden="true">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {expanded && (
          <div className="dash-card-expand">
            <input
              className="dash-input"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className="dash-input"
              placeholder="Price in dollars (e.g. 25.00)"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            {product.type === "physical" && (
              <>
                <input
                  className="dash-input"
                  placeholder="Sizes, comma separated (optional, e.g. S, M, L)"
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
                <input
                  className="dash-input"
                  placeholder="Shipping cost in dollars (e.g. 6.00)"
                  inputMode="decimal"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
              </>
            )}

            {hasPreview && (
              <p style={{ color: "var(--ink-dim)", fontSize: "0.8rem", margin: 0 }}>
                Photo crop: {crop === "natural" ? "natural (no crop)" : crop} — tap the ⋯ on the
                photo above to change it.
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {fields.map((f) => (
                <label
                  key={f.kind}
                  className={"dash-dropzone" + (dragOverKind === f.kind ? " dash-dropzone-active" : "")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKind(f.kind);
                  }}
                  onDragLeave={() => setDragOverKind((k) => (k === f.kind ? null : k))}
                  onDrop={(e) => handleDrop(f.kind, e)}
                >
                  {f.label} — {files[f.kind] ? "✓ uploaded, tap to replace" : "tap or drop a file here"}
                  <input type="file" style={{ display: "block", marginTop: "0.25rem" }} onChange={(e) => handleFile(f.kind, e.target.files?.[0])} />
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
            {product.type === "digital_image" && hasPreview && (
              <p style={{ color: "var(--ink-dim)", fontSize: "0.8rem", margin: 0 }}>
                Preview: {previewIsGenerated ? "generated from your full-res file" : "your own file"}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              {product.active ? (
                <>
                  <button type="button" className="dash-btn" onClick={() => save({ active: true })} disabled={busy}>
                    {status === "publishing" ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="dash-btn dash-btn-secondary"
                    onClick={() => save({ active: false })}
                    disabled={busy}
                  >
                    {status === "saving" ? "Saving…" : "Unpublish"}
                  </button>
                  {tenantSlug && (
                    <a
                      className="dash-btn dash-btn-secondary"
                      href={`/sites/${tenantSlug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View in your live feed ↗
                    </a>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="dash-btn dash-btn-secondary"
                    onClick={() => save({ active: false })}
                    disabled={busy}
                  >
                    {status === "saving" ? "Saving…" : "Save draft"}
                  </button>
                  <button type="button" className="dash-btn" onClick={() => save({ active: true })} disabled={busy}>
                    {status === "publishing" ? "Publishing…" : "Publish to shop"}
                  </button>
                </>
              )}
              <button type="button" className="dash-btn dash-btn-danger" onClick={remove} disabled={busy}>
                {status === "removing" ? "Removing…" : "Remove"}
              </button>
            </div>
            {status.startsWith("uploading") && <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>Uploading…</p>}
            {error && <p style={{ color: "#e08a8a", fontSize: "0.85rem" }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductManager({ tenant }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [dragOver, setDragOver] = useState(false);
  const [banner, setBanner] = useState("");

  async function loadProducts() {
    const res = await fetch("/api/dashboard/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function toggle(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expand(id) {
    setExpandedIds((prev) => new Set(prev).add(id));
  }

  // Immediate create-on-drop: every group of dropped files is saved as a
  // real draft product (active:false) right away, with its file(s)
  // uploaded immediately too -- not held in local/browser-only state.
  // This is the actual fix for "it's awful to drop photos, have to put
  // down the phone, and have it all gone": dropping a batch, finishing
  // only a few, and closing the tab leaves the rest sitting here as
  // drafts next time, not lost.
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
      await uploadProductFile({ productId, kind: "full", file: group.full });
      if (group.previewImage) {
        await uploadProductFile({ productId, kind: "preview_image", file: group.previewImage });
      }
      expand(productId);
    } catch (err) {
      setBanner(`Couldn't save ${group.full.name}: ${err.message}`);
    }
  }

  async function addDroppedFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const groups = groupDroppedFiles(fileList);
    for (const group of groups) {
      // Sequential on purpose -- these all PUT straight to R2; running a
      // big batch at once would just contend for the same upload bandwidth.
      // eslint-disable-next-line no-await-in-loop
      await createDraftFromGroup(group);
    }
    loadProducts();
  }

  // "+ add" buttons: a blank draft of the chosen type, no files yet --
  // used for audio/physical (which don't fit the image-pairing dropzone
  // above), or to start an image product without dropping a file first.
  async function addBlank(type) {
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: "", priceCents: 0, draft: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create product.");
      await loadProducts();
      expand(data.product.id);
    } catch (err) {
      setBanner(err.message);
    }
  }

  const drafts = products.filter((p) => !p.active);
  const published = products.filter((p) => p.active);

  return (
    <div>
      <h2>Products</h2>
      <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>
        Drop in photos to start new pieces — they&apos;re saved right away as drafts, so it&apos;s
        safe to only finish some now and come back for the rest later. Tap any piece below to open
        it up, add a title and price, and publish it to your shop.
      </p>

      <label
        className={"dash-main-dropzone" + (dragOver ? " dash-main-dropzone-active" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addDroppedFiles(e.dataTransfer.files);
        }}
      >
        Drag &amp; drop image files here, or tap to choose
        <input
          type="file"
          multiple
          style={{ display: "block", marginTop: "0.5rem" }}
          onChange={(e) => {
            addDroppedFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        {Object.entries(TYPE_LABELS).map(([value, label]) => (
          <button key={value} type="button" className="dash-type-btn" onClick={() => addBlank(value)}>
            + {label}
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

      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {loading ? (
          <p style={{ color: "var(--ink-dim)" }}>Loading…</p>
        ) : products.length === 0 ? (
          <p style={{ color: "var(--ink-dim)" }}>No products yet — drop in a few photos above to get started.</p>
        ) : (
          <>
            {drafts.length > 0 && (
              <>
                <p
                  style={{
                    color: "var(--ink-dim)",
                    fontSize: "0.8rem",
                    margin: "0.5rem 0 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Drafts — not visible in your shop yet
                </p>
                {drafts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    expanded={expandedIds.has(p.id)}
                    onToggle={() => toggle(p.id)}
                    onChanged={loadProducts}
                    tenantSlug={tenant?.slug}
                  />
                ))}
              </>
            )}
            {published.length > 0 && (
              <>
                <p
                  style={{
                    color: "var(--ink-dim)",
                    fontSize: "0.8rem",
                    margin: "1rem 0 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Live in your shop
                </p>
                {published.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    expanded={expandedIds.has(p.id)}
                    onToggle={() => toggle(p.id)}
                    onChanged={loadProducts}
                    tenantSlug={tenant?.slug}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
