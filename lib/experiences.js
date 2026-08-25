// The one thing that's actually for sale here: a pack of 3 plays for $1,
// spendable across any of the three interactive features below (the
// candle wall, the marquee, and the oracle -- all ported over from
// coven-site's design language). 25c/play isn't possible on its own --
// Stripe won't process a card/Apple Pay charge under $0.50 -- so instead
// of pricing per play, one $1 purchase grants a balance of 3 plays that
// gets spent down across whichever features someone actually uses.
//
// Play balance itself lives in the browser (localStorage) since there's
// no login here -- see PLAYS_STORAGE_KEY in app/page.js. That's an honest
// tradeoff: it's per-browser, not account-wide, and someone technical
// could inspect network requests to find ways around it, the same way
// coven-site's owner-passcode gate isn't airtight either. Fine for a 50c-
// $1 novelty feature; worth a real backend if it ever needs to be bulletproof.

export const PLAY_PACK = {
  id: "play-pack",
  title: "3 Plays",
  blurb: "3 plays across the candle, the marquee, and the oracle.",
  price: 100,
  playsGranted: 3,
};

export const FEATURES = [
  {
    id: "light-a-candle",
    kind: "candle",
    title: "Light a Candle",
    blurb: "make a prayer or a wish. watch it light, just for you.",
  },
  {
    id: "flip-the-marquee",
    kind: "marquee",
    title: "The Marquee",
    blurb: "flip the sign — it scrambles, then settles on a line.",
  },
  {
    id: "ask-the-oracle",
    kind: "oracle",
    title: "Ask the Oracle",
    blurb: "bring a question. the oracle answers once, in its own voice.",
  },
];

export function getExperience(id) {
  if (id === PLAY_PACK.id) return PLAY_PACK;
  return null;
}
