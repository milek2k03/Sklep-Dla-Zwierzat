-- Lightweight conversion analytics for the admin panel.
-- Run after 029_clean_product_copy.sql.

create table if not exists public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'page_view',
      'product_view',
      'add_to_cart',
      'checkout_started',
      'order_created',
      'order_paid'
    )
  ),
  visitor_id text not null,
  session_id text not null,
  page_path text,
  page_title text,
  referrer text,
  product_slug text,
  product_name text,
  product_category text,
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  amount numeric(10, 2),
  quantity integer check (quantity is null or quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists conversion_events_created_idx
on public.conversion_events (created_at desc);

create index if not exists conversion_events_type_created_idx
on public.conversion_events (event_type, created_at desc);

create index if not exists conversion_events_product_created_idx
on public.conversion_events (product_slug, created_at desc)
where product_slug is not null;

create index if not exists conversion_events_session_created_idx
on public.conversion_events (session_id, created_at desc);

alter table public.conversion_events enable row level security;

drop policy if exists "Admins can manage conversion events" on public.conversion_events;
create policy "Admins can manage conversion events"
on public.conversion_events
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
