-- Ensure demo products have stock after the stock column was made required.
-- Run after 004_product_images_categories_import.sql.

update public.products
set stock_quantity = case sku
  when 'PWL-BND-SPACER-PREMIUM' then 12
  when 'PWL-BND-AUTO-CLEAN' then 8
  when 'PWL-ACC-TREAT-POUCH' then 4
  when 'PWL-ACC-BAG-HOLDER' then 24
  when 'PWL-ACC-FOLD-BOWL' then 1
  when 'PWL-HOME-BOWL-MAT' then 15
  when 'PWL-HOME-MICRO-TOWEL' then 7
  when 'PWL-ACC-DOG-BANDANA' then 18
  else stock_quantity
end
where sku in (
  'PWL-BND-SPACER-PREMIUM',
  'PWL-BND-AUTO-CLEAN',
  'PWL-ACC-TREAT-POUCH',
  'PWL-ACC-BAG-HOLDER',
  'PWL-ACC-FOLD-BOWL',
  'PWL-HOME-BOWL-MAT',
  'PWL-HOME-MICRO-TOWEL',
  'PWL-ACC-DOG-BANDANA'
);
