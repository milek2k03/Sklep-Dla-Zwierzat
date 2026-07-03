-- Remove customer refunds from the expense ledger.
-- Run after 021_backfill_refund_expenses.sql.
--
-- Customer refunds are revenue corrections handled in orders/sales, not costs.
-- Keep supplier/operator refunds in category 'refund'.

delete from public.expense_entries
where category = 'refund'
  and vendor = 'Stripe'
  and document_number is not null
  and (
    description like 'Zwrot środków do zamówienia %'
    or description like 'Zwrot środków RET% do zamówienia %'
  );
