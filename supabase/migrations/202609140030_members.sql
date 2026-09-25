-- I02 candidate. Apply only during coordinated integration; never from a live UI.
begin;
create table public.nbc_members (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(display_name) between 1 and 120),
  role text not null check (role in ('admin','coach','student')),
  status text not null default 'active' check (status in ('active','suspended')),
  coach_id uuid references public.nbc_members(id),
  created_at timestamptz not null default now(),
  check (coach_id is null or (role = 'student' and coach_id <> id))
);
create index nbc_members_coach_idx on public.nbc_members(coach_id, id);
create table public.nbc_onboarding (
  member_id uuid primary key references public.nbc_members(id),
  business text not null default '' check (length(business) <= 200),
  timezone text not null default 'America/New_York' check (length(timezone) <= 80),
  goal text not null default '' check (length(goal) <= 2000),
  questions text not null default '' check (length(questions) <= 3000),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (completed_at is null or (length(trim(business)) > 0 and length(trim(goal)) > 0))
);
create table public.nbc_calendar (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.nbc_members(id),
  student_id uuid references public.nbc_members(id),
  title text not null check (length(title) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  join_url text not null check (length(join_url) <= 2000 and join_url ~ '^https://'),
  check (ends_at > starts_at and ends_at <= starts_at + interval '1 day')
);
create index nbc_calendar_start_idx on public.nbc_calendar(starts_at,id);
create table public.nbc_messages (
  id uuid primary key,
  student_id uuid not null references public.nbc_members(id),
  author_id uuid not null references public.nbc_members(id),
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index nbc_messages_thread_idx on public.nbc_messages(student_id,created_at desc,id desc);
create table public.nbc_tickets (
  id uuid primary key,
  member_id uuid not null references public.nbc_members(id),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null check (length(trim(body)) between 1 and 3000),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create index nbc_tickets_member_idx on public.nbc_tickets(member_id,created_at desc,id desc);
create table public.nbc_credit_wallets (
  member_id uuid primary key references public.nbc_members(id),
  balance bigint not null default 0 check(balance between 0 and 1000000000),
  reserved bigint not null default 0 check(reserved >= 0 and reserved <= balance)
);
create table public.nbc_credit_operations (
  member_id uuid not null references public.nbc_members(id),
  id uuid not null,
  kind text not null check(kind in ('grant','usage')),
  amount bigint not null check(amount between 1 and 1000000),
  reason text not null check(length(trim(reason)) between 1 and 160),
  actor_id uuid not null references public.nbc_members(id),
  state text not null check(state in ('granted','reserved','settled','released')),
  settled_amount bigint check(settled_amount >= 0 and settled_amount <= amount),
  primary key(member_id,id)
);
create table public.nbc_credit_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.nbc_members(id),
  operation_id uuid not null,
  amount bigint not null check(amount between -1000000 and 1000000),
  reason text not null,
  created_at timestamptz not null default now(),
  foreign key(member_id,operation_id) references public.nbc_credit_operations(member_id,id),
  unique(member_id,operation_id)
);
create index nbc_credit_entries_member_idx on public.nbc_credit_entries(member_id,created_at desc,id desc);

-- One lock per wallet serializes grants, reservations, settlements and retries.
create function public.nbc_credit_apply(p_action text,p_member uuid,p_operation uuid,p_amount bigint,p_reason text,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare w public.nbc_credit_wallets; op public.nbc_credit_operations;
begin
  if p_action not in ('grant','reserve','settle','release') or p_action is null or p_amount is null or p_amount < 0 or p_amount > 1000000 or p_operation is null or p_actor is null then
    raise exception 'invalid_credit_request' using errcode = '22023';
  end if;
  if not exists(select 1 from public.nbc_members where id=p_member and status='active') then raise exception 'inactive_member' using errcode='42501'; end if;
  if p_action='grant' then
    if not exists(select 1 from public.nbc_members where id=p_actor and role='admin' and status='active') then raise exception 'admin_required' using errcode='42501'; end if;
  elsif p_actor <> p_member then raise exception 'usage_owner_required' using errcode='42501';
  end if;
  insert into public.nbc_credit_wallets(member_id) values(p_member) on conflict do nothing;
  select * into w from public.nbc_credit_wallets where member_id=p_member for update;
  select * into op from public.nbc_credit_operations where member_id=p_member and id=p_operation;
  if p_action in ('grant','reserve') then
    if p_amount < 1 or p_reason is null or length(trim(p_reason)) not between 1 and 160 then raise exception 'invalid_credit_request' using errcode='22023'; end if;
    if op.id is not null then
      if op.kind <> (case when p_action='grant' then 'grant' else 'usage' end) or op.amount<>p_amount or op.reason<>p_reason or op.actor_id<>p_actor then raise exception 'credit_idempotency_conflict' using errcode='23505'; end if;
    else
      if p_action='reserve' and w.balance-w.reserved < p_amount then raise exception 'insufficient_credits' using errcode='P0001'; end if;
      insert into public.nbc_credit_operations(member_id,id,kind,amount,reason,actor_id,state)
        values(p_member,p_operation,case when p_action='grant' then 'grant' else 'usage' end,p_amount,p_reason,p_actor,case when p_action='grant' then 'granted' else 'reserved' end);
      if p_action='grant' then
        update public.nbc_credit_wallets set balance=balance+p_amount where member_id=p_member;
        insert into public.nbc_credit_entries(member_id,operation_id,amount,reason) values(p_member,p_operation,p_amount,p_reason);
      else update public.nbc_credit_wallets set reserved=reserved+p_amount where member_id=p_member;
      end if;
    end if;
  else
    if op.id is null or op.kind<>'usage' then raise exception 'reservation_not_found' using errcode='22023'; end if;
    if p_action='release' and p_amount<>0 then raise exception 'invalid_release' using errcode='22023'; end if;
    if op.state<>'reserved' then
      if op.state<>(case when p_action='settle' then 'settled' else 'released' end) or op.settled_amount<>p_amount then raise exception 'credit_idempotency_conflict' using errcode='23505'; end if;
    else
      if p_amount>op.amount then raise exception 'charge_exceeds_reservation' using errcode='22023'; end if;
      update public.nbc_credit_wallets set balance=balance-p_amount,reserved=reserved-op.amount where member_id=p_member;
      update public.nbc_credit_operations set state=case when p_action='settle' then 'settled' else 'released' end,settled_amount=p_amount where member_id=p_member and id=p_operation;
      insert into public.nbc_credit_entries(member_id,operation_id,amount,reason) values(p_member,p_operation,-p_amount,op.reason);
    end if;
  end if;
  select * into w from public.nbc_credit_wallets where member_id=p_member;
  return jsonb_build_object('available',w.balance-w.reserved,'reserved',w.reserved);
end $$;
revoke all on function public.nbc_credit_apply(text,uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.nbc_credit_apply(text,uuid,uuid,bigint,text,uuid) to service_role;
do $$ declare t text; begin
 foreach t in array array['nbc_members','nbc_onboarding','nbc_calendar','nbc_messages','nbc_tickets','nbc_credit_wallets','nbc_credit_operations','nbc_credit_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select, insert, update on public.%I to service_role',t);
 end loop;
end $$;
-- Ledger entries are append-only for the application service role.
revoke update on public.nbc_credit_entries from service_role;
commit;
-- Reversal is intentionally not automated: financial history must not be dropped.
