begin;
alter table public.caller_leads add column if not exists is_demo boolean not null default false;
alter table public.call_sessions add column if not exists is_demo boolean not null default false;
alter table public.call_sessions add column if not exists lead_id uuid references public.caller_leads(id) on delete set null;
create unique index if not exists caller_leads_id_owner_idx on public.caller_leads(id,operator_id);
create table if not exists public.caller_lead_lists(
 id uuid primary key, operator_id uuid not null references auth.users(id),
 name text not null check(char_length(name) between 1 and 100), is_demo boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,operator_id)
);
create table if not exists public.caller_lead_list_items(
 list_id uuid not null, lead_id uuid not null, operator_id uuid not null,
 primary key(list_id,lead_id),
 foreign key(list_id,operator_id) references public.caller_lead_lists(id,operator_id) on delete cascade,
 foreign key(lead_id,operator_id) references public.caller_leads(id,operator_id) on delete cascade
);
alter table public.caller_lead_lists enable row level security;
alter table public.caller_lead_list_items enable row level security;
revoke all on public.caller_lead_lists,public.caller_lead_list_items from public,anon,authenticated;
grant select,insert,update,delete on public.caller_lead_lists,public.caller_lead_list_items to service_role;
-- Deletion is only exposed by the admin demo RPC, with explicit owner AND demo predicates.
grant delete on public.caller_leads,public.call_sessions to service_role;
create or replace function public.caller_save_list(p_operator uuid,p_id uuid,p_name text,p_leads uuid[],p_demo boolean default false)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_count integer;
begin
 if p_name is null or p_leads is null or p_demo is null or char_length(trim(p_name)) not between 1 and 100 or cardinality(p_leads) not between 1 and 500 then raise exception 'invalid_list'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,3));
 select count(*) into v_count from caller_leads where id=any(p_leads) and operator_id=p_operator and is_demo=p_demo;
 if v_count <> cardinality(p_leads) then raise exception 'invalid_selection'; end if;
 if exists(select 1 from caller_lead_lists where id=p_id and (operator_id<>p_operator or is_demo<>p_demo)) then raise exception 'invalid_list'; end if;
 insert into caller_lead_lists(id,operator_id,name,is_demo) values(p_id,p_operator,trim(p_name),p_demo)
 on conflict(id) do update set name=excluded.name,updated_at=now() where caller_lead_lists.operator_id=p_operator;
 delete from caller_lead_list_items where list_id=p_id and operator_id=p_operator;
 insert into caller_lead_list_items(list_id,lead_id,operator_id) select p_id,unnest(p_leads),p_operator;
 return p_id;
end;$$;
create or replace function public.caller_demo_set(p_operator uuid,p_enabled boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_lead uuid; v_list uuid; v_ids uuid[]='{}'; v_stage text; v_date timestamptz; i integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,3));
 if not p_enabled then
  delete from call_sessions where operator_id=p_operator and is_demo=true;
  delete from caller_lead_lists where operator_id=p_operator and is_demo=true;
  delete from caller_leads where operator_id=p_operator and is_demo=true;
  return jsonb_build_object('enabled',false);
 end if;
 if exists(select 1 from caller_leads where operator_id=p_operator and is_demo=true) then return jsonb_build_object('enabled',true); end if;
 for i in 1..32 loop
  v_stage := (array['new','queued','contacted','qualified','booked','won','lost','do_not_call'])[1+((i*7)%8)];
  v_date := now()-((i%14)||' days')::interval;
  insert into caller_leads(operator_id,name,phone,email,company,source,stage,notes,is_demo,created_at)
  values(p_operator,'DEMO '||(array['Avery Cole','Jordan Lee','Taylor Brooks','Morgan Reed','Riley James','Alex Hayes','Casey Lane','Sam Parker'])[1+(i%8)]||' '||i,
  '+12125550'||lpad((100+i)::text,3,'0'),'demo'||i||'@example.test','DEMO '||(array['North Studio','Atlas Agency','Summit Group','Cedar Partners'])[1+(i%4)],'Development demo',v_stage,'Synthetic development data. No real outreach.',true,v_date)
  on conflict(operator_id,phone) do nothing returning id into v_lead;
  if v_lead is null then continue; end if;
  v_ids:=array_append(v_ids,v_lead);
  if i%4<>0 then
   insert into call_sessions(id,operator_id,provider,provider_agent_id,provider_call_id,channel,status,created_at,started_at,ended_at,duration_seconds,transcript,summary,synced_at,is_demo,lead_id)
   values(gen_random_uuid(),p_operator,'elevenlabs','development-demo',null,'phone','completed',v_date,v_date,v_date+make_interval(secs=>45+i*9),45+i*9,
    jsonb_build_array(jsonb_build_object('role','agent','message','DEMO simulation. This call is going to be recorded for educational purposes. How can we help your team?','time_in_call_secs',0),
    jsonb_build_object('role','user','message',(array['DEMO: I need to think it over. Please send me more information.','DEMO: The price is too high. I need to talk to my partner.','DEMO: Can we reschedule? Call me back tomorrow.','DEMO: I am not interested. Please stop calling.','DEMO: We want to learn more about improving our lead follow-up.'])[1+(i%5)],'time_in_call_secs',12)),
    'DEMO conversation — synthetic transcript, not a real phone call.',v_date,true,v_lead);
  end if;
 end loop;
 if cardinality(v_ids)>0 then v_list:=gen_random_uuid(); perform caller_save_list(p_operator,v_list,'DEMO · First outreach',v_ids,true); end if;
 return jsonb_build_object('enabled',true);
end;$$;
revoke all on function public.caller_save_list(uuid,uuid,text,uuid[],boolean),public.caller_demo_set(uuid,boolean) from public,anon,authenticated;
grant execute on function public.caller_save_list(uuid,uuid,text,uuid[],boolean),public.caller_demo_set(uuid,boolean) to service_role;
alter table public.caller_voice_jobs add column if not exists kind text not null default 'design' check(kind in ('design','clone'));
alter table public.caller_voice_jobs add column if not exists sample_hash text;
alter table public.caller_voice_jobs add column if not exists needs_verification boolean not null default false;
alter table public.caller_voice_jobs add column if not exists failure_code text;
alter table public.caller_voice_jobs drop constraint if exists caller_voice_jobs_status_check;
alter table public.caller_voice_jobs add constraint caller_voice_jobs_status_check check(status in ('preparing','completed','uncertain','failed'));
commit;
