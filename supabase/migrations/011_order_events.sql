-- Order status/event history.
-- Run after 010_order_shipping_tracking.sql.

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'status_changed',
      'payment_paid',
      'payment_failed',
      'checkout_expired',
      'stock_restored',
      'tracking_updated',
      'email_sent'
    )
  ),
  from_status public.order_status,
  to_status public.order_status,
  actor_type text not null check (actor_type in ('admin', 'stripe', 'system')),
  actor_id text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_created_idx
on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists "Admins can read order events" on public.order_events;
create policy "Admins can read order events"
on public.order_events
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
