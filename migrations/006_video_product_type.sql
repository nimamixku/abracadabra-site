-- Adds the 'video' product type: free-to-watch, with an optional
-- per-piece donate button (see the plan's video+donate design). No new
-- columns needed for pricing or donations -- price_cents is simply 0
-- for a video (never gated behind a purchase), and the donate
-- toggle/suggested amount live in the existing `details` jsonb column,
-- exactly what that column was designed for ("type-specific fields ...
-- live in `details` so new product types don't need a schema
-- migration" -- see the comment above the products table in
-- 001_init.sql). This migration only widens the two check constraints
-- that hard-code the allowed value lists.
--
-- product_files gets its own new kind, 'video', rather than reusing
-- 'full' -- 'full' means "gated behind a completed purchase" (see
-- /api/download's PaymentIntent check), which is the wrong model for a
-- video that's public and free to watch from the moment it's posted.
--
-- Postgres has no ALTER ... ADD VALUE for a plain check constraint, so
-- this drops and recreates each one with the wider list. Both
-- constraint names below are Postgres's own default naming for an
-- unnamed inline `check (...)` clause on a single column
-- (<table>_<column>_check) -- exactly how 001_init.sql defined them,
-- with no explicit name given. If a name here doesn't match what's
-- actually in the database, this whole file fails and rolls back
-- inside its own transaction (see scripts/migrate.mjs) -- nothing
-- partial, nothing broken, just re-check the real name with:
--   select conname from pg_constraint where conrelid = 'products'::regclass and contype = 'c';
--   select conname from pg_constraint where conrelid = 'product_files'::regclass and contype = 'c';

alter table products
  drop constraint products_type_check;
alter table products
  add constraint products_type_check
  check (type in ('digital_image', 'digital_audio', 'physical', 'nft', 'video'));

alter table product_files
  drop constraint product_files_kind_check;
alter table product_files
  add constraint product_files_kind_check
  check (kind in ('full', 'preview_image', 'preview_clip', 'video'));
