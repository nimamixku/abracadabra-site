"use client";

import { useEffect, useState } from "react";

const styles = {
  input: {
    width: "100%",
    padding: "0.65rem 0.9rem",
    borderRadius: 10,
    border: "1px solid var(--card-line)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: "0.95rem",
    marginTop: "0.5rem",
  },
  button: {
    padding: "0.6rem 1rem",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#1a0f24",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "0.75rem",
  },
  typeButton: (active) => ({
    padding: "0.5rem 0.9rem",
    borderRadius: 10,
    border: active ? "1px solid var(--accent)" : "1px solid var(--card-line)",
    background: active ? "var(--accent)" : "var(--bg)",
    color: active ? "#1a0f24" : "var(--ink)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.85rem",
  }),
  card: {
    background: "var(--card)",
    border: "1px solid var(--card-line)",
    borderRadius: 12,
    padding: "1rem",
    marginTop: "0.75rem",
  },
  dim: { color: "var(--ink-dim)", fontSize: "0.85rem" },
  dropzone: (active) => ({
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.6rem 0.75rem",
    borderRadius: 10,
    border: active ? "1px dashed var(--accent)" : "1px dashed var(--card-line)",
    background: active ? "rgba(160, 120, 255, 0.08)" : "transparent",
  }),
};

const TYPE_LABELS = {
  digital_image: "Digital image",
  digital_audio: "Digital audio",
  physical: "Physical item",
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
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

// Bulk add: turns a "title (no extension), title-case" filename into a
// starter product title -- e.g. "sunset-over-the-bay.tiff" -> "Sunset Over
// The Bay". Just a starting point; the review step below lets the artist
// change it before anything is actually created.
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
// (added later through the per-product drag-and-drop above, same as any
// other product) -- nothing is auto-generated, per the plan's "artist
// opts in, never a silent default" rule. When more than one candidate
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
      price: "",
      full: sorted[0],
      previewImage: sorted.length > 1 ? sorted[1] : null,
      status: "idle",
      error: "",
    };
  });
}

