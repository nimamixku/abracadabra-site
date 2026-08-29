-- How this artist's shop sells: standard card/Apple Pay (via Stripe
-- Connect, live today) or crypto/NFT (via Crossmint, Phase 6 -- not
-- built yet). Captured once at shop creation, right after shop
-- name/URL, so there's no separate "enable NFTs" step buried later in
-- settings. Product-level `products.type = 'nft'` (see 001_init.sql)
-- is the actual per-item mechanism; this column is the tenant-level
-- opt-in the plan describes -- a crypto-mode shop can still list and
-- sell ordinary digital_image/digital_audio/physical products today,
-- it's just flagged as intending to add NFT products once Crossmint
-- checkout ships.
alter table tenants
  add column if not exists selling_mode text not null default 'fiat'
    check (selling_mode in ('fiat', 'crypto'));
