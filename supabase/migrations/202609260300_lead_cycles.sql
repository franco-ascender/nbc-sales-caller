begin;
create table public.nbc_lead_cycles (
 round_id text not null,key text not null,name text not null,industry text not null,city text not null,state text not null,count integer not null,
 status text not null default 'running' check(status in ('running','paused','waiting_rate','needs_attention','completed')),
 phase text not null default 'discover' check(phase in ('discover','filter','research','verify','deliver','done')),
 message text,started_at timestamptz not null default now(),phase_started_at timestamptz not null default now(),finished_at timestamptz,
 events jsonb not null default '[]',lease uuid,lease_until timestamptz,
 primary key(round_id,key),foreign key(round_id,key) references public.nbc_pilot_slots(round_id,key)
);
alter table public.nbc_lead_cycles enable row level security;
revoke all on public.nbc_lead_cycles from public,anon,authenticated;
grant select,insert,update on public.nbc_lead_cycles to service_role;
create function public.nbc_lead_cycle_create(p_owner uuid,p_request uuid,p_input jsonb) returns text
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds;c nbc_lead_cycles;k text;n integer;unit integer;used integer;conf jsonb;begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 n:=(p_input->>'count')::integer;
 if p_request is null or n is null or n not between 5 and 50 or coalesce(p_input->>'industry','') not in ('roofing','chiropractor','medspa') or coalesce(length(p_input->>'name'),0) not between 2 and 80 or coalesce(length(p_input->>'city'),0) not between 2 and 60 or coalesce(p_input->>'state','')<>all(string_to_array('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC',' ')) then raise exception 'invalid_list';end if;
 k:='list-'||p_request::text;
 select * into c from nbc_lead_cycles where round_id=r.id and key=k;
 if found then
  if c.name<>p_input->>'name' or c.industry<>p_input->>'industry' or c.city<>p_input->>'city' or c.state<>p_input->>'state' or c.count<>n then raise exception 'request_conflict';end if;
  return k;
 end if;
 if r.paused then raise exception 'pilot_paused';end if;
 if exists(select 1 from nbc_lead_cycles where round_id=r.id and status='running') or exists(select 1 from nbc_pilot_operations where round_id=r.id and state in ('dispatching','running','uncertain')) or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if used+75>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 -- A bounded allocation, not a new global allowance. Verification still requires a separately confirmed account rate.
 unit:=coalesce((r.settings#>>'{verification,unitCents}')::integer,10);
 conf:=jsonb_build_object('industry',case p_input->>'industry' when 'medspa' then 'med spa' else p_input->>'industry' end,'city',p_input->>'city','state',p_input->>'state','count',n,'location',(p_input->>'city')||', '||(p_input->>'state')||', USA');
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'scrape',p_input->>'name',75+n*greatest(1,least(10,unit)),75,conf);
 insert into nbc_lead_cycles(round_id,key,name,industry,city,state,count,events) values(r.id,k,p_input->>'name',p_input->>'industry',p_input->>'city',p_input->>'state',n,jsonb_build_array(jsonb_build_object('phase','discover','at',now(),'message','Search authorized. Waiting to connect.')));
 return k;
end $$;
create function public.nbc_lead_cycle_claim(p_owner uuid,p_key text,p_lease uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner and not paused for update;
 if not found then raise exception 'pilot_not_found_or_paused';end if;
 update nbc_lead_cycles set lease=p_lease,lease_until=now()+interval '90 seconds' where round_id='2026-09-25-first-live-tests' and key=p_key and status='running' and (lease_until is null or lease_until<now());
 return found;
end $$;
create function public.nbc_lead_cycle_finish(p_owner uuid,p_key text,p_lease uuid,p_status text,p_phase text,p_message text) returns void
language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 update nbc_lead_cycles set
  status=case when status='paused' then 'paused' else p_status end,
  events=case when phase<>p_phase or status<>p_status then events||jsonb_build_array(jsonb_build_object('phase',p_phase,'at',now(),'message',left(p_message,300))) else events end,
  phase_started_at=case when phase<>p_phase then now() else phase_started_at end,
  phase=p_phase,message=left(p_message,300),finished_at=case when p_status='completed' and status<>'paused' then now() else finished_at end,lease=null,lease_until=null
 where round_id='2026-09-25-first-live-tests' and key=p_key and lease=p_lease;
 if not found then raise exception 'stale_step';end if;
end $$;
create function public.nbc_lead_cycle_control(p_owner uuid,p_key text,p_action text) returns void
language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 if p_action not in ('pause','resume') then raise exception 'invalid_action';end if;
 if p_action='resume' and exists(select 1 from nbc_lead_cycles where round_id='2026-09-25-first-live-tests' and key<>p_key and status='running') then raise exception 'pilot_operation_pending';end if;
 update nbc_lead_cycles set status=case when p_action='pause' then 'paused' else 'running' end,message=case when p_action='pause' then 'Paused. The current step may finish; no new step will start.' else 'Resuming saved progress.' end where round_id='2026-09-25-first-live-tests' and key=p_key and status<>'completed';
 if not found then raise exception 'list_not_resumable';end if;
end $$;
revoke all on function public.nbc_lead_cycle_create(uuid,uuid,jsonb),public.nbc_lead_cycle_claim(uuid,text,uuid),public.nbc_lead_cycle_finish(uuid,text,uuid,text,text,text),public.nbc_lead_cycle_control(uuid,text,text) from public,anon,authenticated;
grant execute on function public.nbc_lead_cycle_create(uuid,uuid,jsonb),public.nbc_lead_cycle_claim(uuid,text,uuid),public.nbc_lead_cycle_finish(uuid,text,uuid,text,text,text),public.nbc_lead_cycle_control(uuid,text,text) to service_role;
commit;
