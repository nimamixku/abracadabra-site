// Server-only: real download links for paid digital art, kept OUT of
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
// Swap each "PENDING_TIFF_UPLOAD" for the real Vercel Blob URL once that
// piece is uploaded -- nothing else needs to change.

export const PRODUCT_FILES = {
  "609-door": "PENDING_TIFF_UPLOAD",
  "abra-flower-hat": "PENDING_TIFF_UPLOAD",
  "back-to-new-orleans": "PENDING_TIFF_UPLOAD",
  "banana": "PENDING_TIFF_UPLOAD",
  "band": "PENDING_TIFF_UPLOAD",
  "bass-pro-shop": "PENDING_TIFF_UPLOAD",
  "blue-fence": "PENDING_TIFF_UPLOAD",
  "bouquet": "PENDING_TIFF_UPLOAD",
  "cafe-du-monde": "PENDING_TIFF_UPLOAD",
  "celestial-waving-flower": "PENDING_TIFF_UPLOAD",
  "chickens": "PENDING_TIFF_UPLOAD",
  "clasping-flower": "PENDING_TIFF_UPLOAD",
  "cold-december-morning": "PENDING_TIFF_UPLOAD",
  "converse-and-wildflowers": "PENDING_TIFF_UPLOAD",
  "crow-in-flight": "PENDING_TIFF_UPLOAD",
  "door-on-tchoup": "PENDING_TIFF_UPLOAD",
  "drum-green": "PENDING_TIFF_UPLOAD",
  "earth-swallows-car": "PENDING_TIFF_UPLOAD",
  "fairy-flower": "PENDING_TIFF_UPLOAD",
  "flower-in-front-of-door": "PENDING_TIFF_UPLOAD",
  "flower-jar": "PENDING_TIFF_UPLOAD",
  "flower-lanterns": "PENDING_TIFF_UPLOAD",
  "flower-on-fence": "PENDING_TIFF_UPLOAD",
  "flowers-by-the-tracks": "PENDING_TIFF_UPLOAD",
  "flowers-in-fence": "PENDING_TIFF_UPLOAD",
  "flowers-and-roof": "PENDING_TIFF_UPLOAD",
  "french-quarter-door": "PENDING_TIFF_UPLOAD",
  "franklin-cross": "PENDING_TIFF_UPLOAD",
  "frenchmen": "PENDING_TIFF_UPLOAD",
  "fuchsia": "PENDING_TIFF_UPLOAD",
  "gardener-hands": "PENDING_TIFF_UPLOAD",
  "glorias": "PENDING_TIFF_UPLOAD",
  "gods-light": "PENDING_TIFF_UPLOAD",
  "green-leaves": "PENDING_TIFF_UPLOAD",
  "green-plant-blue-house": "PENDING_TIFF_UPLOAD",
  "hands-holding-flowers": "PENDING_TIFF_UPLOAD",
  "her-curves": "PENDING_TIFF_UPLOAD",
  "holy-flowers": "PENDING_TIFF_UPLOAD",
  "house-on-esplanade": "PENDING_TIFF_UPLOAD",
  "house-to-marigny": "PENDING_TIFF_UPLOAD",
  "if-im-still-breathing": "PENDING_TIFF_UPLOAD",
  "in-dreams": "PENDING_TIFF_UPLOAD",
  "jeannette-cutting-flowers": "PENDING_TIFF_UPLOAD",
  "jeannette-reading": "PENDING_TIFF_UPLOAD",
  "jeannette-ribbon": "PENDING_TIFF_UPLOAD",
  "jeannettes-hands": "PENDING_TIFF_UPLOAD",
  "jeannettes-rose": "PENDING_TIFF_UPLOAD",
  "little-mermaid-flower": "PENDING_TIFF_UPLOAD",
  "lush": "PENDING_TIFF_UPLOAD",
  "magnolia-in-the-city": "PENDING_TIFF_UPLOAD",
  "my-favorite-flower": "PENDING_TIFF_UPLOAD",
  "new-orleans-night": "PENDING_TIFF_UPLOAD",
  "nightwork": "PENDING_TIFF_UPLOAD",
  "n-rampart": "PENDING_TIFF_UPLOAD",
  "orange-flower": "PENDING_TIFF_UPLOAD",
  "orange-flower-leonidas": "PENDING_TIFF_UPLOAD",
  "orange-fruit": "PENDING_TIFF_UPLOAD",
  "palm-before-storm": "PENDING_TIFF_UPLOAD",
  "pink-palm": "PENDING_TIFF_UPLOAD",
  "pink-rose": "PENDING_TIFF_UPLOAD",
  "porch-drapes": "PENDING_TIFF_UPLOAD",
  "porch-light": "PENDING_TIFF_UPLOAD",
  "red-car": "PENDING_TIFF_UPLOAD",
  "red-roses": "PENDING_TIFF_UPLOAD",
  "rose-garden": "PENDING_TIFF_UPLOAD",
  "rose-in-hand": "PENDING_TIFF_UPLOAD",
  "rose-on-building": "PENDING_TIFF_UPLOAD",
  "roses": "PENDING_TIFF_UPLOAD",
  "screens": "PENDING_TIFF_UPLOAD",
  "shine-bright": "PENDING_TIFF_UPLOAD",
  "sunflower-high": "PENDING_TIFF_UPLOAD",
  "sunflower-white-house": "PENDING_TIFF_UPLOAD",
  "sunrise": "PENDING_TIFF_UPLOAD",
  "swamp-trees": "PENDING_TIFF_UPLOAD",
  "tassles": "PENDING_TIFF_UPLOAD",
  "teardrop-on-leaf": "PENDING_TIFF_UPLOAD",
  "thread-of-fate": "PENDING_TIFF_UPLOAD",
  "too-close-to-the-sun": "PENDING_TIFF_UPLOAD",
  "tower-palm": "PENDING_TIFF_UPLOAD",
  "tree-magic": "PENDING_TIFF_UPLOAD",
  "two-flowers": "PENDING_TIFF_UPLOAD",
  "white-and-blue": "PENDING_TIFF_UPLOAD",
  "wildflower": "PENDING_TIFF_UPLOAD",
  "wires": "PENDING_TIFF_UPLOAD",
  "yellow-and-blue": "PENDING_TIFF_UPLOAD",
  "yellow-flower": "PENDING_TIFF_UPLOAD",
  "yellow-flowers": "PENDING_TIFF_UPLOAD",
  "yellow-on-blue": "PENDING_TIFF_UPLOAD",
  "yoni-flowers": "PENDING_TIFF_UPLOAD",
  "you-are-safe-with-me": "PENDING_TIFF_UPLOAD",
};

export function getFileUrl(id) {
  return PRODUCT_FILES[id];
}
