-- Align Pawly catalog copy and categories with accessories for dogs and cats.
-- Run after 024_product_purchase_price_profit.sql.

alter table public.products
  drop constraint if exists products_category_check;

insert into public.product_categories (name) values
  ('Dla psa'),
  ('Dla kota'),
  ('Spacer i podróż'),
  ('Dom'),
  ('Auto'),
  ('Zestawy')
on conflict (name) do nothing;

update public.products
set category = 'Spacer i podróż'
where category = 'Spacer';

with catalog(
  sku,
  slug,
  name,
  price,
  purchase_price,
  compare_at_price,
  category,
  rating,
  review_count,
  description,
  tag,
  features,
  is_active,
  is_bundle,
  stock_quantity
) as (
  values
    ('PWL-BND-SPACER-DOG', 'zestaw-spacer-premium-dla-psa', 'Zestaw Spacer Premium dla psa', 129.99, 74.99, 169.99, 'Zestawy', 4.9, 128, 'Kompletny zestaw na codzienne spacery i krótkie wyjazdy z psem.', 'Bestseller', array['saszetka na smaczki', 'składana miska silikonowa', 'etui na woreczki', 'wygoda na spacer i podróż'], true, true, 12),
    ('PWL-BND-AUTO-DOG', 'zestaw-czyste-auto-dla-psa', 'Zestaw Czyste Auto dla psa', 149.99, 84.99, null, 'Auto', 4.8, 96, 'Zestaw dla osób, które podróżują samochodem z psem i chcą utrzymać porządek.', null, array['pokrowiec do auta', 'mniej sierści i piasku na siedzeniach', 'łatwiejsze sprzątanie po podróży'], true, true, 8),
    ('PWL-HOME-BOWL-MAT', 'mata-pod-miski-dla-psa-lub-kota', 'Mata pod miski dla psa lub kota', 59.99, 21.99, null, 'Dom', 4.8, 64, 'Pomaga utrzymać porządek przy miskach psa lub kota.', null, array['chroni podłogę', 'łatwe czyszczenie', 'minimalistyczny wygląd'], true, false, 15),
    ('PWL-TRAVEL-FOLD-BOWL', 'skladana-miska-silikonowa', 'Składana miska silikonowa', 39.99, 16.99, null, 'Spacer i podróż', 4.9, 74, 'Lekka miska na wodę lub karmę dla psa albo kota w podróży.', null, array['składana konstrukcja', 'łatwa do opłukania', 'dobra na spacer, auto i wyjazd'], true, false, 1),
    ('PWL-HOME-MICRO-TOWEL', 'recznik-z-mikrofibry-dla-pupila', 'Ręcznik z mikrofibry dla pupila', 39.99, 15.99, null, 'Dom', 4.6, 57, 'Przydatny po spacerze, deszczu, kąpieli albo podróży z pupilem.', null, array['szybko chłonie wilgoć', 'miękki dla sierści', 'zajmuje mało miejsca'], true, false, 7),
    ('PWL-TRAVEL-PET-ORGANIZER', 'organizer-na-akcesoria-pupila', 'Organizer na akcesoria pupila', 69.99, 29.99, null, 'Spacer i podróż', 4.7, 81, 'Poręczny organizer na smycz, woreczki, przysmaki i drobiazgi dla pupila.', null, array['miejsce na spacerowe akcesoria', 'łatwy dostęp w domu i aucie', 'pomaga utrzymać porządek'], true, false, 10),
    ('PWL-ACC-PET-BANDANA', 'bandana-dla-psa-lub-kota', 'Bandana dla psa lub kota', 24.99, 7.99, null, 'Dla psa', 4.7, 46, 'Prosty dodatek dla psa lub kota, dobry do zdjęć i spacerów.', null, array['lekki materiał', 'prosty sposób zapięcia', 'subtelny spacerowy dodatek'], true, false, 18),
    ('PWL-BND-CAT-HOME', 'zestaw-domowy-dla-kota', 'Zestaw Domowy dla kota', 119.99, 62.99, null, 'Dla kota', 4.8, 69, 'Zestaw prostych akcesoriów do wygodnej domowej rutyny kota.', 'Nowość', array['mata pod miski', 'ręcznik z mikrofibry', 'organizer na drobiazgi', 'spójny zestaw do domu'], true, true, 9)
)
update public.products as product
set
  slug = catalog.slug,
  name = catalog.name,
  price = catalog.price,
  purchase_price = catalog.purchase_price,
  compare_at_price = catalog.compare_at_price,
  category = catalog.category,
  rating = catalog.rating,
  review_count = catalog.review_count,
  description = catalog.description,
  tag = catalog.tag,
  features = catalog.features,
  is_active = catalog.is_active,
  is_bundle = catalog.is_bundle,
  stock_quantity = catalog.stock_quantity
from catalog
where product.sku = catalog.sku;

