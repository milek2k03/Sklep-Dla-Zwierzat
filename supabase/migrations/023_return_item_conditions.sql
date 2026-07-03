-- Explicit return item stock decisions.
-- Run after 022_remove_customer_refunds_from_expenses.sql.

alter table public.return_case_items
  add column if not exists return_condition text not null default 'needs_review',
  add column if not exists return_to_stock boolean not null default false,
  add column if not exists disposal_reason text;

update public.return_case_items
set
  return_condition = case restock_action
    when 'restock' then 'sellable'
    when 'discard' then 'unsellable'
    else 'needs_review'
  end,
  return_to_stock = restock_action = 'restock',
  disposal_reason = case
    when restock_action = 'discard'
      then coalesce(nullif(trim(condition_note), ''), 'Oznaczono jako niewracający na magazyn przed dodaniem powodów.')
    else disposal_reason
  end
where return_condition = 'needs_review'
  and restock_action <> 'pending';

alter table public.return_case_items
  drop constraint if exists return_case_items_return_condition_check,
  add constraint return_case_items_return_condition_check
  check (return_condition in ('sellable', 'unsellable', 'needs_review'));

alter table public.return_case_items
  drop constraint if exists return_case_items_return_to_stock_check,
  add constraint return_case_items_return_to_stock_check
  check (
    (return_condition = 'sellable' and return_to_stock = true)
    or (return_condition in ('unsellable', 'needs_review') and return_to_stock = false)
  );

alter table public.return_case_items
  drop constraint if exists return_case_items_unsellable_reason_check,
  add constraint return_case_items_unsellable_reason_check
  check (
    return_condition <> 'unsellable'
    or nullif(trim(coalesce(disposal_reason, '')), '') is not null
  );

create or replace function public.complete_return_case(
  p_return_case_id uuid,
  p_refund_id text default null,
  p_refund_amount numeric default 0
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
    approved_refund_amount = greatest(0, coalesce(p_refund_amount, 0)),
    stripe_refund_id = coalesce(public.return_cases.stripe_refund_id, nullif(p_refund_id, '')),
    refunded_at = case
      when nullif(p_refund_id, '') is not null then coalesce(public.return_cases.refunded_at, now())
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

revoke all on function public.complete_return_case(uuid, text, numeric) from public;
revoke all on function public.complete_return_case(uuid, text, numeric) from anon;
revoke all on function public.complete_return_case(uuid, text, numeric) from authenticated;
grant execute on function public.complete_return_case(uuid, text, numeric) to service_role;
