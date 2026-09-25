-- Authenticated operator test sessions. Provider credentials never enter this table.
create table public.call_sessions (
  id uuid primary key,
  operator_id uuid not null references auth.users(id),
  provider text not null check (provider in ('elevenlabs', 'retell')),
  provider_agent_id text not null,
  provider_call_id text unique,
  channel text not null default 'web' check (channel in ('web', 'phone')),
  status text not null default 'preparing' check (status in ('preparing', 'ready', 'active', 'processing', 'completed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  summary text,
  failure_code text,
  synced_at timestamptz
);

create index call_sessions_operator_created_idx on public.call_sessions(operator_id, created_at desc);
create unique index call_sessions_one_active_operator_idx on public.call_sessions(operator_id)
  where status in ('preparing', 'ready', 'active');
alter table public.call_sessions enable row level security;
revoke all on public.call_sessions from anon, authenticated;
grant select, insert, update on public.call_sessions to service_role;

-- No destructive rollback is executed automatically.
