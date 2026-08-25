// The one place all products live. Edit this file to add, remove, or
// re-price anything -- the gallery and checkout both read from here, so
// there's nowhere else that needs updating.
//
// type: "digital"  -- instant download after purchase (your art prints).
//       Needs `fileUrl`: where the real full-resolution TIFF is hosted
//       (Vercel Blob storage, S3, etc -- NOT committed to this repo, TIFFs
//       are too large for git). `image` is the sharp JPG shown on the site
//       itself; browsers can't display TIFFs, so this preview image is
//       what people actually see and buy.
//
//       Every fileUrl below is still a placeholder ("PENDING_TIFF_UPLOAD")
//       until the real TIFFs (already sitting in _source-files/, gitignored)
//       are hosted somewhere real -- swap each one for the real hosted URL
//       once that's done; nothing else needs to change.
//
// type: "physical" -- ships to a real address (your clothing). Needs
//       `sizes` if the item comes in sizes. No `fileUrl` -- there's
//       nothing to download, checkout collects a shipping address instead.
//
// price is in CENTS (e.g. 3200 = $32.00), the unit Stripe expects.

export const PRODUCTS = [
  { id: "609-door", type: "digital", title: "609 Door", price: 50, image: "/previews/609-door.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "abra-flower-hat", type: "digital", title: "Abra Flower Hat", price: 50, image: "/previews/abra-flower-hat.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "back-to-new-orleans", type: "digital", title: "Back to New Orleans", price: 50, image: "/previews/back-to-new-orleans.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "banana", type: "digital", title: "Banana", price: 50, image: "/previews/banana.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "band", type: "digital", title: "Band", price: 50, image: "/previews/band.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "bass-pro-shop", type: "digital", title: "Bass Pro Shop", price: 50, image: "/previews/bass-pro-shop.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "blue-fence", type: "digital", title: "Blue Fence", price: 50, image: "/previews/blue-fence.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "bouquet", type: "digital", title: "Bouquet", price: 50, image: "/previews/bouquet.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "cafe-du-monde", type: "digital", title: "Cafe du Monde", price: 50, image: "/previews/cafe-du-monde.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "celestial-waving-flower", type: "digital", title: "Celestial Waving Flower", price: 50, image: "/previews/celestial-waving-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "chickens", type: "digital", title: "Chickens", price: 50, image: "/previews/chickens.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "clasping-flower", type: "digital", title: "Clasping Flower", price: 50, image: "/previews/clasping-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "cold-december-morning", type: "digital", title: "Cold December Morning", price: 50, image: "/previews/cold-december-morning.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "converse-and-wildflowers", type: "digital", title: "Converse and Wildflowers", price: 50, image: "/previews/converse-and-wildflowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "crow-in-flight", type: "digital", title: "Crow in Flight", price: 50, image: "/previews/crow-in-flight.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "door-on-tchoup", type: "digital", title: "Door on Tchoup", price: 50, image: "/previews/door-on-tchoup.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "drum-green", type: "digital", title: "Drum, Green", price: 50, image: "/previews/drum-green.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "earth-swallows-car", type: "digital", title: "Earth Swallows Car", price: 50, image: "/previews/earth-swallows-car.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "fairy-flower", type: "digital", title: "Fairy Flower", price: 50, image: "/previews/fairy-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flower-in-front-of-door", type: "digital", title: "Flower in Front of Door", price: 50, image: "/previews/flower-in-front-of-door.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flower-jar", type: "digital", title: "Flower Jar", price: 50, image: "/previews/flower-jar.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flower-lanterns", type: "digital", title: "Flower Lanterns", price: 50, image: "/previews/flower-lanterns.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flower-on-fence", type: "digital", title: "Flower on Fence", price: 50, image: "/previews/flower-on-fence.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flowers-by-the-tracks", type: "digital", title: "Flowers by the Tracks", price: 50, image: "/previews/flowers-by-the-tracks.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flowers-in-fence", type: "digital", title: "Flowers in Fence", price: 50, image: "/previews/flowers-in-fence.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "flowers-and-roof", type: "digital", title: "Flowers and Roof", price: 50, image: "/previews/flowers-and-roof.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "french-quarter-door", type: "digital", title: "French Quarter Door", price: 50, image: "/previews/french-quarter-door.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "franklin-cross", type: "digital", title: "Franklin Cross", price: 50, image: "/previews/franklin-cross.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "frenchmen", type: "digital", title: "Frenchmen", price: 50, image: "/previews/frenchmen.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "fuchsia", type: "digital", title: "Fuchsia", price: 50, image: "/previews/fuchsia.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "gardener-hands", type: "digital", title: "Gardener Hands", price: 50, image: "/previews/gardener-hands.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "glorias", type: "digital", title: "Gloria's", price: 50, image: "/previews/glorias.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "gods-light", type: "digital", title: "God's Light", price: 50, image: "/previews/gods-light.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "green-leaves", type: "digital", title: "Green Leaves", price: 50, image: "/previews/green-leaves.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "green-plant-blue-house", type: "digital", title: "Green Plant, Blue House", price: 50, image: "/previews/green-plant-blue-house.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "hands-holding-flowers", type: "digital", title: "Hands Holding Flowers", price: 50, image: "/previews/hands-holding-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "her-curves", type: "digital", title: "Her Curves", price: 50, image: "/previews/her-curves.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "holy-flowers", type: "digital", title: "Holy Flowers", price: 50, image: "/previews/holy-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "house-on-esplanade", type: "digital", title: "House on Esplanade", price: 50, image: "/previews/house-on-esplanade.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "house-to-marigny", type: "digital", title: "House to Marigny", price: 50, image: "/previews/house-to-marigny.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "if-im-still-breathing", type: "digital", title: "If I'm Still Breathing", price: 50, image: "/previews/if-im-still-breathing.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "in-dreams", type: "digital", title: "In Dreams", price: 50, image: "/previews/in-dreams.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "jeannette-cutting-flowers", type: "digital", title: "Jeannette Cutting Flowers", price: 50, image: "/previews/jeannette-cutting-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "jeannette-reading", type: "digital", title: "Jeannette Reading", price: 50, image: "/previews/jeannette-reading.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "jeannette-ribbon", type: "digital", title: "Jeannette Ribbon", price: 50, image: "/previews/jeannette-ribbon.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "jeannettes-hands", type: "digital", title: "Jeannette's Hands", price: 50, image: "/previews/jeannettes-hands.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "jeannettes-rose", type: "digital", title: "Jeannette's Rose", price: 50, image: "/previews/jeannettes-rose.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "little-mermaid-flower", type: "digital", title: "Little Mermaid Flower", price: 50, image: "/previews/little-mermaid-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "lush", type: "digital", title: "Lush", price: 50, image: "/previews/lush.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "magnolia-in-the-city", type: "digital", title: "Magnolia in the City", price: 50, image: "/previews/magnolia-in-the-city.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "my-favorite-flower", type: "digital", title: "My Favorite Flower", price: 50, image: "/previews/my-favorite-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "new-orleans-night", type: "digital", title: "New Orleans Night", price: 50, image: "/previews/new-orleans-night.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "nightwork", type: "digital", title: "Nightwork", price: 50, image: "/previews/nightwork.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "n-rampart", type: "digital", title: "N. Rampart", price: 50, image: "/previews/n-rampart.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "orange-flower", type: "digital", title: "Orange Flower", price: 50, image: "/previews/orange-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "orange-flower-leonidas", type: "digital", title: "Orange Flower, Leonidas", price: 50, image: "/previews/orange-flower-leonidas.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "orange-fruit", type: "digital", title: "Orange Fruit", price: 50, image: "/previews/orange-fruit.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "palm-before-storm", type: "digital", title: "Palm Before Storm", price: 50, image: "/previews/palm-before-storm.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "pink-palm", type: "digital", title: "Pink Palm", price: 50, image: "/previews/pink-palm.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "pink-rose", type: "digital", title: "Pink Rose", price: 50, image: "/previews/pink-rose.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "porch-drapes", type: "digital", title: "Porch Drapes", price: 50, image: "/previews/porch-drapes.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "porch-light", type: "digital", title: "Porch Light", price: 50, image: "/previews/porch-light.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "red-car", type: "digital", title: "Red Car", price: 50, image: "/previews/red-car.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "red-roses", type: "digital", title: "Red Roses", price: 50, image: "/previews/red-roses.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "rose-garden", type: "digital", title: "Rose Garden", price: 50, image: "/previews/rose-garden.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "rose-in-hand", type: "digital", title: "Rose in Hand", price: 50, image: "/previews/rose-in-hand.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "rose-on-building", type: "digital", title: "Rose on Building", price: 50, image: "/previews/rose-on-building.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "roses", type: "digital", title: "Roses", price: 50, image: "/previews/roses.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "screens", type: "digital", title: "Screens", price: 50, image: "/previews/screens.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "shine-bright", type: "digital", title: "Shine Bright", price: 50, image: "/previews/shine-bright.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "sunflower-high", type: "digital", title: "Sunflower High", price: 50, image: "/previews/sunflower-high.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "sunflower-white-house", type: "digital", title: "Sunflower, White House", price: 50, image: "/previews/sunflower-white-house.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "sunrise", type: "digital", title: "Sunrise", price: 50, image: "/previews/sunrise.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "swamp-trees", type: "digital", title: "Swamp Trees", price: 50, image: "/previews/swamp-trees.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "tassles", type: "digital", title: "Tassles", price: 50, image: "/previews/tassles.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "teardrop-on-leaf", type: "digital", title: "Teardrop on Leaf", price: 50, image: "/previews/teardrop-on-leaf.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "thread-of-fate", type: "digital", title: "Thread of Fate", price: 50, image: "/previews/thread-of-fate.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "too-close-to-the-sun", type: "digital", title: "Too Close to the Sun", price: 50, image: "/previews/too-close-to-the-sun.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "tower-palm", type: "digital", title: "Tower Palm", price: 50, image: "/previews/tower-palm.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "tree-magic", type: "digital", title: "Tree Magic", price: 50, image: "/previews/tree-magic.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "two-flowers", type: "digital", title: "Two Flowers", price: 50, image: "/previews/two-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "white-and-blue", type: "digital", title: "White and Blue", price: 50, image: "/previews/white-and-blue.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "wildflower", type: "digital", title: "Wildflower", price: 50, image: "/previews/wildflower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "wires", type: "digital", title: "Wires", price: 50, image: "/previews/wires.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "yellow-and-blue", type: "digital", title: "Yellow and Blue", price: 50, image: "/previews/yellow-and-blue.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "yellow-flower", type: "digital", title: "Yellow Flower", price: 50, image: "/previews/yellow-flower.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "yellow-flowers", type: "digital", title: "Yellow Flowers", price: 50, image: "/previews/yellow-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "yellow-on-blue", type: "digital", title: "Yellow on Blue", price: 50, image: "/previews/yellow-on-blue.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "yoni-flowers", type: "digital", title: "Yoni Flowers", price: 50, image: "/previews/yoni-flowers.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },
  { id: "you-are-safe-with-me", type: "digital", title: "You Are Safe With Me", price: 50, image: "/previews/you-are-safe-with-me.jpg", fileUrl: "PENDING_TIFF_UPLOAD" },

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
