-- Caller booking is server-only. Owner checks are performed after NBC authentication.
begin;
create table public.caller_booking_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 config jsonb not null check(jsonb_typeof(config)='object'),
 token_ciphertext text not null,
 verified_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 retell_config jsonb
);
create table public.caller_booking_calls (
 operation_key text primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 config jsonb not null,
 token_ciphertext text not null,
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 created_at timestamptz not null default now()
);
create index caller_booking_calls_owner on public.caller_booking_calls(owner_id);
create table public.caller_bookings (
 id uuid primary key default gen_random_uuid(),
 operation_key text not null unique references public.caller_booking_calls(operation_key),
 owner_id uuid not null references auth.users(id) on delete cascade,
 request jsonb not null,
 state text not null check(state in ('booking','booked','unavailable','uncertain')),
 contact_id text,
 appointment_id text,
 receipt jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index caller_bookings_owner on public.caller_bookings(owner_id,created_at desc);
create table public.caller_booking_steps (
 booking_id uuid not null references public.caller_bookings(id) on delete cascade,
 kind text not null check(kind in ('tags','opportunity','email','sms')),
 state text not null check(state in ('pending','running','accepted','delivered','skipped','failed','uncertain')),
 provider_id text,
 reason text,
 cost_microusd bigint check(cost_microusd>=0),
 updated_at timestamptz not null default now(),
 primary key(booking_id,kind)
);
alter table public.caller_booking_connections enable row level security;
alter table public.caller_booking_calls enable row level security;
alter table public.caller_bookings enable row level security;
alter table public.caller_booking_steps enable row level security;
revoke all on public.caller_booking_connections,public.caller_booking_calls,public.caller_bookings,public.caller_booking_steps from anon,authenticated;
grant all on public.caller_booking_connections,public.caller_booking_calls,public.caller_bookings,public.caller_booking_steps to service_role;
-- The call slot and permission snapshot are created atomically under the existing round lock.
create function public.nbc_portal_phone_booking_slot(p_owner uuid,p_request uuid,p_destination text,p_max_cents integer,p_scenario_id uuid,p_retell jsonb,p_booking boolean default false) returns text
language plpgsql security invoker set search_path=public as $$
declare k text; c caller_booking_connections; s nbc_pilot_slots; chosen jsonb;
begin
 perform 1 from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 select * into s from nbc_pilot_slots where round_id='2026-09-25-first-live-tests' and key='dial-'||p_request::text;
 if found and coalesce((s.config->>'bookingEnabled')::boolean,false) is distinct from p_booking then raise exception 'booking_request_conflict'; end if;
 chosen:=p_retell;
 if p_booking then
  select * into c from caller_booking_connections where owner_id=p_owner;
  if c.owner_id is null or c.config->>'enabled'<>'true' or c.retell_config is null or p_scenario_id is null then raise exception 'booking_not_ready'; end if;
  chosen:=c.retell_config;
 end if;
 k:=nbc_portal_phone_scenario_slot(p_owner,p_request,p_destination,p_max_cents,p_scenario_id,chosen);
 if p_booking and s.key is null then
  update nbc_pilot_slots set config=config||jsonb_build_object('bookingEnabled',true) where round_id='2026-09-25-first-live-tests' and key=k;
  insert into caller_booking_calls(operation_key,owner_id,config,token_ciphertext,phone) values(k,p_owner,c.config,c.token_ciphertext,p_destination);
 end if;
 return k;
end $$;
revoke all on function public.nbc_portal_phone_booking_slot(uuid,uuid,text,integer,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.nbc_portal_phone_booking_slot(uuid,uuid,text,integer,uuid,jsonb,boolean) to service_role;
commit;
