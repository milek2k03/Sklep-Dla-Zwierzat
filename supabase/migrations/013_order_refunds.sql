-- Admin refunds for paid Stripe orders.
-- Run after 012_delivery_address_fields.sql.

alter table public.orders
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refund_email_sent_at timestamptz;

create unique index if not exists orders_stripe_refund_id_idx
on public.orders (stripe_refund_id)
where stripe_refund_id is not null;

alter table public.order_events
  drop constraint if exists order_events_event_type_check,
  add constraint order_events_event_type_check
  check (
    event_type in (
      'status_changed',
      'payment_paid',
      'payment_failed',
      'checkout_expired',
      'stock_restored',
      'tracking_updated',
      'email_sent',
      'refund_created'
    )
  );

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
  from public.orders
  where id = p_order_id
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
    stock_restored_at = coalesce(public.orders.stock_restored_at, now()),
    stripe_refund_id = coalesce(public.orders.stripe_refund_id, nullif(p_refund_id, '')),
    refunded_at = coalesce(public.orders.refunded_at, now()),
    refund_reason = nullif(p_refund_reason, '')
  where id = target_order.id
  returning
    public.orders.id,
    public.orders.status,
    public.orders.stock_restored_at,
    public.orders.stripe_refund_id,
    public.orders.refunded_at
  into order_id, status, stock_restored_at, stripe_refund_id, refunded_at;

  return next;
end;
$$;

revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from public;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from anon;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text) from authenticated;
grant execute on function public.cancel_paid_order_after_refund(uuid, text, text) to service_role;
