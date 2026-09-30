begin;
-- Immutable source documents, intentionally separate from usage (which may be included in a plan).
create table public.nbc_billing_statements (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(length(provider) between 1 and 80),
 reference text not null check(length(reference) between 1 and 160),
 issued_on date not null,
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 total_microusd bigint not null check(total_microusd between 0 and 1000000000000),
 applied_microusd bigint not null default 0 check(applied_microusd>=0),
 due_microusd bigint not null check(due_microusd>=0),
 kind text not null check(kind in ('invoice','prepayment')),
 evidence text not null check(length(evidence) between 1 and 500),
 note text not null default '' check(length(note)<=2000),
 created_by uuid not null references public.nbc_members(id),
 created_at timestamptz not null default now(),
 unique(provider,reference),
 check(applied_microusd+due_microusd=total_microusd)
);
alter table public.nbc_billing_statements enable row level security;
revoke all on public.nbc_billing_statements from anon,authenticated;
grant select,insert on public.nbc_billing_statements to service_role;
commit;
