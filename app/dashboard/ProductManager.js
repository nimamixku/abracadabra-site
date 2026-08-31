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
      <form onSubmit={handleCreate} style={{ maxWidth: 420 }}>
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
