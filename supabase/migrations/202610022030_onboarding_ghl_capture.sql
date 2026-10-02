begin;
create table public.nbc_onboarding_ghl_receipts (
 id uuid primary key default gen_random_uuid(),
 location_id text not null,
 pipeline_id text not null,
 stage_id text not null,
 opportunity_id text not null,
 contact_id text not null,
 intake jsonb not null check(jsonb_typeof(intake)='object'),
 issues jsonb not null default '[]'::jsonb check(jsonb_typeof(issues)='array'),
 mode text not null default 'capture' check(mode='capture'),
 received_at timestamptz not null default now(),
 unique(location_id,opportunity_id)
);
alter table public.nbc_onboarding_ghl_receipts enable row level security;
revoke all on public.nbc_onboarding_ghl_receipts from public,anon,authenticated;
grant select,insert on public.nbc_onboarding_ghl_receipts to service_role;
create index nbc_onboarding_ghl_recent on public.nbc_onboarding_ghl_receipts(received_at desc);
commit;
