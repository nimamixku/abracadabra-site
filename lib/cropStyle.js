// Shared by TryItDemo.js, ProductManager.js, and StorefrontFeed.js so all
// three render an artist's chosen crop identically -- one formula, not
// three hand-copied ones that could quietly drift apart.
//
// A crop is `{ x, y, w, h, srcW, srcH }`: x/y/w/h are fractions (0-1) of
// the ORIGINAL photo's own width/height describing the selected
// rectangle, and srcW/srcH are that original photo's natural pixel
// dimensions (captured once, in CropEditor, when the artist opens the
// tool) -- carried on the crop itself so rendering it later never depends
// on re-measuring the image or on product_files.width_px/height_px being
// populated. `null`/undefined means natural -- no crop, whatever shape the
// photo actually is.
//
// This never touches the real file a buyer downloads or the lightbox's
// full/expanded view -- preview-only, same as the crop feature has always
// been described in the plan.

// Renders an arbitrary crop rectangle responsively with CSS alone (no JS
// resize listeners) using the standard background-size/background-position
// percentage trick: background-size scales the full image so the crop
// rect's own size maps exactly to the container, and background-position
// shifts it so the crop rect's own top-left corner lands at the
// container's top-left. Derivation: for a container of size C, setting
// background-size to (1/w)*100% makes the full image render at C/w, so a
// region of width w (fraction) maps to exactly C. background-position's
// spec formula is pos = (container - bgSize) * pct; solving for the pct
// that shifts the crop's left edge to x=0 gives pct = x / (1 - w).
export function cropBackgroundStyle(crop) {
  if (!crop) return null;
  const { x, y, w, h, srcW, srcH } = crop;
  if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (!(w > 0) || !(h > 0)) return null;
  // A crop that (within rounding) covers the whole photo is the same as
  // no crop at all -- render it as natural rather than as a no-op div.
  if (w > 0.995 && h > 0.995) return null;

  const posX = w >= 1 ? 0 : (x / (1 - w)) * 100;
  const posY = h >= 1 ? 0 : (y / (1 - h)) * 100;
  const style = {
    backgroundSize: `${(1 / w) * 100}% ${(1 / h) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: "no-repeat",
  };
  if (srcW > 0 && srcH > 0) {
    style.aspectRatio = `${(w * srcW).toFixed(2)} / ${(h * srcH).toFixed(2)}`;
  }
  return style;
}

// Sanitizes whatever a client sent as `crop` before it's trusted into the
// database -- never assume the shape is valid just because it parsed as
// JSON. A crop that fails any check is treated as "natural" (dropped)
// rather than rejecting the whole save; cropping is a nice-to-have, never
// something worth blocking a title/price edit over.
export function sanitizeCrop(crop) {
  if (!crop || typeof crop !== "object") return null;
  const { x, y, w, h, srcW, srcH } = crop;
  const nums = [x, y, w, h, srcW, srcH];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (w <= 0 || w > 1 || h <= 0 || h > 1) return null;
  if (x < 0 || y < 0 || x + w > 1.001 || y + h > 1.001) return null;
  if (srcW <= 0 || srcH <= 0) return null;
  if (w > 0.995 && h > 0.995) return null; // whole-image "crop" -- just natural
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.min(1, w),
    h: Math.min(1, h),
    srcW: Math.round(srcW),
    srcH: Math.round(srcH),
  };
}
