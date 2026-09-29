begin;
create table if not exists public.caller_call_assets (
 owner_id uuid not null references auth.users(id),
 resource_key text not null,
 recording_path text,
 recording_status text not null default 'pending',
 note text not null default '',
 note_version integer not null default 0,
 live_transcript jsonb not null default '[]',
 live_status text,
 event_time bigint not null default 0,
 updated_at timestamptz not null default now(),
 primary key(owner_id,resource_key)
);
alter table public.caller_call_assets enable row level security;
revoke all on public.caller_call_assets from anon,authenticated;
grant all on public.caller_call_assets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('caller-recordings','caller-recordings',false,52428800,array['audio/wav','audio/mpeg','audio/mp4','audio/ogg','application/octet-stream']) on conflict(id) do nothing;
create or replace function public.nbc_phone_scenario_slot(p_owner uuid,p_request uuid,p_destination text,p_max_cents integer,p_scenario_id uuid,p_retell jsonb) returns text
language plpgsql security invoker set search_path=public as $$
declare k text; s nbc_pilot_slots; brief jsonb; r nbc_pilot_rounds;
begin
 select * into r from nbc_pilot_rounds where id='2026-09-25-first-live-tests' and owner_id=p_owner for update;
 if not found then raise exception 'pilot_not_found';end if;
 select * into s from nbc_pilot_slots where round_id=r.id and key='dial-'||p_request::text;
 if found then
  if s.config->>'destination' is distinct from p_destination or s.config->>'scenarioId' is distinct from p_scenario_id::text then raise exception 'scenario_request_conflict';end if;
  return s.key;
 end if;
 if p_scenario_id is not null then
  select sc.brief into brief from caller_conversation_scenarios sc where sc.id=p_scenario_id and sc.created_by=p_owner and sc.archived_at is null;
  if not found then raise exception 'scenario_not_found';end if;
 end if;
 if p_retell is null or p_retell->>'agentId' is null or p_retell->>'maximumCents'<>'250' then raise exception 'scenario_engine_missing';end if;
 k:=nbc_pilot_phone_slot(p_owner,p_request,p_destination,p_max_cents);
 update nbc_pilot_slots set config=config||jsonb_build_object('scenarioId',p_scenario_id,'scenarioBrief',brief,'scenario',coalesce(brief->>'title','Nalify · Garage Door Business Owner'),'retell',p_retell,'phoneEngine','retell','archiveEnabled',true) where round_id=r.id and key=k;
 return k;
end $$;
revoke all on function public.nbc_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nbc_phone_scenario_slot(uuid,uuid,text,integer,uuid,jsonb) to service_role;
create or replace function public.nbc_save_call_event(p_owner uuid,p_key text,p_time bigint,p_status text,p_transcript jsonb) returns void
language plpgsql security invoker set search_path=public as $$
begin
 insert into caller_call_assets(owner_id,resource_key,event_time,live_status,live_transcript) values(p_owner,p_key,p_time,p_status,p_transcript)
 on conflict(owner_id,resource_key) do update set event_time=excluded.event_time,live_status=case when caller_call_assets.live_status in ('ended','error','not_connected') then caller_call_assets.live_status else excluded.live_status end,live_transcript=case when jsonb_array_length(excluded.live_transcript)>=jsonb_array_length(caller_call_assets.live_transcript) then excluded.live_transcript else caller_call_assets.live_transcript end,updated_at=now() where excluded.event_time>=caller_call_assets.event_time;
end $$;
revoke all on function public.nbc_save_call_event(uuid,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.nbc_save_call_event(uuid,text,bigint,text,jsonb) to service_role;
commit;
