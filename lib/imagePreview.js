// Opt-in, artist-triggered preview generation -- the plan's "automatic
// preview-format compatibility" section, but explicitly NOT automatic:
// it only runs when an artist asks for it (a "Generate preview" button
// per product, or the per-item/"for all of these" opt-in in bulk
// upload), never as a silent default when a full-res file has no
// matching preview. A machine-generated preview isn't guaranteed to look
// as good as one exported by hand -- see the plan's open verification
// item -- so the artist chooses this, and always sees which kind of
// preview a product currently has (see the `preview_generated` flag this
// sets in the caller).
//
// Format decision (locked into the plan): JPEG at 92-95% quality, not
// PNG -- verified against the founder's own live-site previews (already
// JPEG @ 85) and against Saatchi Art / Fine Art America / Society6, who
// all require or default to JPEG for listing images. This only ever
// touches the PREVIEW copy -- the purchased "full" file a buyer
// downloads is never regenerated, resized, or recompressed by this or
// anything else in the app.
import sharp from "sharp";
import { getObjectStream } from "@/lib/r2";

const MAX_LONG_EDGE = 2400;
const JPEG_QUALITY = 93;

// What sharp/libvips can actually decode without extra tooling. Camera
// RAW formats (CR2, NEF, ARW, DNG, ...) are deliberately NOT included --
// they need a RAW-decoding step this app doesn't have yet, so an artist
// uploading straight-from-camera RAW files still needs to supply their
// own exported preview for now, same as before this feature existed.
const SUPPORTED_EXTENSIONS = new Set([
  "tif",
  "tiff",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
]);

export function isPreviewGeneratable(contentType, key) {
  const ext = (key.split(".").pop() || "").toLowerCase();
  if (SUPPORTED_EXTENSIONS.has(ext)) return true;
  return typeof contentType === "string" && /^image\/(png|jpe?g|webp|gif|avif|tiff)$/.test(contentType);
}

// Fetches the full-res file from R2 and returns a ready-to-upload JPEG
// preview buffer plus its final pixel dimensions (for product_files'
// width_px/height_px, which is what lets the storefront reserve the
// photo's own real shape instead of a placeholder square -- see the
// plan's "no forced cropping, ever" section).
export async function generatePreviewJpeg({ key }) {
  const object = await getObjectStream({ key });
  const bytes = await object.Body.transformToByteArray();

  // .rotate() with no args: auto-orients from EXIF first, so a preview
  // generated from a phone/camera file that's only "upright" via EXIF
  // rotation doesn't come out sideways once that metadata is stripped.
  const source = sharp(Buffer.from(bytes)).rotate();
  const meta = await source.metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);

  // .toColourspace("srgb"): a TIFF/RAW export often carries a wide-gamut
  // profile (Adobe RGB, ProPhoto RGB) that browsers don't assume --
  // converting explicitly avoids colors shifting or looking flat, rather
  // than shipping an unconverted wide-gamut JPEG and hoping the browser
  // guesses right.
  let pipeline = source.toColourspace("srgb");

  // A performance safeguard only -- caps pixel dimensions for mobile
  // scroll performance, never a quality cut. withoutEnlargement: never
  // upscale a smaller source past its own real size.
  if (longEdge > MAX_LONG_EDGE) {
    pipeline = pipeline.resize({
      width: (meta.width || 0) >= (meta.height || 0) ? MAX_LONG_EDGE : undefined,
      height: (meta.height || 0) > (meta.width || 0) ? MAX_LONG_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Resizing softens an image slightly; a hand export typically
  // re-sharpens afterward for the smaller size -- a naive resize-and-save
  // skips this and looks visibly softer by comparison, so this pipeline
  // doesn't skip it either.
  pipeline = pipeline.sharpen();

  const { data, info } = await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
}
