-- Shipment tracking fields.
-- Run after 009_order_email_timestamps.sql.

alter table public.orders
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists shipping_email_sent_at timestamptz;

create index if not exists orders_shipped_at_idx
on public.orders (shipped_at desc)
where shipped_at is not null;
