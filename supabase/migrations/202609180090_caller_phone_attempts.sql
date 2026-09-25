-- Candidate C08 migration. It is not applied by this task.
create table if not exists public.caller_phone_pilots (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 destination_e164 text not null check(destination_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
 source_number_id uuid not null references public.caller_phone_numbers(id),
 agent_id text not null check(char_length(agent_id) between 1 and 160),
 max_ring_seconds integer not null default 20 check(max_ring_seconds between 5 and 60),
 max_call_seconds integer not null default 60 check(max_call_seconds between 10 and 600),
 max_cost_cents integer not null check(max_cost_cents > 0),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 check(expires_at > approved_at),
 check(revoked_at is null or revoked_at >= approved_at)
);
create index if not exists caller_phone_pilots_owner_idx on public.caller_phone_pilots(owner_id,expires_at desc);

create table if not exists public.caller_phone_attempts (
 id uuid primary key,
 pilot_id uuid not null references public.caller_phone_pilots(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 request_hash text not null check(char_length(request_hash)=64),
 dispatch_state text not null check(dispatch_state in ('reserved','dispatching','dispatch_unknown','accepted','rejected')),
 call_state text check(call_state is null or call_state in ('queued','ringing','in_progress','completed','busy','no_answer','failed','canceled')),
 result_state text not null default 'pending' check(result_state in ('pending','available','unavailable')),
 cost_state text not null default 'pending' check(cost_state in ('pending','settled')),
 stop_requested_at timestamptz,
 twilio_call_sid text unique,
 eleven_conversation_id text unique,
 request_claimed_at timestamptz not null default now(),
 dispatch_started_at timestamptz,
 accepted_at timestamptz,
 ended_at timestamptz,
 reserved_cost_cents integer not null check(reserved_cost_cents > 0),
 actual_cost_cents integer check(actual_cost_cents >= 0),
 transcript jsonb not null default '[]'::jsonb check(jsonb_typeof(transcript)='array'),
 summary text,
 failure_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,request_id),
 unique(pilot_id,request_hash)
);
create unique index if not exists caller_phone_attempts_one_open_pilot_idx on public.caller_phone_attempts(pilot_id) where dispatch_state in ('reserved','dispatching','dispatch_unknown','accepted') and (call_state is null or call_state in ('queued','ringing','in_progress'));
create index if not exists caller_phone_attempts_owner_created_idx on public.caller_phone_attempts(owner_id,created_at desc);

create table if not exists public.caller_phone_events (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.caller_phone_attempts(id) on delete cascade,
 provider text not null check(provider in ('twilio','elevenlabs')),
 dedupe_key text not null check(char_length(dedupe_key) between 1 and 300),
 event_type text not null check(char_length(event_type) between 1 and 120),
 occurred_at timestamptz,
 received_at timestamptz not null default now(),
 payload_hash text not null check(char_length(payload_hash)=64),
 payload jsonb not null,
 unique(provider,dedupe_key)
);
create index if not exists caller_phone_events_attempt_received_idx on public.caller_phone_events(attempt_id,received_at desc);

alter table public.caller_phone_pilots enable row level security;
alter table public.caller_phone_attempts enable row level security;
alter table public.caller_phone_events enable row level security;
revoke all on public.caller_phone_pilots,public.caller_phone_attempts,public.caller_phone_events from public,anon,authenticated;
grant select,insert,update,delete on public.caller_phone_pilots,public.caller_phone_attempts,public.caller_phone_events to service_role;

create or replace function public.caller_phone_attempt_updated_at() returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
drop trigger if exists caller_phone_attempts_updated_at on public.caller_phone_attempts;
create trigger caller_phone_attempts_updated_at before update on public.caller_phone_attempts for each row execute function public.caller_phone_attempt_updated_at();
