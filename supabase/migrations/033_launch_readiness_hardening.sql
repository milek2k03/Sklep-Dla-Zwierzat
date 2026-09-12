-- Production readiness hardening: durable rate limits, precise refund reporting,
-- Stripe payment method attribution, and removal of mock review counters.
-- Run after 032_optimize_unpaid_order_expiration.sql.

create table if not exists public.rate_limit_buckets (
  rate_key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_buckets_reset_idx
on public.rate_limit_buckets (reset_at);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_at timestamptz := now();
  current_bucket public.rate_limit_buckets%rowtype;
begin
  if nullif(p_key, '') is null then
    raise exception 'RATE_LIMIT_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  if p_limit is null or p_limit <= 0 then
    raise exception 'RATE_LIMIT_INVALID_LIMIT' using errcode = 'P0001';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'RATE_LIMIT_INVALID_WINDOW' using errcode = 'P0001';
  end if;

  delete from public.rate_limit_buckets
  where reset_at < now_at - interval '1 day';

  insert into public.rate_limit_buckets as bucket (
    rate_key,
    count,
    reset_at,
    updated_at
  )
  values (
    p_key,
    1,
    now_at + make_interval(secs => p_window_seconds),
    now_at
  )
  on conflict (rate_key) do update
  set
    count = case
      when bucket.reset_at <= now_at then 1
      else bucket.count + 1
    end,
    reset_at = case
      when bucket.reset_at <= now_at then now_at + make_interval(secs => p_window_seconds)
      else bucket.reset_at
    end,
    updated_at = now_at
  returning *
  into current_bucket;

  allowed := current_bucket.count <= p_limit;
  remaining := greatest(0, p_limit - current_bucket.count);
  retry_after := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from current_bucket.reset_at - now_at))::integer
    )
  end;

  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

alter table public.orders
add column if not exists refund_total numeric(10, 2) not null default 0
check (refund_total >= 0);

alter table public.orders
add column if not exists refund_products_total numeric(10, 2) not null default 0
check (refund_products_total >= 0);

alter table public.orders
add column if not exists refund_delivery_total numeric(10, 2) not null default 0
check (refund_delivery_total >= 0);

alter table public.orders
add column if not exists stripe_payment_method_type text;

update public.orders
set
  refund_total = round(greatest(0, subtotal - discount_total) + delivery_cost, 2),
  refund_products_total = round(greatest(0, subtotal - discount_total), 2),
  refund_delivery_total = delivery_cost
where stripe_refund_id is not null
  and refund_total = 0;

alter table public.return_cases
add column if not exists approved_product_refund_amount numeric(10, 2) not null default 0
check (approved_product_refund_amount >= 0);

alter table public.return_cases
add column if not exists approved_delivery_refund_amount numeric(10, 2) not null default 0
check (approved_delivery_refund_amount >= 0);

alter table public.return_cases
add column if not exists delivery_refunded boolean not null default false;

update public.return_cases
set
  approved_product_refund_amount = approved_refund_amount,
  approved_delivery_refund_amount = 0,
  delivery_refunded = false
where approved_refund_amount > 0
  and approved_product_refund_amount = 0
  and approved_delivery_refund_amount = 0;

drop function if exists public.cancel_paid_order_after_refund(uuid, text, text);

create or replace function public.cancel_paid_order_after_refund(
  p_order_id uuid,
  p_refund_id text,
  p_refund_reason text default null,
  p_refund_amount numeric default 0,
  p_refund_product_amount numeric default 0,
  p_refund_delivery_amount numeric default 0
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
  normalized_refund_amount numeric := greatest(0, coalesce(p_refund_amount, 0));
  normalized_product_amount numeric := greatest(0, coalesce(p_refund_product_amount, 0));
  normalized_delivery_amount numeric := greatest(0, coalesce(p_refund_delivery_amount, 0));
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

  if normalized_refund_amount = 0 then
    normalized_refund_amount := round(
      greatest(0, target_order.subtotal - target_order.discount_total) + target_order.delivery_cost,
      2
    );
  end if;

  if normalized_product_amount = 0 and normalized_delivery_amount = 0 then
    normalized_product_amount := round(greatest(0, target_order.subtotal - target_order.discount_total), 2);
    normalized_delivery_amount := round(target_order.delivery_cost, 2);
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
    refund_reason = nullif(p_refund_reason, ''),
    refund_total = normalized_refund_amount,
    refund_products_total = normalized_product_amount,
    refund_delivery_total = normalized_delivery_amount
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

revoke all on function public.cancel_paid_order_after_refund(uuid, text, text, numeric, numeric, numeric) from public;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text, numeric, numeric, numeric) from anon;
revoke all on function public.cancel_paid_order_after_refund(uuid, text, text, numeric, numeric, numeric) from authenticated;
grant execute on function public.cancel_paid_order_after_refund(uuid, text, text, numeric, numeric, numeric) to service_role;

