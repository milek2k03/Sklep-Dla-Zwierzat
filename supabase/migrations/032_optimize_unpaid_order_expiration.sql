-- Speed up the cron lookup for unpaid Stripe orders that should be cancelled.
-- Run after 031_fix_order_stock_restore_functions.sql.

create index if not exists orders_unpaid_expiration_lookup_idx
on public.orders (created_at asc, id)
where payment_method = 'stripe'
  and status in ('new'::public.order_status, 'confirmed'::public.order_status)
  and stock_restored_at is null;
