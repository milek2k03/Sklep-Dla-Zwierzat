-- Pawly secure backend baseline.
-- Run in Supabase SQL editor before enabling the production backend.

create extension if not exists pgcrypto;

do $$
begin
  create type public.order_status as enum ('new', 'confirmed', 'paid', 'shipped', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'admin') default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PAWLY-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8))),
  status public.order_status not null default 'new',
  customer_full_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_method text not null,
  delivery_address text not null,
  pickup_point text,
  notes text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  delivery_cost numeric(10, 2) not null check (delivery_cost >= 0),
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null check (payment_method = 'manual') default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_slug text not null,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Admins can read their own admin profile" on public.admin_profiles;
create policy "Admins can read their own admin profile"
on public.admin_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can update order status" on public.orders;
create policy "Admins can update order status"
on public.orders
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

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

-- No anon insert/select policies are intentionally created.
-- Public order creation goes through Next.js /api/orders where data is
-- server-validated and written with the server-only service role key.

-- After creating your Supabase Auth user, grant admin access manually:
-- insert into public.admin_profiles (user_id)
-- values ('YOUR_AUTH_USER_UUID');
