-- One delivery attempt per recipient and four-week campaign.
create table public.marketing_mailings (
  campaign_key text not null,
  email text not null references public.marketing_preferences(email),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  provider_id text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (campaign_key, email)
);

alter table public.marketing_mailings enable row level security;
revoke all on public.marketing_mailings from public, anon, authenticated;
grant all on public.marketing_mailings to service_role;

create or replace function public.claim_marketing_mailing(p_campaign_key text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare claimed boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  insert into public.marketing_mailings (campaign_key, email)
  select p_campaign_key, preference.email
  from public.marketing_preferences as preference
  where preference.email = lower(p_email) and preference.is_active
  on conflict do nothing;
  claimed := found;
  return claimed;
end;
$$;

revoke all on function public.claim_marketing_mailing(text, text) from public, anon, authenticated;
grant execute on function public.claim_marketing_mailing(text, text) to service_role;

create or replace function public.unsubscribe_marketing(p_email text, p_consented_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed_rows integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  update public.marketing_preferences
  set is_active = false, revoked_at = clock_timestamp(), updated_at = clock_timestamp()
  where email = lower(p_email) and is_active and last_consented_at = p_consented_at;
  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$$;

revoke all on function public.unsubscribe_marketing(text, timestamptz) from public, anon, authenticated;
grant execute on function public.unsubscribe_marketing(text, timestamptz) to service_role;
