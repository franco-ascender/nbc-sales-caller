-- Candidate migration for C08 city-local caller ID coverage.
-- It is intentionally not applied by this task.
create table if not exists public.caller_phone_number_policy (
 id boolean primary key default true check (id),
 country char(2) not null default 'US' check (country='US'),
 qualified_lead_threshold integer not null default 25 check (qualified_lead_threshold between 1 and 10000),
 maximum_active_numbers integer not null default 10 check (maximum_active_numbers between 1 and 100),
 anas_approved_budget boolean not null default false,
 approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz,
 monthly_budget_cents integer check (monthly_budget_cents is null or monthly_budget_cents >= 0),
 updated_at timestamptz not null default now(),
 check ((anas_approved_budget=false and approved_by is null and approved_at is null) or (anas_approved_budget=true and approved_by is not null and approved_at is not null))
);
insert into public.caller_phone_number_policy(id) values(true) on conflict(id) do nothing;

create table if not exists public.caller_phone_numbers (
 id uuid primary key default gen_random_uuid(),
 country char(2) not null default 'US' check(country='US'),
 city text not null check(char_length(trim(city)) between 1 and 100),
 region char(2) not null check(region ~ '^[A-Z]{2}$'),
 rate_center text,
 phone_number text not null unique check(phone_number ~ '^\\+[1-9][0-9]{7,14}$'),
 twilio_sid text unique,
 voice_capable boolean not null default false,
 address_requirement text not null default 'unknown' check(address_requirement in ('none','any','local','unknown')),
 quoted_monthly_cents integer check(quoted_monthly_cents is null or quoted_monthly_cents >= 0),
 status text not null default 'quoted' check(status in ('quoted','active','retired','rejected')),
 source text not null default 'twilio' check(source='twilio'),
 purchased_at timestamptz,
 retired_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status='active') = (purchased_at is not null)),
 check(status<>'active' or (voice_capable=true and address_requirement='none'))
);
create unique index if not exists caller_phone_numbers_active_city_idx on public.caller_phone_numbers(country,lower(city),region) where status='active';
create index if not exists caller_phone_numbers_city_lookup_idx on public.caller_phone_numbers(country,region,lower(city),status);

alter table public.caller_phone_number_policy enable row level security;
alter table public.caller_phone_numbers enable row level security;
revoke all on public.caller_phone_number_policy,public.caller_phone_numbers from public,anon,authenticated;
grant select,insert,update,delete on public.caller_phone_number_policy,public.caller_phone_numbers to service_role;

create or replace function public.caller_phone_number_updated_at() returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
drop trigger if exists caller_phone_number_policy_updated_at on public.caller_phone_number_policy;
create trigger caller_phone_number_policy_updated_at before update on public.caller_phone_number_policy for each row execute function public.caller_phone_number_updated_at();
drop trigger if exists caller_phone_numbers_updated_at on public.caller_phone_numbers;
create trigger caller_phone_numbers_updated_at before update on public.caller_phone_numbers for each row execute function public.caller_phone_number_updated_at();
