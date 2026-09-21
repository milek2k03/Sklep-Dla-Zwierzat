-- Record an explicit optional email marketing opt-in from checkout.
-- Run after 028_remove_inpost_shipx_integration.sql.

create table if not exists public.marketing_consents (
  order_id uuid primary key references public.orders(id) on delete cascade,
  email text not null,
  consent_version text not null,
  consent_text text not null,
  consented_at timestamptz not null default now()
);

create index if not exists marketing_consents_email_idx
  on public.marketing_consents (lower(email));

alter table public.marketing_consents enable row level security;

create policy "Admins can read marketing consents"
  on public.marketing_consents for select to authenticated
  using (exists (
    select 1 from public.admin_profiles as profile
    where profile.user_id = auth.uid() and profile.role = 'admin'
  ));

revoke all on public.marketing_consents from public, anon, authenticated;
grant select on public.marketing_consents to authenticated;
grant all on public.marketing_consents to service_role;
