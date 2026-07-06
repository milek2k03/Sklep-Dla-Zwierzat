-- InPost ShipX shipment data and idempotent shipment creation lock.
-- Run after 026_expense_payment_method.sql.

alter table public.orders
  add column if not exists pickup_point_name text,
  add column if not exists pickup_point_address_line1 text,
  add column if not exists pickup_point_address_line2 text,
  add column if not exists inpost_shipment_id text,
  add column if not exists inpost_shipment_status text,
  add column if not exists inpost_service text,
  add column if not exists inpost_shipment_error text,
  add column if not exists inpost_shipment_started_at timestamptz,
  add column if not exists inpost_shipment_created_at timestamptz;

create unique index if not exists orders_inpost_shipment_id_unique_idx
on public.orders (inpost_shipment_id)
where inpost_shipment_id is not null;

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
      'refund_created',
      'return_case_created',
      'return_case_updated',
      'return_case_closed',
      'shipment_created',
      'shipment_error'
    )
  );

create or replace function public.claim_inpost_shipment_creation(
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_order_id uuid;
begin
  update public.orders
  set
    inpost_shipment_status = 'creating',
    inpost_shipment_error = null,
    inpost_shipment_started_at = now()
  where id = p_order_id
    and status in ('paid', 'shipped')
    and delivery_method in ('inpost-paczkomat', 'inpost-kurier')
    and inpost_shipment_id is null
    and (
      inpost_shipment_status is null
      or inpost_shipment_status = 'error'
      or (
        inpost_shipment_status = 'creating'
        and inpost_shipment_started_at < now() - interval '5 minutes'
      )
    )
  returning id into claimed_order_id;

  return claimed_order_id is not null;
end;
$$;

revoke all on function public.claim_inpost_shipment_creation(uuid) from public;
revoke all on function public.claim_inpost_shipment_creation(uuid) from anon;
revoke all on function public.claim_inpost_shipment_creation(uuid) from authenticated;
grant execute on function public.claim_inpost_shipment_creation(uuid) to service_role;

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
    delivery_city,
    delivery_street,
    delivery_building_number,
    delivery_postal_code,
    delivery_country,
    pickup_point,
    pickup_point_name,
    pickup_point_address_line1,
    pickup_point_address_line2,
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
    nullif(p_order->>'delivery_city', ''),
    nullif(p_order->>'delivery_street', ''),
    nullif(p_order->>'delivery_building_number', ''),
    nullif(p_order->>'delivery_postal_code', ''),
    coalesce(nullif(p_order->>'delivery_country', ''), 'Polska'),
    nullif(p_order->>'pickup_point', ''),
    nullif(p_order->>'pickup_point_name', ''),
    nullif(p_order->>'pickup_point_address_line1', ''),
    nullif(p_order->>'pickup_point_address_line2', ''),
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
      unit_purchase_price numeric,
      quantity integer,
      line_total numeric,
      purchase_total numeric
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
      unit_purchase_price,
      quantity,
      line_total,
      purchase_total
    ) values (
      inserted_order_id,
      item_record.product_slug,
      item_record.product_name,
      item_record.unit_price,
      coalesce(item_record.unit_purchase_price, 0),
      item_record.quantity,
      item_record.line_total,
      coalesce(
        item_record.purchase_total,
        round(coalesce(item_record.unit_purchase_price, 0) * item_record.quantity, 2)
      )
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
