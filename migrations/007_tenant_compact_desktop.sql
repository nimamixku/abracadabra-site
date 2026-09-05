-- Per-shop opt-in exception to the plan's "layout stays uniform across
-- every shop, only color is customizable" rule (see globals.css/the
-- plan's design-ethos section). Reasoning for the exception, from the
-- founder directly: a real desktop monitor is a much bigger view than
-- a phone, and not every artist wants their storefront's photos/type
-- rendered at that larger size just because a visitor happens to be on
-- a desktop -- some want their shop to look and feel exactly like the
-- phone experience even there. Nullable/defaults to false: false means
-- "unchanged, same 640px-max desktop width as every shop had before
-- this setting existed" -- so an artist who never touches this looks
-- identical to how their shop already looked.
alter table tenants
  add column if not exists compact_desktop boolean not null default false;
