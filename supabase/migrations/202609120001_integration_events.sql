-- First test workspace: backend service access only. No browser access to events.
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  location_id text not null,
  event_id text not null,
  contact_id text not null,
  event_type text not null check (event_type in ('contact.created', 'contact.updated', 'integration.test')),
  received_at timestamptz not null default now(),
  constraint integration_events_location_event_unique unique (location_id, event_id)
);

alter table public.integration_events enable row level security;
revoke all on public.integration_events from anon, authenticated;
grant select, insert on public.integration_events to service_role;
create index if not exists integration_events_location_received_idx
  on public.integration_events (location_id, received_at desc);

-- Rollback (destructive; requires explicit authorization and data backup):
-- drop table if exists public.integration_events;
