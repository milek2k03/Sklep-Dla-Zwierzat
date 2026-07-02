-- Pawly product catalog.
-- Run after 001_secure_store.sql.

create table if not exists public.products (
  sku text primary key default ('PWL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  slug text not null unique,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  category text not null check (category in ('Spacer', 'Auto', 'Dom', 'Zestawy')),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  description text not null,
  tag text,
  features text[] not null default '{}',
  is_active boolean not null default true,
  is_bundle boolean not null default false,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  alter column sku set default ('PWL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

update public.products
set stock_quantity = 0
where stock_quantity is null;

alter table public.products
  alter column stock_quantity set default 0,
  alter column stock_quantity set not null;

create table if not exists public.product_bundle_items (
  bundle_sku text not null references public.products(sku) on delete cascade,
  component_sku text not null references public.products(sku) on delete restrict,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default now(),
  primary key (bundle_sku, component_sku),
  check (bundle_sku <> component_sku)
);

create index if not exists products_active_category_idx on public.products (is_active, category);
create index if not exists products_slug_idx on public.products (slug);
create index if not exists product_bundle_items_component_idx on public.product_bundle_items (component_sku);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_bundle_items enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Public can read active bundle items" on public.product_bundle_items;
create policy "Public can read active bundle items"
on public.product_bundle_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products bundle
    where bundle.sku = bundle_sku
      and bundle.is_active
  )
  or exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can manage bundle items" on public.product_bundle_items;
create policy "Admins can manage bundle items"
on public.product_bundle_items
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

insert into public.products (
  sku,
  slug,
  name,
  price,
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
) values
  ('PWL-BND-SPACER-PREMIUM', 'zestaw-spacer-premium', 'Zestaw Spacer Premium', 129.99, 169.99, 'Zestawy', 4.9, 128, 'Kompletny zestaw na codzienne spacery z psem.', 'Bestseller', array['saszetka na smaczki', 'składana miska', 'etui na woreczki', 'wygoda na każdy spacer'], true, true, 12),
  ('PWL-BND-AUTO-CLEAN', 'zestaw-czyste-auto', 'Zestaw Czyste Auto', 149.99, null, 'Auto', 4.8, 96, 'Zestaw dla osób, które podróżują z psem samochodem.', null, array['pokrowiec do auta', 'mniej sierści na siedzeniach', 'łatwiejsze sprzątanie'], true, true, 8),
  ('PWL-ACC-TREAT-POUCH', 'saszetka-na-smaczki', 'Saszetka na smaczki', 49.99, null, 'Spacer', 4.8, 112, 'Praktyczna saszetka na przysmaki podczas spaceru i treningu.', null, array['lekka i wygodna', 'szybki dostęp do nagród', 'sprawdza się na treningu'], true, false, 4),
  ('PWL-ACC-BAG-HOLDER', 'etui-na-woreczki', 'Etui na woreczki', 29.99, null, 'Spacer', 4.7, 89, 'Małe etui, które przypniesz do smyczy lub torby.', null, array['kompaktowy format', 'łatwe przypięcie', 'woreczki zawsze pod ręką'], true, false, 24),
  ('PWL-ACC-FOLD-BOWL', 'skladana-miska-silikonowa', 'Składana miska silikonowa', 39.99, null, 'Spacer', 4.9, 74, 'Lekka miska na wodę lub karmę w podróży.', null, array['składana konstrukcja', 'łatwa do opłukania', 'dobra na dłuższe spacery'], true, false, 1),
  ('PWL-HOME-BOWL-MAT', 'mata-pod-miski', 'Mata pod miski', 59.99, null, 'Dom', 4.8, 64, 'Pomaga utrzymać porządek przy miskach psa.', null, array['chroni podloge', 'łatwe czyszczenie', 'minimalistyczny wygląd'], true, false, 15),
  ('PWL-HOME-MICRO-TOWEL', 'recznik-z-mikrofibry', 'Ręcznik z mikrofibry', 39.99, null, 'Dom', 4.6, 57, 'Przydatny po spacerze, deszczu lub kąpieli.', null, array['szybko chlonie wilgoc', 'miękki dla sierści', 'zajmuje mało miejsca'], true, false, 7),
  ('PWL-ACC-DOG-BANDANA', 'bandana-dla-psa', 'Bandana dla psa', 24.99, null, 'Spacer', 4.7, 46, 'Prosty dodatek dla psa, dobry do zdjęć i spacerów.', null, array['lekki materiał', 'prosty sposób zapięcia', 'subtelny spacerowy dodatek'], true, false, 18)
on conflict (sku) do update set
  slug = excluded.slug,
  name = excluded.name,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  category = excluded.category,
  rating = excluded.rating,
  review_count = excluded.review_count,
  description = excluded.description,
  tag = excluded.tag,
  features = excluded.features,
  is_active = excluded.is_active,
  is_bundle = excluded.is_bundle,
  stock_quantity = excluded.stock_quantity;

insert into public.product_bundle_items (bundle_sku, component_sku, quantity) values
  ('PWL-BND-SPACER-PREMIUM', 'PWL-ACC-TREAT-POUCH', 1),
  ('PWL-BND-SPACER-PREMIUM', 'PWL-ACC-FOLD-BOWL', 1),
  ('PWL-BND-SPACER-PREMIUM', 'PWL-ACC-BAG-HOLDER', 1)
on conflict (bundle_sku, component_sku) do update set
  quantity = excluded.quantity;
