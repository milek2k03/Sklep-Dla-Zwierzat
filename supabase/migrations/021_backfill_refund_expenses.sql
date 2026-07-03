-- Backfill existing Stripe refunds into the expense ledger.
-- Run after 020_refund_expense_entries.sql.

insert into public.expense_entries (
  expense_date,
  category,
  description,
  amount,
  vendor,
  document_number,
  notes
)
select
  coalesce(o.refunded_at::date, current_date),
  'refund',
  'Zwrot środków do zamówienia ' || o.order_number,
  greatest(0, coalesce(o.subtotal, 0) - coalesce(o.discount_total, 0)),
  'Stripe',
  o.stripe_refund_id,
  o.refund_reason
from public.orders o
where o.stripe_refund_id is not null
  and greatest(0, coalesce(o.subtotal, 0) - coalesce(o.discount_total, 0)) > 0
  and not exists (
    select 1
    from public.expense_entries ee
    where ee.category = 'refund'
      and ee.document_number = o.stripe_refund_id
  )
on conflict do nothing;

insert into public.expense_entries (
  expense_date,
  category,
  description,
  amount,
  vendor,
  document_number,
  notes
)
select
  coalesce(rc.refunded_at::date, current_date),
  'refund',
  'Zwrot środków ' || rc.case_number || ' do zamówienia ' || o.order_number,
  rc.approved_refund_amount,
  'Stripe',
  rc.stripe_refund_id,
  null
from public.return_cases rc
join public.orders o on o.id = rc.order_id
where rc.stripe_refund_id is not null
  and rc.approved_refund_amount > 0
  and not exists (
    select 1
    from public.expense_entries ee
    where ee.category = 'refund'
      and ee.document_number = rc.stripe_refund_id
  )
on conflict do nothing;
