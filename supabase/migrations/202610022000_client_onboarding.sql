begin;
create table public.nbc_client_onboardings (
 id uuid primary key,
 intake jsonb not null check(jsonb_typeof(intake)='object'),
 email_key text generated always as (lower(btrim(intake->>'email'))) stored not null unique,
 state text not null default 'draft' check(state in ('draft','starting','queued','existing','uncertain','needs_review')),
 revision integer not null default 1 check(revision>0),
 task_id text unique,
 issue text,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(length(email_key) between 3 and 200),
 check(state not in ('queued','existing') or task_id is not null)
);
alter table public.nbc_client_onboardings enable row level security;
revoke all on public.nbc_client_onboardings from public,anon,authenticated;
grant select,insert,update on public.nbc_client_onboardings to service_role;
create index nbc_client_onboardings_recent on public.nbc_client_onboardings(created_at desc);
commit;
