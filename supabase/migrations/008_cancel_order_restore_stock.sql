-- Restore stock when an unpaid order is cancelled or Stripe Checkout expires.
-- Run after 007_stripe_checkout.sql.

alter table public.orders
  add column if not exists stock_restored_at timestamptz;

create or replace function public.cancel_order_and_restore_stock(
  p_order_id uuid default null,
  p_checkout_session_id text default null
)
returns table (
  order_id uuid,
  status public.order_status,
  stock_restored_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
begin
  if p_order_id is null and p_checkout_session_id is null then
    raise exception 'ORDER_CANCEL_TARGET_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into target_order
  from public.orders
  where
    (p_order_id is not null and id = p_order_id)
    or (
      p_checkout_session_id is not null
      and stripe_checkout_session_id = p_checkout_session_id
    )
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if target_order.status in ('paid', 'shipped') then
    raise exception 'ORDER_CANNOT_RESTORE_PAID_STOCK' using errcode = 'P0001';
  end if;

  if target_order.stock_restored_at is null then
    update public.products as product
    set stock_quantity = product.stock_quantity + restored.quantity
    from (
      select product_slug, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = target_order.id
      group by product_slug
    ) as restored
    where product.slug = restored.product_slug;
  end if;

  update public.orders
  set
    status = 'cancelled'::public.order_status,
    stock_restored_at = coalesce(public.orders.stock_restored_at, now())
  where id = target_order.id
  returning
    public.orders.id,
    public.orders.status,
    public.orders.stock_restored_at
  into order_id, status, stock_restored_at;

  return next;
end;
$$;

revoke all on function public.cancel_order_and_restore_stock(uuid, text) from public;
revoke all on function public.cancel_order_and_restore_stock(uuid, text) from anon;
revoke all on function public.cancel_order_and_restore_stock(uuid, text) from authenticated;
grant execute on function public.cancel_order_and_restore_stock(uuid, text) to service_role;
