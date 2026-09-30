begin;
-- Separate portal RPCs: leave the external integration and its queued calls untouched.
-- Shared money reservations remain counted; only Neuron's workflow lock is isolated.
create or replace function public.nbc_portal_phone_slot(p_owner uuid,p_request uuid,p_destination text,p_max_cents integer default null) returns text
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; k text; used integer; today_calls integer;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 if p_destination !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$' or substring(p_destination from 3 for 3) in ('800','833','844','855','866','877','888','900') then raise exception 'invalid_destination';end if;
 k:='dial-'||p_request::text;
 select * into s from nbc_pilot_slots where round_id=r.id and key=k;
 if found then
  if s.config->>'phoneEngine'='neuron' or s.config->>'destination' is distinct from p_destination then raise exception 'destination_conflict';end if;
  return k;
 end if;
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and p_max_cents is distinct from 250 then raise exception 'approval_required';end if;
 if r.paused then raise exception 'pilot_paused';end if;
 if exists(select 1 from nbc_pilot_operations p left join nbc_pilot_slots ps on ps.round_id=p.round_id and ps.key=p.key where p.round_id=r.id and p.state in ('dispatching','running','uncertain') and coalesce(p.provider->>'engine',ps.config->>'phoneEngine','elevenlabs')<>'neuron') or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending';end if;
 select count(*) into today_calls from nbc_pilot_operations o join nbc_pilot_slots slot_row on slot_row.round_id=o.round_id and slot_row.key=o.key where o.round_id=r.id and slot_row.kind='phone' and o.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and today_calls>=3 then raise exception 'phone_daily_limit';end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+250>r.cap_cents then raise exception 'pilot_budget_exceeded';end if;
 insert into nbc_pilot_slots(round_id,key,kind,title,allocation_cents,reserve_cents,config) values(r.id,k,'phone','Phone trial · ending '||right(p_destination,4),250,250,jsonb_build_object('destination',p_destination,'scenario','Nalify / Garage Door Business Owner','approvedCeilingCents',p_max_cents,'approvedAt',now()));
 return k;
end $$;
create or replace function public.nbc_portal_phone_reserve(p_owner uuid,p_key text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r nbc_pilot_rounds; s nbc_pilot_slots; o nbc_pilot_operations; used bigint;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found'; end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key=p_key;
 if not found or s.kind<>'phone' or coalesce(s.config->>'phoneEngine','elevenlabs') not in ('retell','elevenlabs') then raise exception 'invalid_slot'; end if;
 select * into o from nbc_pilot_operations where round_id=r.id and key=p_key;
 if found then return jsonb_build_object('acquired',false,'operation',to_jsonb(o)); end if;
 if (coalesce(r.settings->>'perOperationApproval','false')='true') and coalesce((s.config->>'approvedCeilingCents')::integer,0)<s.reserve_cents then raise exception 'approval_required';end if;
 if r.paused then raise exception 'pilot_paused'; end if;
 if exists(select 1 from nbc_pilot_operations p left join nbc_pilot_slots ps on ps.round_id=p.round_id and ps.key=p.key where p.round_id=r.id and p.state in ('dispatching','running','uncertain') and coalesce(p.provider->>'engine',ps.config->>'phoneEngine','elevenlabs')<>'neuron') or exists(select 1 from nbc_pilot_phone_checks where round_id=r.id and state<>'completed') then raise exception 'pilot_operation_pending'; end if;
 select coalesce(sum(reserved_cents),0) into used from nbc_pilot_operations where round_id=r.id;
 used:=used+(select coalesce(sum(reserved_cents),0) from nbc_pilot_phone_checks where round_id=r.id);
 if (coalesce(r.settings->>'perOperationApproval','false')<>'true') and used+s.reserve_cents>r.cap_cents then raise exception 'pilot_budget_exceeded'; end if;
 insert into nbc_pilot_operations(round_id,key,state,reserved_cents) values(r.id,p_key,'dispatching',s.reserve_cents) returning * into o;
 return jsonb_build_object('acquired',true,'operation',to_jsonb(o));
end $$;

create or replace function public.nbc_portal_phone_scenario_slot(p_owner uuid,p_request uuid,p_destination text,p_max_cents integer,p_scenario_id uuid,p_retell jsonb) returns text
language plpgsql security invoker set search_path=public as $$
declare k text; s nbc_pilot_slots; brief jsonb; r nbc_pilot_rounds;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key='dial-'||p_request::text;
 if found then
  if s.config->>'phoneEngine'='neuron' or s.config->>'destination' is distinct from p_destination or s.config->>'scenarioId' is distinct from p_scenario_id::text then raise exception 'scenario_request_conflict';end if;
  return s.key;
 end if;
 if p_scenario_id is not null then
  select sc.brief into brief from caller_conversation_scenarios sc where sc.id=p_scenario_id and sc.created_by=p_owner and sc.archived_at is null;
  if not found then raise exception 'scenario_not_found';end if;
 end if;
 if p_retell is null or p_retell->>'agentId' is null or p_retell->>'maximumCents'<>'250' then raise exception 'scenario_engine_missing';end if;
 k:=nbc_portal_phone_slot(p_owner,p_request,p_destination,p_max_cents);
 update nbc_pilot_slots set config=config||jsonb_build_object('scenarioId',p_scenario_id,'scenarioBrief',brief,'scenario',coalesce(brief->>'title','Nalify · Garage Door Business Owner'),'retell',p_retell,'phoneEngine','retell','archiveEnabled',true) where round_id=r.id and key=k;
 return k;
end $$;
revoke all on function public.nbc_portal_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nbc_portal_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb) to service_role;

revoke all on function public.nbc_portal_phone_slot(uuid,uuid,text,integer),public.nbc_portal_phone_reserve(uuid,text) from public,anon,authenticated;
grant execute on function public.nbc_portal_phone_slot(uuid,uuid,text,integer),public.nbc_portal_phone_reserve(uuid,text) to service_role;
commit;
