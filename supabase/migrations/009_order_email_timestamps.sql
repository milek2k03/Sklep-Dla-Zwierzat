-- Transactional email delivery markers.
-- Run after 008_cancel_order_restore_stock.sql.

alter table public.orders
  add column if not exists customer_email_sent_at timestamptz,
  add column if not exists admin_email_sent_at timestamptz;
