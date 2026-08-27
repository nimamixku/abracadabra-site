// One-time migration script: uploads every real TIFF in _source-files/
// that isn't already sitting on Cloudflare R2 -- including anything still
// on Vercel Blob -- and writes lib/product-files.js with the real URLs
// (see that file's own comment for why it's kept separate from
// lib/products.js).
//
// Switched from Vercel Blob to Cloudflare R2 (fully, now) because Blob's
// free "Hobby" plan caps AVERAGE storage at 1GB, and once you go over it,
// Vercel doesn't just block new uploads -- it blocks ALL requests to that
// store, including reads of files that were already there. That's what
// happened here: the store hit its cap and every existing download
// started failing with a 403, for every visitor, with no way to fix it
// from code. R2's free tier goes up to 10GB (comfortably covers this
// whole ~2.9GB catalog) and never blocks access -- it just bills a few
// cents per GB if you ever go over, no hard cutoff.
//
// Safe to re-run: an entry only gets (re-)uploaded if its current value
// in lib/product-files.js is either "PENDING_TIFF_UPLOAD" or still a
// vercel-storage.com URL. Anything already migrated to R2 (a
// *.r2.dev URL) is left completely untouched, so re-running this after a
// partial failure never re-uploads work that's already done.
//
// Run from the project root, with these five env vars set (see the
// project notes for where to find each one in the Cloudflare dashboard):
//   R2_ACCOUNT_ID=...
//   R2_ACCESS_KEY_ID=...
//   R2_SECRET_ACCESS_KEY=...
//   R2_BUCKET_NAME=...
//   R2_PUBLIC_URL=...          (e.g. https://pub-xxxxxxxxxxxx.r2.dev)
//
// Example:
//   R2_ACCOUNT_ID="..." R2_ACCESS_KEY_ID="..." R2_SECRET_ACCESS_KEY="..." \
//   R2_BUCKET_NAME="abracadabra-tiffs" R2_PUBLIC_URL="https://pub-xxxx.r2.dev" \
//   node scripts/upload-tiffs.mjs

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const SOURCE_DIR = path.join(process.cwd(), "_source-files");
const OUT_FILE = path.join(process.cwd(), "lib", "product-files.js");

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

