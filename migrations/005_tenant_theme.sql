-- Per-tenant color palette (plan's "customizable palette, nothing else
-- is" section): exactly two overridable choices, background and text
-- color -- every other CSS variable in globals.css (--card, --accent,
-- --success, etc.) stays fixed platform-wide. Both nullable and default
-- to nothing: null means "use the platform's own --bg/--ink," so a shop
-- that never touches this setting looks identical to every other one,
-- and existing tenants don't need a backfill.
alter table tenants
  add column if not exists bg_color text,
  add column if not exists ink_color text;