function BulkUpload({ onDone }) {
  const [pending, setPending] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setPending((prev) => [...prev, ...groupDroppedFiles(fileList)]);
  }

  function updateItem(key, patch) {
    setPending((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key) {
    setPending((prev) => prev.filter((item) => item.key !== key));
  }

  // One product, start to finish: create it (this is what needs a real
  // title and price -- both required by the API, same as the single-add
  // form), then attach whichever file(s) this group matched.
  async function addOne(item) {
    const priceInt = Math.round(Number.parseFloat(item.price || "0") * 100);
    if (!item.title.trim() || !Number.isFinite(priceInt) || priceInt <= 0) {
      updateItem(item.key, { status: "error", error: "Title and a price are both required." });
      return false;
    }
    updateItem(item.key, { status: "creating", error: "" });
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "digital_image", title: item.title.trim(), priceCents: priceInt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create product.");
      const productId = data.product.id;
      await uploadProductFile({ productId, kind: "full", file: item.full });
      if (item.previewImage) {
        await uploadProductFile({ productId, kind: "preview_image", file: item.previewImage });
      }
      removeItem(item.key);
      onDone();
      return true;
    } catch (err) {
      updateItem(item.key, { status: "error", error: err.message });
      return false;
    }
  }

  async function addAll() {
    const ready = pending.filter(
      (item) => item.title.trim() && Number.parseFloat(item.price || "0") > 0
    );
    for (const item of ready) {
      // Sequential on purpose -- these all PUT straight to R2, running
      // them at once would just contend for the same upload bandwidth.
      // eslint-disable-next-line no-await-in-loop
      await addOne(item);
    }
  }

  const allReady =
    pending.length > 0 &&
    pending.every((item) => item.title.trim() && Number.parseFloat(item.price || "0") > 0);

  return (
    <div style={{ ...styles.card, marginTop: "1rem" }}>
      <strong>Bulk add</strong>
      <p style={styles.dim}>
        Drop in as many files as you want at once — files sharing the same
        name before the extension (like <code>sunset.tiff</code> and{" "}
        <code>sunset.jpg</code>) are paired automatically into one
        product's full-res file and preview. Digital images only for now
        — audio and physical items still go through "Add product" below.
      </p>
      <label
        style={{
          ...styles.dropzone(dragOver),
          display: "block",
          padding: "1.25rem",
          textAlign: "center",
          cursor: "pointer",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        Drag &amp; drop files here, or click to choose
        <input
          type="file"
          multiple
          style={{ display: "block", marginTop: "0.5rem" }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {pending.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          {pending.map((item) => (
            <div key={item.key} style={{ ...styles.card, marginTop: "0.5rem" }}>
              <p style={styles.dim}>
                {item.full.name}
                {item.previewImage
                  ? ` + ${item.previewImage.name} (preview)`
                  : " — no matching preview found; add one after this is created"}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...styles.input, marginTop: 0, flex: "1 1 160px" }}
                  value={item.title}
                  onChange={(e) => updateItem(item.key, { title: e.target.value })}
                  placeholder="Title"
                />
                <input
                  style={{ ...styles.input, marginTop: 0, width: 120 }}
                  value={item.price}
                  onChange={(e) => updateItem(item.key, { price: e.target.value })}
                  placeholder="Price (e.g. 25.00)"
                  inputMode="decimal"
                />
                <button
                  type="button"
                  style={styles.button}
                  onClick={() => addOne(item)}
                  disabled={item.status === "creating"}
                >
                  {item.status === "creating" ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.button,
                    background: "transparent",
                    border: "1px solid var(--card-line)",
                    color: "var(--ink-dim)",
                  }}
                  onClick={() => removeItem(item.key)}
                >
                  Remove
                </button>
              </div>
              {item.error && <p style={{ color: "#e08a8a", fontSize: "0.85rem" }}>{item.error}</p>}
            </div>
          ))}
          <button type="button" style={styles.button} onClick={addAll} disabled={!allReady}>
            Add all {pending.length} at once
          </button>
          {!allReady && (
            <p style={styles.dim}>Give every piece above a title and a price to enable "Add all."</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [dragOverKind, setDragOverKind] = useState(null);

  // Shared by both entry points -- a normal <input type="file"> click/
  // browse, and a file dragged straight onto the same field. Same
  // upload, same validation, same status/error handling either way; the
  // only difference is where the File object came from.
  async function handleFile(kind, file) {
    if (!file) return;
    setStatus(`uploading-${kind}`);
    setError("");
    try {
      await uploadProductFile({ productId: product.id, kind, file });
      setStatus("done");
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

  const fields = fileFieldsFor(product.type);
  const sizes = product.details?.sizes;
  const shippingCents = product.details?.shipping_cents;
  const crop = product.details?.crop;

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{product.title}</strong>
        <span>{formatPrice(product.price_cents)}</span>
      </div>
      <p style={styles.dim}>{TYPE_LABELS[product.type] || product.type}</p>
      {product.description && <p style={styles.dim}>{product.description}</p>}
      {product.type === "physical" && (
        <p style={styles.dim}>
          {Array.isArray(sizes) && sizes.length > 0 ? `Sizes: ${sizes.join(", ")} — ` : ""}
          Shipping: {formatPrice(shippingCents || 0)}
        </p>
      )}
      <p style={styles.dim}>
        Photo: {crop === "square" ? "cropped to square" : crop === "portrait" ? "cropped to portrait" : "natural (no crop)"}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        {fields.map((f) => (
          <label
            key={f.kind}
            style={{ ...styles.dim, ...styles.dropzone(dragOverKind === f.kind) }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKind(f.kind);
            }}
            onDragLeave={() => setDragOverKind((k) => (k === f.kind ? null : k))}
            onDrop={(e) => handleDrop(f.kind, e)}
          >
            {f.label}
            <input
              type="file"
              onChange={(e) => handleFile(f.kind, e.target.files?.[0])}
            />
            <span style={{ fontSize: "0.75rem" }}>or drag &amp; drop a file here</span>
          </label>
        ))}
      </div>
      {status.startsWith("uploading") && <p style={styles.dim}>Uploading…</p>}
      {status === "done" && <p style={{ ...styles.dim, color: "var(--success)" }}>Saved.</p>}
      {error && <p style={{ ...styles.dim, color: "#e08a8a" }}>{error}</p>}
    </div>
  );
}

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("digital_image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState("");
  const [shipping, setShipping] = useState("");
  const [crop, setCrop] = useState("natural");
  const [error, setError] = useState("");

  async function loadProducts() {
    const res = await fetch("/api/dashboard/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          priceCents: Math.round(Number.parseFloat(price || "0") * 100),
          ...(type === "physical"
            ? {
                sizes,
                shippingCents: Math.round(Number.parseFloat(shipping || "0") * 100),
              }
            : {}),
          ...(crop !== "natural" ? { crop } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setTitle("");
      setDescription("");
      setPrice("");
      setSizes("");
      setShipping("");
      setCrop("natural");
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Products</h2>
      <BulkUpload onDone={loadProducts} />
      <form onSubmit={handleCreate} style={{ maxWidth: 420, marginTop: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              style={styles.typeButton(type === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          style={styles.input}
          placeholder="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Price in dollars (e.g. 25.00)"
          required
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {type === "physical" && (
          <>
            <input
              style={styles.input}
              placeholder="Sizes, comma separated (optional, e.g. S, M, L)"
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Shipping cost in dollars (e.g. 6.00)"
              inputMode="decimal"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </>
        )}
        <p style={{ ...styles.dim, marginTop: "0.75rem", marginBottom: "0.25rem" }}>
          Photo crop -- the feed never crops by default, but you can opt this piece into one:
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            ["natural", "Natural (no crop)"],
            ["square", "Square"],
            ["portrait", "Portrait"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCrop(value)}
              style={styles.typeButton(crop === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button style={styles.button} type="submit">
          Add product
        </button>
        {error && <p style={{ color: "#e08a8a" }}>{error}</p>}
      </form>

      <div style={{ marginTop: "1.5rem" }}>
        {loading ? (
          <p style={styles.dim}>Loading…</p>
        ) : products.length === 0 ? (
          <p style={styles.dim}>No products yet — add your first one above.</p>
        ) : (
          products.map((p) => <ProductRow key={p.id} product={p} />)
        )}
      </div>
    </div>
  );
}
