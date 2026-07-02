-- Pawly discount codes.
-- Run after 002_products_catalog.sql.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent integer not null check (percent >= 0 and percent <= 100),
  scope_type text not null default 'all' check (scope_type in ('all', 'category', 'product')),
  scope_value text,
  time_mode text not null default 'permanent' check (time_mode in ('permanent', 'scheduled', 'recurring')),
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays integer[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'all' and scope_value is null)
    or (scope_type in ('category', 'product') and scope_value is not null)
  ),
  check (
    time_mode <> 'scheduled'
    or (starts_at is not null and ends_at is not null and starts_at < ends_at)
  ),
  check (
    time_mode <> 'recurring'
    or (
      array_length(weekdays, 1) is not null
      and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  )
);

alter table public.discount_codes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists code text,
  add column if not exists percent integer,
  add column if not exists scope_type text default 'all',
  add column if not exists scope_value text,
  add column if not exists time_mode text default 'permanent',
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists weekdays integer[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.discount_codes
    drop constraint if exists discount_codes_percent_check;
  alter table public.discount_codes
    add constraint discount_codes_percent_check check (percent >= 0 and percent <= 100);
end $$;

create unique index if not exists discount_codes_code_idx on public.discount_codes (code);
create index if not exists discount_codes_active_idx on public.discount_codes (is_active, code);

drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at
before update on public.discount_codes
for each row
execute function public.set_updated_at();

alter table public.discount_codes enable row level security;

drop policy if exists "Admins can read discount codes" on public.discount_codes;
create policy "Admins can read discount codes"
on public.discount_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can insert discount codes" on public.discount_codes;
create policy "Admins can insert discount codes"
on public.discount_codes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

drop policy if exists "Admins can update discount codes" on public.discount_codes;
create policy "Admins can update discount codes"
on public.discount_codes
for update
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

drop policy if exists "Admins can delete discount codes" on public.discount_codes;
create policy "Admins can delete discount codes"
on public.discount_codes
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.role = 'admin'
  )
);

alter table public.orders
  add column if not exists discount_code text,
  add column if not exists discount_total numeric(10, 2) not null default 0 check (discount_total >= 0);