with legacy_catalog(
  sku,
  slug,
  name,
  price,
  purchase_price,
  compare_at_price,
  category,
  rating,
  review_count,
  description,
  tag,
  features,
  is_active,
  is_bundle,
  stock_quantity
) as (
  values
    ('PWL-BND-SPACER-PREMIUM', 'zestaw-spacer-premium-dla-psa', 'Zestaw Spacer Premium dla psa', 129.99, 74.99, 169.99, 'Zestawy', 4.9, 128, 'Kompletny zestaw na codzienne spacery i krótkie wyjazdy z psem.', 'Bestseller', array['saszetka na smaczki', 'składana miska silikonowa', 'etui na woreczki', 'wygoda na spacer i podróż'], true, true, 12),
    ('PWL-BND-AUTO-CLEAN', 'zestaw-czyste-auto-dla-psa', 'Zestaw Czyste Auto dla psa', 149.99, 84.99, null, 'Auto', 4.8, 96, 'Zestaw dla osób, które podróżują samochodem z psem i chcą utrzymać porządek.', null, array['pokrowiec do auta', 'mniej sierści i piasku na siedzeniach', 'łatwiejsze sprzątanie po podróży'], true, true, 8),
    ('PWL-HOME-BOWL-MAT', 'mata-pod-miski-dla-psa-lub-kota', 'Mata pod miski dla psa lub kota', 59.99, 21.99, null, 'Dom', 4.8, 64, 'Pomaga utrzymać porządek przy miskach psa lub kota.', null, array['chroni podłogę', 'łatwe czyszczenie', 'minimalistyczny wygląd'], true, false, 15),
    ('PWL-ACC-FOLD-BOWL', 'skladana-miska-silikonowa', 'Składana miska silikonowa', 39.99, 16.99, null, 'Spacer i podróż', 4.9, 74, 'Lekka miska na wodę lub karmę dla psa albo kota w podróży.', null, array['składana konstrukcja', 'łatwa do opłukania', 'dobra na spacer, auto i wyjazd'], true, false, 1),
    ('PWL-HOME-MICRO-TOWEL', 'recznik-z-mikrofibry-dla-pupila', 'Ręcznik z mikrofibry dla pupila', 39.99, 15.99, null, 'Dom', 4.6, 57, 'Przydatny po spacerze, deszczu, kąpieli albo podróży z pupilem.', null, array['szybko chłonie wilgoć', 'miękki dla sierści', 'zajmuje mało miejsca'], true, false, 7),
    ('PWL-ACC-BAG-HOLDER', 'organizer-na-akcesoria-pupila', 'Organizer na akcesoria pupila', 69.99, 29.99, null, 'Spacer i podróż', 4.7, 81, 'Poręczny organizer na smycz, woreczki, przysmaki i drobiazgi dla pupila.', null, array['miejsce na spacerowe akcesoria', 'łatwy dostęp w domu i aucie', 'pomaga utrzymać porządek'], true, false, 10),
    ('PWL-ACC-DOG-BANDANA', 'bandana-dla-psa-lub-kota', 'Bandana dla psa lub kota', 24.99, 7.99, null, 'Dla psa', 4.7, 46, 'Prosty dodatek dla psa lub kota, dobry do zdjęć i spacerów.', null, array['lekki materiał', 'prosty sposób zapięcia', 'subtelny spacerowy dodatek'], true, false, 18),
    ('PWL-ACC-TREAT-POUCH', 'zestaw-domowy-dla-kota', 'Zestaw Domowy dla kota', 119.99, 62.99, null, 'Dla kota', 4.8, 69, 'Zestaw prostych akcesoriów do wygodnej domowej rutyny kota.', 'Nowość', array['mata pod miski', 'ręcznik z mikrofibry', 'organizer na drobiazgi', 'spójny zestaw do domu'], true, true, 9)
)
update public.products as product
set
  slug = legacy_catalog.slug,
  name = legacy_catalog.name,
  price = legacy_catalog.price,
  purchase_price = legacy_catalog.purchase_price,
  compare_at_price = legacy_catalog.compare_at_price,
  category = legacy_catalog.category,
  rating = legacy_catalog.rating,
  review_count = legacy_catalog.review_count,
  description = legacy_catalog.description,
  tag = legacy_catalog.tag,
  features = legacy_catalog.features,
  is_active = legacy_catalog.is_active,
  is_bundle = legacy_catalog.is_bundle,
  stock_quantity = legacy_catalog.stock_quantity
from legacy_catalog
where product.sku = legacy_catalog.sku
  and not exists (
    select 1
    from public.products as conflicting_product
    where conflicting_product.slug = legacy_catalog.slug
      and conflicting_product.sku <> product.sku
  );

delete from public.product_bundle_items
where bundle_sku in (
  'PWL-BND-SPACER-DOG',
  'PWL-BND-CAT-HOME',
  'PWL-BND-SPACER-PREMIUM',
  'PWL-ACC-TREAT-POUCH'
);

insert into public.product_bundle_items (bundle_sku, component_sku, quantity)
select bundle_sku, component_sku, quantity
from (
  values
    ('PWL-BND-SPACER-DOG', 'PWL-TRAVEL-FOLD-BOWL', 1),
    ('PWL-BND-SPACER-DOG', 'PWL-TRAVEL-PET-ORGANIZER', 1),
    ('PWL-BND-CAT-HOME', 'PWL-HOME-BOWL-MAT', 1),
    ('PWL-BND-CAT-HOME', 'PWL-HOME-MICRO-TOWEL', 1),
    ('PWL-BND-CAT-HOME', 'PWL-TRAVEL-PET-ORGANIZER', 1),
    ('PWL-BND-SPACER-PREMIUM', 'PWL-ACC-FOLD-BOWL', 1),
    ('PWL-BND-SPACER-PREMIUM', 'PWL-ACC-BAG-HOLDER', 1),
    ('PWL-ACC-TREAT-POUCH', 'PWL-HOME-BOWL-MAT', 1),
    ('PWL-ACC-TREAT-POUCH', 'PWL-HOME-MICRO-TOWEL', 1),
    ('PWL-ACC-TREAT-POUCH', 'PWL-ACC-BAG-HOLDER', 1)
) as item(bundle_sku, component_sku, quantity)
where exists (
    select 1
    from public.products as bundle
    where bundle.sku = item.bundle_sku
  )
  and exists (
    select 1
    from public.products as component
    where component.sku = item.component_sku
  )
on conflict (bundle_sku, component_sku) do update set
  quantity = excluded.quantity;

delete from public.product_categories
where name = 'Spacer';
