-- Physical orders need a real address to ship to -- neither this app nor
-- its single-tenant predecessor ever actually captured one (Apple/Google
-- Pay's own shipping sheet collected it in the wallet UI when offered,
-- but the code never read it back out or stored it anywhere). Storefront
-- checkout now collects it directly (see StorefrontFeed.js's "ship it
-- here" form) so it never depends on a wallet's own address prompt --
-- which also side-steps that prompt's domain-verification requirements
-- not covering arbitrary *.localhost dev subdomains. Null for every
-- digital order; a small free-form JSON object for a physical one
-- (name/line1/line2/city/state/postal_code/country) rather than five new
-- columns, same reasoning as products.details.
alter table orders
  add column if not exists shipping_address jsonb;
