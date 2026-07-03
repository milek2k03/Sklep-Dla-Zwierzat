-- Refunds as automatic expense entries.
-- Run after 019_random_product_sku.sql.

alter table public.expense_entries
  drop constraint if exists expense_entries_category_check,
  add constraint expense_entries_category_check
  check (
    category in (
      'goods',
      'packaging',
      'shipping',
      'stripe_fee',
      'refund',
      'domain',
      'hosting',
      'marketing',
      'other'
    )
  );

create unique index if not exists expense_entries_refund_document_number_idx
on public.expense_entries (document_number)
where category = 'refund'
  and document_number is not null;
