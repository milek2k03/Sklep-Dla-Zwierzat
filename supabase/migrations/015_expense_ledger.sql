-- Admin expense ledger for simplified sales records.
-- Run after 014_return_cases.sql.

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (
    category in (
      'goods',
      'packaging',
      'shipping',
      'stripe_fee',
      'domain',
      'hosting',
      'marketing',
      'other'
    )
  ),
  description text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  vendor text,
  document_number text,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_entries_date_idx
on public.expense_entries (expense_date desc, created_at desc);

create index if not exists expense_entries_category_date_idx
on public.expense_entries (category, expense_date desc);

drop trigger if exists expense_entries_set_updated_at on public.expense_entries;
create trigger expense_entries_set_updated_at
before update on public.expense_entries
for each row
execute function public.set_updated_at();

alter table public.expense_entries enable row level security;

drop policy if exists "Admins can manage expense entries" on public.expense_entries;
create policy "Admins can manage expense entries"
on public.expense_entries
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
