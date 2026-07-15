-- Fix ambiguous order_id references in stock restore functions.
-- Run after 030_conversion_events.sql.

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
  from public.orders as target
  where
    (p_order_id is not null and target.id = p_order_id)
    or (
      p_checkout_session_id is not null
      and target.stripe_checkout_session_id = p_checkout_session_id
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
      select
        order_item.product_slug,
        sum(order_item.quantity)::integer as quantity
      from public.order_items as order_item
      where order_item.order_id = target_order.id
      group by order_item.product_slug
    ) as restored
    where product.slug = restored.product_slug;
  end if;

  update public.orders as updated_order
  set
    status = 'cancelled'::public.order_status,
    stock_restored_at = coalesce(updated_order.stock_restored_at, now())
  where updated_order.id = target_order.id
  returning
    updated_order.id,
    updated_order.status,
    updated_order.stock_restored_at
  into order_id, status, stock_restored_at;

  return next;
end;
$$;

revoke all on function public.cancel_order_and_restore_stock(uuid, text) from public;
revoke all on function public.cancel_order_and_restore_stock(uuid, text) from anon;
revoke all on function public.cancel_order_and_restore_stock(uuid, text) from authenticated;
grant execute on function public.cancel_order_and_restore_stock(uuid, text) to service_role;

create or replace function public.cancel_paid_order_after_refund(
  p_order_id uuid,
  p_refund_id text,
  p_refund_reason text default null
)
returns table (
  order_id uuid,
  status public.order_status,
  stock_restored_at timestamptz,
  stripe_refund_id text,
  refunded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
begin
  if p_order_id is null then
    raise exception 'ORDER_CANCEL_TARGET_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into target_order
  from public.orders as target
  where target.id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if target_order.status = 'shipped' then
    raise exception 'ORDER_CANNOT_REFUND_SHIPPED' using errcode = 'P0001';
  end if;

  if target_order.status = 'cancelled' then
    if target_order.stripe_refund_id is not null then
      order_id := target_order.id;
      status := target_order.status;
      stock_restored_at := target_order.stock_restored_at;
      stripe_refund_id := target_order.stripe_refund_id;
      refunded_at := target_order.refunded_at;
      return next;
      return;
    end if;

    raise exception 'ORDER_ALREADY_CANCELLED' using errcode = 'P0001';
  end if;

  if target_order.status <> 'paid' then
    raise exception 'ORDER_NOT_PAID' using errcode = 'P0001';
  end if;

  if target_order.stock_restored_at is null then
    update public.products as product
    set stock_quantity = product.stock_quantity + restored.quantity
    from (
      select
        order_item.product_slug,
        sum(order_item.quantity)::integer as quantity
      from public.order_items as order_item
      where order_item.order_id = target_order.id
      group by order_item.product_slug
    ) as restored
    where product.slug = restored.product_slug;
  end if;

  update public.orders as updated_order
  set
    status = 'cancelled'::public.order_status,
    stock_restored_at = coalesce(updated_order.stock_restored_at, now()),
    stripe_refund_id = coalesce(updated_order.stripe_refund_id, nullif(p_refund_id, '')),
    refunded_at = coalesce(updated_order.refunded_at, now()),
    refund_reason = nullif(p_refund_reason, '')
  where updated_order.id = target_order.id
  returning
    updated_order.id,
    updated_order.status,
    updated_order.stock_restored_at,
    updated_order.stripe_refund_id,
    updated_order.refunded_at
  into order_id, status, stock_restored_at, stripe_refund_id, refunded_at;

  return next;
end;
$$;

revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from public;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from anon;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from authenticated;
grant execute on function public.cancel_paid_order_after_refund(uuid, text, text) to service_role;
