-- Ensure products get an SKU when inserted without one.
-- Run after 017_checkout_active_stock_guard.sql.

alter table public.products
  alter column sku set default ('PWL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
