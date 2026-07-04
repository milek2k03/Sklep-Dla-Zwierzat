-- Product categories and product image storage.
-- Run after 003_discount_codes.sql.

create table if not exists public.product_categories (
  name text primary key,
  created_at timestamptz not null default now()
);

insert into public.product_categories (name) values
  ('Dla psa'),
  ('Dla kota'),
  ('Spacer i podróż'),
  ('Dom'),
  ('Auto'),
  ('Zestawy')
on conflict (name) do nothing;

insert into public.product_categories (name)
select distinct category
from public.products
where category is not null
on conflict (name) do nothing;

alter table public.products
  drop constraint if exists products_category_check,
  add column if not exists image_url text;

create index if not exists products_category_idx on public.products (category);

alter table public.product_categories enable row level security;

drop policy if exists "Public can read product categories" on public.product_categories;
create policy "Public can read product categories"
on public.product_categories
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage product categories" on public.product_categories;
create policy "Admins can manage product categories"
on public.product_categories
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

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set
  public = excluded.public;
