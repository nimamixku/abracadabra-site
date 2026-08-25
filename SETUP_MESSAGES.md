# One-time setup: oracle, DM inbox, stories

ABRACADABRA's public shop (the shuffle feed + Apple Pay checkout) works the
moment you set your Stripe keys. Three extra features need a bit more
setup because they need somewhere to store data: the **oracle** (needs an
Anthropic API key), the **DM inbox** (needs a database), and **stories**
(also needs a database). Do this once per environment (once for your
local machine, once in Vercel).

## 1. Stripe (required for any of this to take payments)

1. Go to https://dashboard.stripe.com/apikeys
2. Copy the **Secret key** → `STRIPE_SECRET_KEY`
3. Copy the **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Test keys (`sk_test_...` / `pk_test_...`) work fine to try things out.
   Switch to live keys when you're ready to take real money.

## 2. A database (for the oracle's play-tracking, the DM inbox, and stories)

Easiest path, inside your Vercel project:

1. Open the project → **Storage** tab → **Create Database** → **Postgres**
   (this is Neon under the hood — free tier is plenty to start).
2. Connect it to this project. Vercel automatically adds a `DATABASE_URL`
   (or `POSTGRES_URL`) environment variable for you — nothing else to do.
3. Working locally too? Run `vercel env pull .env.local` from the project
   folder to copy that same connection string down to your machine.

## 3. Anthropic API key (for the oracle)

1. Go to https://console.anthropic.com/settings/keys
2. Create a key → `ANTHROPIC_API_KEY`
3. `ANTHROPIC_ORACLE_MODEL` is optional — leave it unset unless you want
   to pin a specific model.

## 4. Your keeper passcode

`ABRACADABRA_KEEPER_PASSCODE` is a phrase only you know — set it to
whatever you like. It's what lets you sign in as the shop owner to read
your DM inbox and post stories; nobody else can get in without it.

## Where to put these

- **Locally**: copy `.env.local.example` to `.env.local` and fill in the
  real values. Never commit `.env.local` — it's already gitignored.
- **On Vercel**: Project → Settings → Environment Variables → add each one
  (Stripe keys, `ANTHROPIC_API_KEY`, `ABRACADABRA_KEEPER_PASSCODE` — the
  database ones are added automatically per step 2). Redeploy after adding
  them.

## What still works without any of this

The shop itself — the shuffling feed, product pages, and Apple Pay
checkout for both art and clothing — needs only the Stripe keys. The
oracle, DM inbox, and stories simply won't respond (or won't be reachable)
until the database and Anthropic key are set, so you can ship the shop
first and turn these on whenever you're ready.