for (const [name, val] of Object.entries({
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
})) {
  if (!val) {
    console.error(`Missing ${name} -- set it before running this script.`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// productId -> source filename in _source-files/
const MAPPING = {
  "609-door": "609door.tif",
  "abra-flower-hat": "AbraFlowerHat.tif",
  "back-to-new-orleans": "backtoneworleans.tif",
  "banana": "banana.tif",
  "band": "band.tif",
  "bass-pro-shop": "bassproshop.tif",
  "blue-fence": "bluefence.tif",
  "bouquet": "bouquet.tif",
  "cafe-du-monde": "cafedumonde.tif",
  "celestial-waving-flower": "celestialwavingflower.tif",
  "chickens": "chickens.tif",
  "cold-december-morning": "colddecembermorning.tif",
  "converse-and-wildflowers": "converseandwildflowers.tif",
  "crow-in-flight": "crowinflight.tif",
  "door-on-tchoup": "doorontchoup.tif",
  "drum-green": "drumgreen.tif",
  "earth-swallows-car": "earthswallowscar.tif",
  "fairy-flower": "fairyflower.tif",
  "flower-in-front-of-door": "flowerinfrontofdoor.tif",
  "flower-jar": "flowerjar.tif",
  "flower-lanterns": "flowerlanterns.tif",
  "flower-on-fence": "floweronfence.tif",
  "flowers-by-the-tracks": "flowersbythetracks.tif",
  "flowers-in-fence": "flowersinfence.tif",
  "franklin-cross": "franklincross.tif",
  "frenchmen": "frenchmen.tif",
  "gardener-hands": "gardenerhands.tif",
  "glorias": "glorias.tif",
  "gods-light": "godslight.tif",
  "green-leaves": "greenleaves.tif",
  "hands-holding-flowers": "handsholdingflowers.tif",
  "her-curves": "hercurves.tif",
  "house-on-esplanade": "houseonesplanade.tif",
  "house-to-marigny": "housetomarigny.tif",
  "if-im-still-breathing": "ifimstillbreathing.tif",
  "jeannette-cutting-flowers": "JeannetteCuttingFlowers.tif",
  "jeannette-reading": "jeannettereading.tif",
  "jeannette-ribbon": "jeannetteribbon.tif",
  "jeannettes-hands": "Jeannetteshands.tif",
  "jeannettes-rose": "jeannettesrose.tif",
  "little-mermaid-flower": "littlemermaidflower.tif",
  "lush": "lush.tif",
  "magnolia-in-the-city": "magnoliainthecity.tif",
  "my-favorite-flower": "myfavoriteflower.tif",
  "new-orleans-night": "neworleansnight.tif",
  "nightwork": "nightwork.tif",
  "n-rampart": "nrampart.tif",
  "orange-flower": "orangeflower.tif",
  "orange-flower-leonidas": "orangeflowerleonidas.tif",
  "orange-fruit": "orangefruit.tif",
  "palm-before-storm": "palmbeforestorm.tif",
  "pink-palm": "pinkpalm.tif",
  "pink-rose": "pinkrose.tif",
  "porch-drapes": "porchdrapes.tif",
  "porch-light": "porchlight.tif",
  "red-car": "redcar.tif",
  "red-roses": "redroses.tif",
  "rose-garden": "rosegarden.tif",
  "rose-in-hand": "roseinhand.tif",
  "rose-on-building": "roseonbuilding.tif",
  "roses": "Roses.tif",
  "screens": "screens.tif",
  "shine-bright": "shinebright.tif",
  "sunflower-high": "sunflowerhigh.tif",
  "sunflower-white-house": "sunflowerwhitehouse.tif",
  "sunrise": "sunrise.tif",
  "swamp-trees": "swamptrees.tif",
  "tassles": "tassles.tif",
  "teardrop-on-leaf": "teardroponleaf.tif",
  "thread-of-fate": "threadoffate.tif",
  "too-close-to-the-sun": "tooclosetothesun.tif",
  "tower-palm": "towerpalm.tif",
  "tree-magic": "treemagic.tif",
  "two-flowers": "twoflowers.tif",
  "wires": "wires.tif",
  "yellow-and-blue": "yellowandblue.tif",
  "yellow-on-blue": "yellowonblue.tif",
  "yoni-flowers": "yoniflowers.tif",
  "you-are-safe-with-me": "youaresafewithme.tif",
  "clasping-flower": "claspingflwr.tif",
  "flowers-and-roof": "flwrsandroof.tif",
  "french-quarter-door": "fqdoor.tif",
  "fuchsia": "fucsia.tif",
  "green-plant-blue-house": "greenleavesbluehouse.tif",
  "holy-flowers": "holiflowers.tif",
  "in-dreams": "indreamsflowers.tif",
  "white-and-blue": "whitenadblue.tif",
  "wildflower": "wildflwr.tif",
  "yellow-flower": "yellowflwrs.tif",
  "yellow-flowers": "yellowflwrs 2.tif",
};

// Reads whatever lib/product-files.js already has, so re-running this
// script never re-uploads (or loses) anything that's already real. Parsed
// as text rather than imported, so a stale ESM module cache can't hide
// changes another run of this same script just made.
async function loadExisting() {
  try {
    const text = await readFile(OUT_FILE, "utf8");
    const existing = {};
    for (const match of text.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
      existing[match[1]] = match[2];
    }
    return existing;
  } catch {
    return {};
  }
}

// True only for a URL that's already safely on R2 -- everything else
// (pending, or still pointing at vercel-storage.com) needs (re-)uploading.
function isAlreadyOnR2(url) {
  return typeof url === "string" && url.includes(".r2.dev/");
}

async function main() {
  const existing = await loadExisting();
  const entries = Object.entries(MAPPING);
  const results = { ...existing };
  let uploaded = 0;
  let migratedFromBlob = 0;
  let skipped = 0;

  for (const [productId, filename] of entries) {
    const already = existing[productId];
    if (isAlreadyOnR2(already)) {
      skipped++;
      continue;
    }
    const wasOnBlob = already && already.includes("vercel-storage.com");

    const filePath = path.join(SOURCE_DIR, filename);
    try {
      const buffer = await readFile(filePath);
      // A random suffix on the object key, same as the old Vercel Blob
      // uploads -- without it, anyone could guess another product's
      // download URL just by swapping the id in a URL they already have
      // (product ids are public, visible in the site's own client code).
      const suffix = crypto.randomBytes(8).toString("hex");
      const key = `tiffs/${productId}-${suffix}.tif`;

      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: "image/tiff",
        })
      );

      const url = `${R2_PUBLIC_URL}/${key}`;
      results[productId] = url;
      uploaded++;
      if (wasOnBlob) migratedFromBlob++;
      const tag = wasOnBlob ? "migrated from Blob" : "new upload";
      console.log(
        `[${uploaded + skipped}/${entries.length}] (${tag}) ${productId} <- ${filename} -> ${url}`
      );
    } catch (err) {
      console.error(`FAILED: ${productId} (${filename}): ${err.message}`);
      // Keep whatever was there before (even a dead Blob URL) rather than
      // silently downgrading it to "pending" -- makes a partial failure
      // obvious and easy to diff, instead of quietly losing information.
      results[productId] = already || "PENDING_TIFF_UPLOAD";
    }
  }

  const lines = Object.entries(results)
    .map(([id, url]) => `  "${id}": "${url}",`)
    .join("\n");

  const fileContents = `// Server-only: real download links for paid digital art, kept OUT of
// lib/products.js on purpose. app/page.js is a client component that
// imports the PRODUCTS array directly, so anything in that file -- even
// fields the UI never displays -- gets bundled into the JavaScript sent
// to every visitor's browser. If the real TIFF links lived there, anyone
// could open dev tools and grab every full-res file for free, no purchase
// needed.
//
// This file is only ever imported from app/api/confirm/route.js, which
// runs on the server and only hands a link back after Stripe confirms the
// payment actually succeeded. Never import this from any "use client"
// file (app/page.js or anything it imports).
//
// Generated by scripts/upload-tiffs.mjs -- re-run that script if you need
// to re-upload or add more art.

export const PRODUCT_FILES = {
${lines}
};

export function getFileUrl(id) {
  return PRODUCT_FILES[id];
}
`;

  await writeFile(OUT_FILE, fileContents);
  const onR2 = Object.values(results).filter(isAlreadyOnR2).length;
  const stillOnBlob = Object.values(results).filter(
    (v) => typeof v === "string" && v.includes("vercel-storage.com")
  ).length;
  const stillPending = entries.length - onR2 - stillOnBlob;
  console.log(
    `\nWrote ${OUT_FILE} -- ${onR2}/${entries.length} on R2 now ` +
      `(${uploaded} uploaded just now, of which ${migratedFromBlob} were migrated off Blob; ${skipped} already on R2 before).`
  );
  if (stillOnBlob > 0) {
    console.log(
      `${stillOnBlob} entr${stillOnBlob === 1 ? "y is" : "ies are"} still pointing at Vercel Blob -- ` +
        `those will keep failing for customers until this script uploads them successfully. Re-run after checking the FAILED lines above.`
    );
  }
  if (stillPending > 0) {
    console.log(`${stillPending} entr${stillPending === 1 ? "y" : "ies"} still pending -- re-run after checking the errors above.`);
  }
  if (stillOnBlob === 0 && stillPending === 0) {
    console.log("All 90 are on R2 -- nothing depends on Vercel Blob anymore.");
  }
}

main();
