-- Track payment method for expense ledger entries.
-- Run after 025_pawly_dogs_cats_catalog.sql.

alter table public.expense_entries
  add column if not exists payment_method text not null default 'other';

alter table public.expense_entries
  drop constraint if exists expense_entries_payment_method_check,
  add constraint expense_entries_payment_method_check
  check (
    payment_method in (
      'blik',
      'transfer',
      'cash',
      'cod',
      'other'
    )
  );
