-- Stripe Checkout support.
-- Run after 006_create_order_with_stock.sql.

alter table public.orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('manual', 'stripe'));

create unique index if not exists orders_stripe_checkout_session_id_idx
on public.orders (stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create index if not exists orders_stripe_payment_intent_id_idx
on public.orders (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create or replace function public.create_order_with_stock(
  p_order jsonb,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item_record record;
  inserted_order_id uuid;
  inserted_order_number text;
  inserted_created_at timestamptz;
  available_stock integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_HAS_NO_ITEMS' using errcode = 'P0001';
  end if;

  insert into public.orders as inserted_order (
    order_number,
    customer_full_name,
    customer_email,
    customer_phone,
    delivery_method,
    delivery_address,
    pickup_point,
    notes,
    subtotal,
    discount_code,
    discount_total,
    delivery_cost,
    total,
    payment_method,
    status
  ) values (
    p_order->>'order_number',
    p_order->>'customer_full_name',
    p_order->>'customer_email',
    p_order->>'customer_phone',
    p_order->>'delivery_method',
    p_order->>'delivery_address',
    nullif(p_order->>'pickup_point', ''),
    nullif(p_order->>'notes', ''),
    (p_order->>'subtotal')::numeric,
    nullif(p_order->>'discount_code', ''),
    coalesce((p_order->>'discount_total')::numeric, 0),
    (p_order->>'delivery_cost')::numeric,
    (p_order->>'total')::numeric,
    coalesce(nullif(p_order->>'payment_method', ''), 'manual'),
    'new'::public.order_status
  )
  returning
    inserted_order.id,
    inserted_order.order_number,
    inserted_order.created_at
  into inserted_order_id, inserted_order_number, inserted_created_at;

  for item_record in
    select *
    from jsonb_to_recordset(p_items) as item(
      product_slug text,
      product_name text,
      unit_price numeric,
      quantity integer,
      line_total numeric
    )
  loop
    if item_record.quantity is null or item_record.quantity <= 0 then
      raise exception 'ORDER_INVALID_ITEM_QUANTITY' using errcode = 'P0001';
    end if;

    update public.products
    set stock_quantity = stock_quantity - item_record.quantity
    where slug = item_record.product_slug
      and is_active = true
      and stock_quantity >= item_record.quantity;

    if not found then
      select stock_quantity
      into available_stock
      from public.products
      where slug = item_record.product_slug
      for update;

      raise exception 'ORDER_INSUFFICIENT_STOCK'
        using
          errcode = 'P0001',
          detail = jsonb_build_object(
            'slug', item_record.product_slug,
            'requested', item_record.quantity,
            'available', coalesce(available_stock, 0)
          )::text;
    end if;

    insert into public.order_items (
      order_id,
      product_slug,
      product_name,
      unit_price,
      quantity,
      line_total
    ) values (
      inserted_order_id,
      item_record.product_slug,
      item_record.product_name,
      item_record.unit_price,
      item_record.quantity,
      item_record.line_total
    );
  end loop;

  order_id := inserted_order_id;
  order_number := inserted_order_number;
  created_at := inserted_created_at;
  return next;
end;
$$;

revoke all on function public.create_order_with_stock(jsonb, jsonb) from public;
revoke all on function public.create_order_with_stock(jsonb, jsonb) from anon;
revoke all on function public.create_order_with_stock(jsonb, jsonb) from authenticated;
grant execute on function public.create_order_with_stock(jsonb, jsonb) to service_role;
