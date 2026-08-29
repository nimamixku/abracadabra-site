-- Multi-tenant platform schema. Applied via scripts/migrate.mjs.
-- Replaces the single-tenant hardcoded lib/products.js + lib/product-files.js
-- + lib/ownerAuth.js with real per-artist accounts and a DB-backed catalog.

create table if not exists users (
  id            bigserial primary key,
  email         text not null unique,
  created_at    timestamptz not null default now()
);

-- One-time magic-link tokens. Only the hash is stored -- same reasoning as
-- lib/ownerAuth.js's passcode hashing: the raw token that goes out over
-- email never sits anywhere we could leak it from at rest.
create table if not exists login_tokens (
  id            bigserial primary key,
  user_id       bigint not null references users(id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists login_tokens_user_id_idx on login_tokens(user_id);

-- Long-lived session, referenced by a cookie on the dashboard host only
-- (never the wildcard tenant domain -- see lib/auth.js).
create table if not exists sessions (
  id            bigserial primary key,
  user_id       bigint not null references users(id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on sessions(user_id);

-- One per artist. owner_user_id is who can manage it today; kept separate
-- from "users" in case multi-user shops ever make sense later.
create table if not exists tenants (
  id                          bigserial primary key,
  owner_user_id               bigint not null references users(id) on delete cascade,
  slug                        text not null unique,
  shop_name                   text not null,
  custom_domain               text unique,
  stripe_connect_account_id   text unique,
  stripe_connect_status       text not null default 'not_started',
  stripe_customer_id          text unique,
  platform_subscription_id    text,
  platform_subscription_status text not null default 'trialing',
  platform_plan               text not null default 'free',
  platform_fee_bps            integer not null default 500,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists tenants_owner_user_id_idx on tenants(owner_user_id);

-- type-specific fields (sizes/shipping_cents for physical,
-- preview_clip_seconds for digital_audio, etc.) live in `details` so new
-- product types don't need a schema migration.
create table if not exists products (
  id            bigserial primary key,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  type          text not null check (type in ('digital_image', 'digital_audio', 'physical', 'nft')),
  title         text not null,
  description   text not null default '',
  price_cents   integer not null check (price_cents >= 0),
  currency      text not null default 'usd',
  active        boolean not null default true,
  sort_order    integer not null default 0,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_tenant_id_idx on products(tenant_id);
create index if not exists products_tenant_active_idx on products(tenant_id, active);

-- Tenant-namespaced R2 keys, replacing lib/product-files.js's hardcoded
-- id -> URL map. kind mirrors what a product actually needs: the gated
-- full-res file, the public preview image, and (for audio) a short
-- public preview clip.
create table if not exists product_files (
  id            bigserial primary key,
  product_id    bigint not null references products(id) on delete cascade,
  kind          text not null check (kind in ('full', 'preview_image', 'preview_clip')),
  r2_key        text not null,
  content_type  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists product_files_product_id_idx on product_files(product_id);

-- Source of truth linking a PaymentIntent to its tenant/Connect account,
-- written at intent-creation time -- never re-derived from client input.
-- This is what /api/download and /api/download-preview look up instead
-- of trusting a client-submitted tenant/product id.
create table if not exists orders (
  id                          bigserial primary key,
  tenant_id                   bigint not null references tenants(id) on delete restrict,
  product_id                  bigint not null references products(id) on delete restrict,
  stripe_payment_intent_id    text not null unique,
  stripe_connect_account_id   text not null,
  application_fee_cents       integer not null default 0,
  amount_cents                integer not null,
  currency                    text not null default 'usd',
  customer_email              text,
  status                      text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists orders_tenant_id_idx on orders(tenant_id);
create index if not exists orders_stripe_pi_idx on orders(stripe_payment_intent_id);

-- Webhook idempotency for both the Connect and platform-billing endpoints.
create table if not exists stripe_webhook_events (
  id                bigserial primary key,
  stripe_event_id   text not null unique,
  source            text not null check (source in ('connect', 'platform_billing')),
  type              text not null,
  processed_at      timestamptz not null default now()
);
