-- Current email marketing state. A later checkout opt-in reactivates a revoked address.
-- Run after 029_checkout_marketing_consent.sql.

create table if not exists public.marketing_preferences (
  email text primary key,
  is_active boolean not null default true,
  last_consented_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint marketing_preferences_email_lowercase check (email = lower(email)),
  constraint marketing_preferences_status_check check (
    (is_active and revoked_at is null)
    or (not is_active and revoked_at is not null)
  )
);

comment on table public.marketing_consents is
  'Historical proof of opt-in. Do not use as a marketing recipient list.';
comment on table public.marketing_preferences is
  'Current marketing email eligibility. Send only when is_active is true.';

create index if not exists marketing_preferences_last_consented_idx
  on public.marketing_preferences (last_consented_at desc);

alter table public.marketing_consents
  alter column consented_at set default clock_timestamp();

insert into public.marketing_preferences (
  email, is_active, last_consented_at, revoked_at
)
select distinct on (lower(email))
  lower(email), true, consented_at, null
from public.marketing_consents
order by lower(email), consented_at desc, order_id desc
on conflict (email) do nothing;

create or replace function public.activate_marketing_preference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.marketing_preferences (
    email, is_active, last_consented_at, revoked_at, updated_at
  ) values (
    lower(new.email), true, new.consented_at, null, clock_timestamp()
  )
  on conflict (email) do update set
    is_active = true,
    last_consented_at = excluded.last_consented_at,
    revoked_at = null,
    updated_at = clock_timestamp()
  where excluded.last_consented_at > public.marketing_preferences.last_consented_at
    and (
      public.marketing_preferences.revoked_at is null
      or excluded.last_consented_at > public.marketing_preferences.revoked_at
    );
  return new;
end;
$$;

create trigger marketing_consent_activates_preference
after insert on public.marketing_consents
for each row execute function public.activate_marketing_preference();

alter table public.marketing_preferences enable row level security;

create policy "Admins can read marketing preferences"
on public.marketing_preferences for select to authenticated
using (exists (
  select 1 from public.admin_profiles as profile
  where profile.user_id = auth.uid() and profile.role = 'admin'
));

revoke all on public.marketing_preferences from public, anon, authenticated;
grant select on public.marketing_preferences to authenticated;
grant all on public.marketing_preferences to service_role;

create or replace function public.revoke_marketing_preference(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer;
  revoked_time timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from public.admin_profiles as profile
    where profile.user_id = auth.uid() and profile.role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  update public.marketing_preferences
  set is_active = false,
      revoked_at = revoked_time,
      updated_at = revoked_time
  where email = lower(trim(p_email)) and is_active = true;

  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$$;

revoke all on function public.revoke_marketing_preference(text) from public, anon;
grant execute on function public.revoke_marketing_preference(text) to authenticated;
