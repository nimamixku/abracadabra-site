// The one place all products live -- but NOT where real download links
// live. This file is imported directly by app/page.js, a client
// component, so everything in it (every field, even ones the UI never
// shows) gets bundled into the JavaScript sent to every visitor's
// browser. That's fine for title/price/photo -- people need to see those
// to decide what to buy -- but it would be disastrous for the real TIFF
// links: anyone could open dev tools and grab every full-res file for
// free, no purchase needed.
//
// So the real download links live in a separate, server-only file:
// lib/product-files.js (see it for details). It's only ever read from
// app/api/confirm/route.js, after Stripe has confirmed a payment
// actually succeeded -- never from here.
//
// type: "digital"  -- instant download after purchase (your art prints).
//       `image` is the sharp JPG shown on the site itself; browsers can't
//       display TIFFs, so this preview image is what people actually see
//       and buy. The real file lives in lib/product-files.js, matched up
//       by this same `id`.
//
// type: "physical" -- ships to a real address (your clothing). Needs
//       `sizes` if the item comes in sizes. No download -- checkout
//       collects a shipping address instead.
//
// price is in CENTS (e.g. 3200 = $32.00), the unit Stripe expects.

export const PRODUCTS = [
  { id: "609-door", type: "digital", title: "609 Door", price: 50, image: "/previews/609-door.jpg" },
  { id: "abra-flower-hat", type: "digital", title: "Abra Flower Hat", price: 50, image: "/previews/abra-flower-hat.jpg" },
  { id: "back-to-new-orleans", type: "digital", title: "Back to New Orleans", price: 50, image: "/previews/back-to-new-orleans.jpg" },
  { id: "banana", type: "digital", title: "Banana", price: 50, image: "/previews/banana.jpg" },
  { id: "band", type: "digital", title: "Band", price: 50, image: "/previews/band.jpg" },
  { id: "bass-pro-shop", type: "digital", title: "Bass Pro Shop", price: 50, image: "/previews/bass-pro-shop.jpg" },
  { id: "blue-fence", type: "digital", title: "Blue Fence", price: 50, image: "/previews/blue-fence.jpg" },
  { id: "bouquet", type: "digital", title: "Bouquet", price: 50, image: "/previews/bouquet.jpg" },
  { id: "cafe-du-monde", type: "digital", title: "Cafe du Monde", price: 50, image: "/previews/cafe-du-monde.jpg" },
  { id: "celestial-waving-flower", type: "digital", title: "Celestial Waving Flower", price: 50, image: "/previews/celestial-waving-flower.jpg" },
  { id: "chickens", type: "digital", title: "Chickens", price: 50, image: "/previews/chickens.jpg" },
  { id: "clasping-flower", type: "digital", title: "Clasping Flower", price: 50, image: "/previews/clasping-flower.jpg" },
  { id: "cold-december-morning", type: "digital", title: "Cold December Morning", price: 50, image: "/previews/cold-december-morning.jpg" },
  { id: "converse-and-wildflowers", type: "digital", title: "Converse and Wildflowers", price: 50, image: "/previews/converse-and-wildflowers.jpg" },
  { id: "crow-in-flight", type: "digital", title: "Crow in Flight", price: 50, image: "/previews/crow-in-flight.jpg" },
  { id: "door-on-tchoup", type: "digital", title: "Door on Tchoup", price: 50, image: "/previews/door-on-tchoup.jpg" },
  { id: "drum-green", type: "digital", title: "Drum, Green", price: 50, image: "/previews/drum-green.jpg" },
  { id: "earth-swallows-car", type: "digital", title: "Earth Swallows Car", price: 50, image: "/previews/earth-swallows-car.jpg" },
  { id: "fairy-flower", type: "digital", title: "Fairy Flower", price: 50, image: "/previews/fairy-flower.jpg" },
  { id: "flower-in-front-of-door", type: "digital", title: "Flower in Front of Door", price: 50, image: "/previews/flower-in-front-of-door.jpg" },
  { id: "flower-jar", type: "digital", title: "Flower Jar", price: 50, image: "/previews/flower-jar.jpg" },
  { id: "flower-lanterns", type: "digital", title: "Flower Lanterns", price: 50, image: "/previews/flower-lanterns.jpg" },
  { id: "flower-on-fence", type: "digital", title: "Flower on Fence", price: 50, image: "/previews/flower-on-fence.jpg" },
  { id: "flowers-by-the-tracks", type: "digital", title: "Flowers by the Tracks", price: 50, image: "/previews/flowers-by-the-tracks.jpg" },
  { id: "flowers-in-fence", type: "digital", title: "Flowers in Fence", price: 50, image: "/previews/flowers-in-fence.jpg" },
  { id: "flowers-and-roof", type: "digital", title: "Flowers and Roof", price: 50, image: "/previews/flowers-and-roof.jpg" },
  { id: "french-quarter-door", type: "digital", title: "French Quarter Door", price: 50, image: "/previews/french-quarter-door.jpg" },
  { id: "franklin-cross", type: "digital", title: "Franklin Cross", price: 50, image: "/previews/franklin-cross.jpg" },
  { id: "frenchmen", type: "digital", title: "Frenchmen", price: 50, image: "/previews/frenchmen.jpg" },
  { id: "fuchsia", type: "digital", title: "Fuchsia", price: 50, image: "/previews/fuchsia.jpg" },
  { id: "gardener-hands", type: "digital", title: "Gardener Hands", price: 50, image: "/previews/gardener-hands.jpg" },
  { id: "glorias", type: "digital", title: "Gloria's", price: 50, image: "/previews/glorias.jpg" },
  { id: "gods-light", type: "digital", title: "God's Light", price: 50, image: "/previews/gods-light.jpg" },
  { id: "green-leaves", type: "digital", title: "Green Leaves", price: 50, image: "/previews/green-leaves.jpg" },
  { id: "green-plant-blue-house", type: "digital", title: "Green Plant, Blue House", price: 50, image: "/previews/green-plant-blue-house.jpg" },
  { id: "hands-holding-flowers", type: "digital", title: "Hands Holding Flowers", price: 50, image: "/previews/hands-holding-flowers.jpg" },
  { id: "her-curves", type: "digital", title: "Her Curves", price: 50, image: "/previews/her-curves.jpg" },
  { id: "holy-flowers", type: "digital", title: "Holy Flowers", price: 50, image: "/previews/holy-flowers.jpg" },
  { id: "house-on-esplanade", type: "digital", title: "House on Esplanade", price: 50, image: "/previews/house-on-esplanade.jpg" },
  { id: "house-to-marigny", type: "digital", title: "House to Marigny", price: 50, image: "/previews/house-to-marigny.jpg" },
  { id: "if-im-still-breathing", type: "digital", title: "If I'm Still Breathing", price: 50, image: "/previews/if-im-still-breathing.jpg" },
  { id: "in-dreams", type: "digital", title: "In Dreams", price: 50, image: "/previews/in-dreams.jpg" },
  { id: "jeannette-cutting-flowers", type: "digital", title: "Jeannette Cutting Flowers", price: 50, image: "/previews/jeannette-cutting-flowers.jpg" },
  { id: "jeannette-reading", type: "digital", title: "Jeannette Reading", price: 50, image: "/previews/jeannette-reading.jpg" },
  { id: "jeannette-ribbon", type: "digital", title: "Jeannette Ribbon", price: 50, image: "/previews/jeannette-ribbon.jpg" },
  { id: "jeannettes-hands", type: "digital", title: "Jeannette's Hands", price: 50, image: "/previews/jeannettes-hands.jpg" },
  { id: "jeannettes-rose", type: "digital", title: "Jeannette's Rose", price: 50, image: "/previews/jeannettes-rose.jpg" },
  { id: "little-mermaid-flower", type: "digital", title: "Little Mermaid Flower", price: 50, image: "/previews/little-mermaid-flower.jpg" },
  { id: "lush", type: "digital", title: "Lush", price: 50, image: "/previews/lush.jpg" },
  { id: "magnolia-in-the-city", type: "digital", title: "Magnolia in the City", price: 50, image: "/previews/magnolia-in-the-city.jpg" },
  { id: "my-favorite-flower", type: "digital", title: "My Favorite Flower", price: 50, image: "/previews/my-favorite-flower.jpg" },
  { id: "new-orleans-night", type: "digital", title: "New Orleans Night", price: 50, image: "/previews/new-orleans-night.jpg" },
  { id: "nightwork", type: "digital", title: "Nightwork", price: 50, image: "/previews/nightwork.jpg" },
  { id: "n-rampart", type: "digital", title: "N. Rampart", price: 50, image: "/previews/n-rampart.jpg" },
  { id: "orange-flower", type: "digital", title: "Orange Flower", price: 50, image: "/previews/orange-flower.jpg" },
  { id: "orange-flower-leonidas", type: "digital", title: "Orange Flower, Leonidas", price: 50, image: "/previews/orange-flower-leonidas.jpg" },
  { id: "orange-fruit", type: "digital", title: "Orange Fruit", price: 50, image: "/previews/orange-fruit.jpg" },
  { id: "palm-before-storm", type: "digital", title: "Palm Before Storm", price: 50, image: "/previews/palm-before-storm.jpg" },
  { id: "pink-palm", type: "digital", title: "Pink Palm", price: 50, image: "/previews/pink-palm.jpg" },
  { id: "pink-rose", type: "digital", title: "Pink Rose", price: 50, image: "/previews/pink-rose.jpg" },
  { id: "porch-drapes", type: "digital", title: "Porch Drapes", price: 50, image: "/previews/porch-drapes.jpg" },
  { id: "porch-light", type: "digital", title: "Porch Light", price: 50, image: "/previews/porch-light.jpg" },
  { id: "red-car", type: "digital", title: "Red Car", price: 50, image: "/previews/red-car.jpg" },
  { id: "red-roses", type: "digital", title: "Red Roses", price: 50, image: "/previews/red-roses.jpg" },
  { id: "rose-garden", type: "digital", title: "Rose Garden", price: 50, image: "/previews/rose-garden.jpg" },
  { id: "rose-in-hand", type: "digital", title: "Rose in Hand", price: 50, image: "/previews/rose-in-hand.jpg" },
  { id: "rose-on-building", type: "digital", title: "Rose on Building", price: 50, image: "/previews/rose-on-building.jpg" },
  { id: "roses", type: "digital", title: "Roses", price: 50, image: "/previews/roses.jpg" },
  { id: "screens", type: "digital", title: "Screens", price: 50, image: "/previews/screens.jpg" },
  { id: "shine-bright", type: "digital", title: "Shine Bright", price: 50, image: "/previews/shine-bright.jpg" },
  { id: "sunflower-high", type: "digital", title: "Sunflower High", price: 50, image: "/previews/sunflower-high.jpg" },
  { id: "sunflower-white-house", type: "digital", title: "Sunflower, White House", price: 50, image: "/previews/sunflower-white-house.jpg" },
  { id: "sunrise", type: "digital", title: "Sunrise", price: 50, image: "/previews/sunrise.jpg" },
  { id: "swamp-trees", type: "digital", title: "Swamp Trees", price: 50, image: "/previews/swamp-trees.jpg" },
  { id: "tassles", type: "digital", title: "Tassles", price: 50, image: "/previews/tassles.jpg" },
  { id: "teardrop-on-leaf", type: "digital", title: "Teardrop on Leaf", price: 50, image: "/previews/teardrop-on-leaf.jpg" },
  { id: "thread-of-fate", type: "digital", title: "Thread of Fate", price: 50, image: "/previews/thread-of-fate.jpg" },
  { id: "too-close-to-the-sun", type: "digital", title: "Too Close to the Sun", price: 50, image: "/previews/too-close-to-the-sun.jpg" },
  { id: "tower-palm", type: "digital", title: "Tower Palm", price: 50, image: "/previews/tower-palm.jpg" },
  { id: "tree-magic", type: "digital", title: "Tree Magic", price: 50, image: "/previews/tree-magic.jpg" },
  { id: "two-flowers", type: "digital", title: "Two Flowers", price: 50, image: "/previews/two-flowers.jpg" },
  { id: "white-and-blue", type: "digital", title: "White and Blue", price: 50, image: "/previews/white-and-blue.jpg" },
  { id: "wildflower", type: "digital", title: "Wildflower", price: 50, image: "/previews/wildflower.jpg" },
  { id: "wires", type: "digital", title: "Wires", price: 50, image: "/previews/wires.jpg" },
  { id: "yellow-and-blue", type: "digital", title: "Yellow and Blue", price: 50, image: "/previews/yellow-and-blue.jpg" },
  { id: "yellow-flower", type: "digital", title: "Yellow Flower", price: 50, image: "/previews/yellow-flower.jpg" },
  { id: "yellow-flowers", type: "digital", title: "Yellow Flowers", price: 50, image: "/previews/yellow-flowers.jpg" },
  { id: "yellow-on-blue", type: "digital", title: "Yellow on Blue", price: 50, image: "/previews/yellow-on-blue.jpg" },
  { id: "yoni-flowers", type: "digital", title: "Yoni Flowers", price: 50, image: "/previews/yoni-flowers.jpg" },
  { id: "you-are-safe-with-me", type: "digital", title: "You Are Safe With Me", price: 50, image: "/previews/you-are-safe-with-me.jpg" },

  // Clothing -- placeholders until real product photos are staged.
  {
    id: "clothing-1",
    type: "physical",
    title: "Clothing Item 01",
    price: 3200,
    image: "/previews/clothing-1.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "clothing-2",
    type: "physical",
    title: "Clothing Item 02",
    price: 3800,
    image: "/previews/clothing-2.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}
