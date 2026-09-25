begin;
create table public.nbc_pilot_rounds (
  id text primary key, owner_id uuid not null references auth.users(id),
  cap_cents integer not null check(cap_cents = 2500), paused boolean not null default false,
  settings jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.nbc_pilot_slots (
  round_id text not null references public.nbc_pilot_rounds(id), key text not null,
  kind text not null check(kind in ('phone','scrape')), title text not null,
  allocation_cents integer not null check(allocation_cents > 0),
  reserve_cents integer not null check(reserve_cents > 0 and reserve_cents <= allocation_cents),
  config jsonb not null default '{}', primary key(round_id,key)
);
create table public.nbc_pilot_operations (
  round_id text not null, key text not null, state text not null check(state in ('dispatching','running','uncertain','completed','failed','stopped')),
  reserved_cents integer not null check(reserved_cents>0), reported_microusd bigint check(reported_microusd>=0),
  provider jsonb not null default '{}', result jsonb not null default '{}', version integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(round_id,key), foreign key(round_id,key) references public.nbc_pilot_slots(round_id,key)
);
alter table public.nbc_pilot_rounds enable row level security;
alter table public.nbc_pilot_slots enable row level security;
alter table public.nbc_pilot_operations enable row level security;
revoke all on public.nbc_pilot_rounds, public.nbc_pilot_slots, public.nbc_pilot_operations from public, anon, authenticated;
grant select, insert, update on public.nbc_pilot_rounds, public.nbc_pilot_slots, public.nbc_pilot_operations to service_role;

create function public.nbc_pilot_reserve(p_owner uuid,p_key text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; o nbc_pilot_operations; used bigint;
begin
  select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
  if not found then raise exception 'pilot_not_found'; end if;
  select * into s from nbc_pilot_slots where round_id=r.id and key=p_key;
  if not found then raise exception 'invalid_slot'; end if;
  select * into o from nbc_pilot_operations where round_id=r.id and key=p_key;
  if found then return jsonb_build_object('acquired',false,'operation',to_jsonb(o)); end if;
  if r.paused then raise exception 'pilot_paused'; end if;
  if exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) then raise exception 'pilot_operation_pending'; end if;
  select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
  if used+s.reserve_cents>r.cap_cents then raise exception 'pilot_budget_exceeded'; end if;
  insert into nbc_pilot_operations(round_id,key,state,reserved_cents) values(r.id,p_key,'dispatching',s.reserve_cents) returning * into o;
  return jsonb_build_object('acquired',true,'operation',to_jsonb(o));
end $$;

create function public.nbc_pilot_observe(p_owner uuid,p_key text,p_version integer,p_state text,p_provider jsonb,p_result jsonb,p_reported bigint default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; o nbc_pilot_operations;
begin
  select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
  if not found then raise exception 'pilot_not_found'; end if;
  select * into o from nbc_pilot_operations where round_id=r.id and key=p_key for update;
  if not found then raise exception 'pilot_operation_missing'; end if;
  if o.version<>p_version then raise exception 'pilot_stale'; end if;
  if o.state in ('completed','failed','stopped') and p_state<>o.state then raise exception 'pilot_terminal'; end if;
  if p_reported is not null and p_reported>o.reserved_cents::bigint*10000 then
    update nbc_pilot_rounds set paused=true where id=r.id;
  end if;
  update nbc_pilot_operations set state=p_state,provider=p_provider,result=p_result,
    reported_microusd=case when p_reported is null then reported_microusd else greatest(coalesce(reported_microusd,0),p_reported) end,
    version=version+1,updated_at=now() where round_id=r.id and key=p_key returning * into o;
  return to_jsonb(o);
end $$;
revoke all on function public.nbc_pilot_reserve(uuid,text),public.nbc_pilot_observe(uuid,text,integer,text,jsonb,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.nbc_pilot_reserve(uuid,text),public.nbc_pilot_observe(uuid,text,integer,text,jsonb,jsonb,bigint) to service_role;
commit;
