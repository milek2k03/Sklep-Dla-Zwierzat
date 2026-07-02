-- Return, claim, and exchange cases.
-- Run after 013_order_refunds.sql.

create table if not exists public.return_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('RET-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8))),
  order_id uuid not null references public.orders(id) on delete cascade,
  case_type text not null check (case_type in ('return', 'claim', 'exchange')),
  status text not null default 'reported' check (
    status in (
      'reported',
      'awaiting_package',
      'package_received',
      'accepted',
      'rejected',
      'closed'
    )
  ),
  customer_message text,
  admin_notes text,
  requested_refund_amount numeric(10, 2) not null default 0 check (requested_refund_amount >= 0),
  approved_refund_amount numeric(10, 2) not null default 0 check (approved_refund_amount >= 0),
  stripe_refund_id text,
  refunded_at timestamptz,
  stock_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_case_items (
  id uuid primary key default gen_random_uuid(),
  return_case_id uuid not null references public.return_cases(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_slug text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  restock_action text not null default 'pending' check (restock_action in ('pending', 'restock', 'discard')),
  condition_note text,
  restocked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (return_case_id, order_item_id)
);

create index if not exists return_cases_order_created_idx
on public.return_cases (order_id, created_at desc);

create index if not exists return_cases_status_created_idx
on public.return_cases (status, created_at desc);

create index if not exists return_case_items_case_idx
on public.return_case_items (return_case_id);

create unique index if not exists return_case_items_order_item_open_idx
on public.return_case_items (order_item_id);

drop trigger if exists return_cases_set_updated_at on public.return_cases;
create trigger return_cases_set_updated_at
before update on public.return_cases
for each row
execute function public.set_updated_at();

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
      'return_case_closed'
    )
  );

alter table public.return_cases enable row level security;
alter table public.return_case_items enable row level security;

drop policy if exists "Admins can manage return cases" on public.return_cases;
create policy "Admins can manage return cases"
on public.return_cases
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can manage return case items" on public.return_case_items;
create policy "Admins can manage return case items"
on public.return_case_items
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
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

  if target_case.stock_processed_at is null then
    update public.products as product
    set stock_quantity = product.stock_quantity + returned.quantity
    from (
      select
        rci.product_slug,
        sum(rci.quantity)::integer as quantity
      from public.return_case_items rci
      where rci.return_case_id = target_case.id
        and rci.restock_action = 'restock'
        and rci.restocked_at is null
      group by rci.product_slug
    ) as returned
    where product.slug = returned.product_slug;

    update public.return_case_items as rci
    set restocked_at = now()
    where rci.return_case_id = target_case.id
      and rci.restock_action = 'restock'
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
