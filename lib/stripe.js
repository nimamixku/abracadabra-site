import Stripe from "stripe";

// Server-only Stripe client. STRIPE_SECRET_KEY lives in your environment
// variables (.env.local while developing, and in Vercel's Project Settings
// -> Environment Variables once deployed) -- never commit the real key.
let stripe;

export function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.local.example)."
      );
    }
    stripe = new Stripe(key);
  }
  return stripe;
}