drop function if exists public.complete_return_case(uuid, text, numeric);

create or replace function public.complete_return_case(
  p_return_case_id uuid,
  p_refund_id text default null,
  p_refund_amount numeric default 0,
  p_delivery_refund_amount numeric default 0
)
returns table (
  return_case_id uuid,
  status text,
  stock_processed_at timestamptz,
  stripe_refund_id text,
  refunded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_case public.return_cases%rowtype;
  normalized_refund_amount numeric := greatest(0, coalesce(p_refund_amount, 0));
  normalized_delivery_amount numeric := greatest(0, coalesce(p_delivery_refund_amount, 0));
  normalized_product_amount numeric := 0;
begin
  if p_return_case_id is null then
    raise exception 'RETURN_CASE_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into target_case
  from public.return_cases
  where id = p_return_case_id
  for update;

  if not found then
    raise exception 'RETURN_CASE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if target_case.status = 'closed' then
    return_case_id := target_case.id;
    status := target_case.status;
    stock_processed_at := target_case.stock_processed_at;
    stripe_refund_id := target_case.stripe_refund_id;
    refunded_at := target_case.refunded_at;
    return next;
    return;
  end if;

  normalized_delivery_amount := least(normalized_delivery_amount, normalized_refund_amount);
  normalized_product_amount := greatest(0, normalized_refund_amount - normalized_delivery_amount);

  if exists (
    select 1
    from public.return_case_items rci
    where rci.return_case_id = target_case.id
      and rci.return_condition = 'needs_review'
  ) then
    raise exception 'RETURN_STOCK_DECISION_REQUIRED' using errcode = 'P0001';
  end if;

  if target_case.stock_processed_at is null then
    update public.products as product
    set stock_quantity = product.stock_quantity + returned.quantity
    from (
      select
        rci.product_slug,
        sum(rci.quantity)::integer as quantity
      from public.return_case_items rci
      where rci.return_case_id = target_case.id
        and rci.return_condition = 'sellable'
        and rci.return_to_stock = true
        and rci.restocked_at is null
      group by rci.product_slug
    ) as returned
    where product.slug = returned.product_slug;

    update public.return_case_items as rci
    set restocked_at = now()
    where rci.return_case_id = target_case.id
      and rci.return_condition = 'sellable'
      and rci.return_to_stock = true
      and rci.restocked_at is null;
  end if;

  update public.return_cases
  set
    status = 'closed',
    approved_refund_amount = normalized_refund_amount,
    approved_product_refund_amount = normalized_product_amount,
    approved_delivery_refund_amount = normalized_delivery_amount,
    delivery_refunded = normalized_delivery_amount > 0,
    stripe_refund_id = coalesce(public.return_cases.stripe_refund_id, nullif(p_refund_id, '')),
    refunded_at = case
      when nullif(p_refund_id, '') is not null or normalized_refund_amount > 0
        then coalesce(public.return_cases.refunded_at, now())
      else public.return_cases.refunded_at
    end,
    stock_processed_at = coalesce(public.return_cases.stock_processed_at, now())
  where id = target_case.id
  returning
    public.return_cases.id,
    public.return_cases.status,
    public.return_cases.stock_processed_at,
    public.return_cases.stripe_refund_id,
    public.return_cases.refunded_at
  into return_case_id, status, stock_processed_at, stripe_refund_id, refunded_at;

  return next;
end;
$$;

revoke all on function public.complete_return_case(uuid, text, numeric, numeric) from public;
revoke all on function public.complete_return_case(uuid, text, numeric, numeric) from anon;
revoke all on function public.complete_return_case(uuid, text, numeric, numeric) from authenticated;
grant execute on function public.complete_return_case(uuid, text, numeric, numeric) to service_role;

update public.products
set
  rating = 0,
  review_count = 0
where rating <> 0
  or review_count <> 0;
