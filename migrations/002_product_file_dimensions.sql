-- Natural width/height for each product_files row, captured automatically
-- at upload time (see app/dashboard/ProductManager.js). Lets the future
-- tenant storefront (app/_sites/[tenant]/page.js, Phase 4) size each feed
-- card to the photo's real aspect ratio instead of Instagram-style forced
-- cropping -- no manual "pick a size" step for the artist, and no layout
-- shift once the image loads because the card already knows its shape.
-- Nullable: only meaningful for image kinds (preview_image), and old rows
-- (or a failed dimension read) simply fall back to a default aspect ratio
-- client-side.
alter table product_files add column if not exists width_px integer;
alter table product_files add column if not exists height_px integer;
