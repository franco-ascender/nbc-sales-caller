begin;
create table public.caller_pipelines (
 operator_id uuid not null references auth.users(id), is_demo boolean not null default false,
 version uuid not null default gen_random_uuid(), default_bucket_id uuid, primary key(operator_id,is_demo)
);
create table public.caller_buckets (
 id uuid primary key, operator_id uuid not null, is_demo boolean not null,
 name text not null check(char_length(trim(name)) between 1 and 60), color text not null check(color in ('slate','blue','green','amber','violet','rose')),
 outcome text not null check(outcome in ('active','won','lost')), position integer not null check(position between 0 and 19),
 default_key text, unique(id,operator_id,is_demo), foreign key(operator_id,is_demo) references public.caller_pipelines(operator_id,is_demo) on delete cascade
);
alter table public.caller_leads add column bucket_id uuid;
alter table public.caller_leads add column do_not_call boolean not null default false;
alter table public.caller_leads add column latest_activity_at timestamptz;
alter table public.caller_leads add column latest_activity_preview text;
update public.caller_leads set do_not_call=true where stage='do_not_call';
create unique index caller_leads_id_owner_mode_idx on public.caller_leads(id,operator_id,is_demo);
alter table public.caller_leads add constraint caller_leads_bucket_owner_fk foreign key(bucket_id,operator_id,is_demo) references public.caller_buckets(id,operator_id,is_demo);
create table public.caller_activity (
 id uuid primary key, operator_id uuid not null, is_demo boolean not null, lead_id uuid not null,
 author_id uuid not null references auth.users(id), author_name text not null check(char_length(author_name) between 1 and 160),
 kind text not null check(kind in ('note','manual_call','stage_change')), outcome text check(outcome in ('no_answer','connected','voicemail','busy','wrong_number')),
 body text not null check(char_length(body)<=4000), created_at timestamptz not null default clock_timestamp(), request_payload jsonb not null,
 foreign key(lead_id,operator_id,is_demo) references public.caller_leads(id,operator_id,is_demo) on delete cascade
);
create index caller_activity_lead_cursor_idx on public.caller_activity(operator_id,is_demo,lead_id,created_at desc,id desc);
create table public.caller_pipeline_changes (
 id uuid primary key, operator_id uuid not null, is_demo boolean not null, payload jsonb not null,
 foreign key(operator_id,is_demo) references public.caller_pipelines(operator_id,is_demo) on delete cascade
);
alter table public.caller_pipelines enable row level security;
alter table public.caller_buckets enable row level security;
alter table public.caller_activity enable row level security;
alter table public.caller_pipeline_changes enable row level security;
revoke all on public.caller_pipelines,public.caller_buckets,public.caller_activity,public.caller_pipeline_changes from public,anon,authenticated;
grant select,insert,update,delete on public.caller_pipelines,public.caller_buckets,public.caller_activity,public.caller_pipeline_changes to service_role;

create function public.caller_ensure_pipeline(p_owner uuid,p_demo boolean) returns void language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_key text; v_i integer=0;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,3));
 if exists(select 1 from caller_pipelines where operator_id=p_owner and is_demo=p_demo) then return; end if;
 insert into caller_pipelines(operator_id,is_demo) values(p_owner,p_demo);
 foreach v_key in array array['new','queued','contacted','qualified','booked','won','lost','do_not_call'] loop
  v_id:=gen_random_uuid();
  insert into caller_buckets(id,operator_id,is_demo,name,color,outcome,position,default_key) values(v_id,p_owner,p_demo,
   (array['New leads','Ready to call','Contacted','Qualified','Booked','Won','Lost','Do not call'])[v_i+1],
   (array['slate','amber','blue','violet','blue','green','rose','slate'])[v_i+1],case when v_key in ('won','lost') then v_key else 'active' end,v_i,v_key);
  if v_i=0 then update caller_pipelines set default_bucket_id=v_id where operator_id=p_owner and is_demo=p_demo; end if;
  update caller_leads set bucket_id=v_id where operator_id=p_owner and is_demo=p_demo and stage=v_key and bucket_id is null;
  v_i:=v_i+1;
 end loop;
end;$$;

create function public.caller_bucket_on_lead() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_default uuid; v_bucket uuid; v_outcome text;
begin
 if tg_op='INSERT' then perform pg_advisory_xact_lock(hashtextextended(new.operator_id::text,3)); end if;
 if new.stage='do_not_call' then new.do_not_call:=true; end if;
 select default_bucket_id into v_default from caller_pipelines where operator_id=new.operator_id and is_demo=new.is_demo;
 if v_default is null then return new; end if;
 if new.bucket_id is null then
  select id into v_bucket from caller_buckets where operator_id=new.operator_id and is_demo=new.is_demo and default_key=new.stage order by position limit 1;
  new.bucket_id:=case when tg_op='INSERT' and new.stage='new' then v_default else coalesce(v_bucket,v_default) end;
 end if;
 if tg_op='INSERT' then
  select outcome into v_outcome from caller_buckets where id=new.bucket_id;
  if v_outcome in ('won','lost') then new.stage:=v_outcome; end if;
 end if;
 return new;
end;$$;
create trigger caller_lead_bucket before insert or update of stage,bucket_id,do_not_call on public.caller_leads for each row execute function public.caller_bucket_on_lead();

create function public.caller_save_pipeline(p_owner uuid,p_demo boolean,p_request uuid,p_payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare v_version uuid; v_old caller_pipeline_changes%rowtype; v_count int; v_row record; v_target uuid; v_default uuid; v_ids uuid[]; v_stage jsonb; v_pos int=0;
begin
 perform caller_ensure_pipeline(p_owner,p_demo);
 select * into v_old from caller_pipeline_changes where id=p_request;
 if found then if v_old.operator_id<>p_owner or v_old.is_demo<>p_demo or v_old.payload<>p_payload then raise exception 'request_conflict'; end if; return; end if;
 select version into v_version from caller_pipelines where operator_id=p_owner and is_demo=p_demo for update;
 if v_version is distinct from (p_payload->>'version')::uuid then raise exception 'pipeline_conflict'; end if;
 if jsonb_typeof(p_payload->'buckets') is distinct from 'array' then raise exception 'invalid_pipeline'; end if;
 v_count:=jsonb_array_length(p_payload->'buckets'); if v_count not between 1 and 20 then raise exception 'invalid_pipeline'; end if;
 select array_agg((x->>'id')::uuid) into v_ids from jsonb_array_elements(p_payload->'buckets') x;
 if (select count(distinct x) from unnest(v_ids) x)<>v_count then raise exception 'invalid_pipeline'; end if;
 v_default:=(p_payload->>'defaultId')::uuid; if v_default is null or not(v_default=any(v_ids)) then raise exception 'invalid_pipeline'; end if;
 for v_stage in select * from jsonb_array_elements(p_payload->'buckets') loop
  if exists(select 1 from caller_buckets where id=(v_stage->>'id')::uuid and (operator_id<>p_owner or is_demo<>p_demo)) then raise exception 'invalid_pipeline'; end if;
  insert into caller_buckets(id,operator_id,is_demo,name,color,outcome,position) values((v_stage->>'id')::uuid,p_owner,p_demo,trim(v_stage->>'name'),v_stage->>'color',v_stage->>'outcome',v_pos)
   on conflict(id) do update set name=excluded.name,color=excluded.color,outcome=excluded.outcome,position=excluded.position;
  v_pos:=v_pos+1;
 end loop;
 for v_row in select id from caller_buckets where operator_id=p_owner and is_demo=p_demo and not(id=any(v_ids)) loop
  v_target:=(p_payload->'reassign'->>v_row.id::text)::uuid;
  if v_target is null or not(v_target=any(v_ids)) then raise exception 'missing_destination'; end if;
  update caller_leads set bucket_id=v_target,updated_at=clock_timestamp() where operator_id=p_owner and is_demo=p_demo and bucket_id=v_row.id;
  delete from caller_buckets where id=v_row.id and operator_id=p_owner and is_demo=p_demo;
 end loop;
 -- Keep operational outcomes compatible while custom names/order remain independent.
 update caller_leads l set stage=case when b.outcome='active' then case when l.stage in ('won','lost') then 'new' else l.stage end else b.outcome end,updated_at=clock_timestamp()
 from caller_buckets b where l.bucket_id=b.id and l.operator_id=p_owner and l.is_demo=p_demo and ((b.outcome='active' and l.stage in ('won','lost')) or (b.outcome<>'active' and l.stage<>b.outcome));
 update caller_pipelines set version=gen_random_uuid(),default_bucket_id=v_default where operator_id=p_owner and is_demo=p_demo;
 insert into caller_pipeline_changes values(p_request,p_owner,p_demo,p_payload);
end;$$;

create function public.caller_add_activity(p_owner uuid,p_demo boolean,p_lead uuid,p_id uuid,p_author text,p_kind text,p_outcome text,p_body text) returns void language plpgsql security invoker set search_path=public as $$
declare v_old caller_activity%rowtype; v_payload jsonb; v_at timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,3));
 if not exists(select 1 from caller_leads where id=p_lead and operator_id=p_owner and is_demo=p_demo) then raise exception 'lead_not_found'; end if;
 if p_kind not in ('note','manual_call') or p_kind is null or p_body is null or char_length(p_body)>4000 or (p_kind='note' and (trim(p_body)='' or p_outcome is not null)) or (p_kind='manual_call' and (p_outcome is null or p_outcome not in ('no_answer','connected','voicemail','busy','wrong_number'))) then raise exception 'invalid_activity'; end if;
 v_payload:=jsonb_build_object('lead',p_lead,'kind',p_kind,'outcome',p_outcome,'body',p_body);
 select * into v_old from caller_activity where id=p_id;
 if found then if v_old.operator_id<>p_owner or v_old.is_demo<>p_demo or v_old.request_payload<>v_payload then raise exception 'request_conflict'; end if; return; end if;
 insert into caller_activity(id,operator_id,is_demo,lead_id,author_id,author_name,kind,outcome,body,request_payload) values(p_id,p_owner,p_demo,p_lead,p_owner,p_author,p_kind,p_outcome,p_body,v_payload) returning created_at into v_at;
 update caller_leads set latest_activity_at=v_at,latest_activity_preview=left(case when p_kind='note' then p_body else 'Call logged: '||replace(p_outcome,'_',' ')||case when p_body<>'' then ' — '||p_body else '' end end,180) where id=p_lead and operator_id=p_owner and is_demo=p_demo;
end;$$;

create function public.caller_move_lead(p_owner uuid,p_demo boolean,p_lead uuid,p_request uuid,p_author text,p_payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare v_old caller_activity%rowtype; v_lead caller_leads%rowtype; v_bucket caller_buckets%rowtype; v_body text; v_at timestamptz;
begin
 perform caller_ensure_pipeline(p_owner,p_demo);
 select * into v_lead from caller_leads where id=p_lead and operator_id=p_owner and is_demo=p_demo for update;
 if not found then raise exception 'lead_not_found'; end if;
 select * into v_old from caller_activity where id=p_request;
 if found then if v_old.operator_id<>p_owner or v_old.lead_id<>p_lead or v_old.is_demo<>p_demo or v_old.request_payload<>p_payload then raise exception 'request_conflict'; end if; return; end if;
 if v_lead.updated_at is distinct from (p_payload->>'updatedAt')::timestamptz then raise exception 'lead_conflict'; end if;
 select * into v_bucket from caller_buckets where id=(p_payload->>'bucketId')::uuid and operator_id=p_owner and is_demo=p_demo;
 if not found or jsonb_typeof(p_payload->'doNotCall') is distinct from 'boolean' then raise exception 'invalid_bucket'; end if;
 v_body:='Moved to '||v_bucket.name||'. Do not call: '||case when (p_payload->>'doNotCall')::boolean then 'on' else 'off' end||'.';
 update caller_leads set bucket_id=v_bucket.id,do_not_call=(p_payload->>'doNotCall')::boolean,stage=case when v_bucket.outcome='active' then 'new' else v_bucket.outcome end,updated_at=clock_timestamp() where id=p_lead and operator_id=p_owner and is_demo=p_demo;
 insert into caller_activity(id,operator_id,is_demo,lead_id,author_id,author_name,kind,body,request_payload) values(p_request,p_owner,p_demo,p_lead,p_owner,p_author,'stage_change',v_body,p_payload) returning created_at into v_at;
 update caller_leads set latest_activity_at=v_at,latest_activity_preview=left(v_body,180) where id=p_lead and operator_id=p_owner and is_demo=p_demo;
end;$$;
revoke all on function public.caller_ensure_pipeline(uuid,boolean),public.caller_save_pipeline(uuid,boolean,uuid,jsonb),public.caller_add_activity(uuid,boolean,uuid,uuid,text,text,text,text),public.caller_move_lead(uuid,boolean,uuid,uuid,text,jsonb),public.caller_bucket_on_lead() from public,anon,authenticated;
grant execute on function public.caller_ensure_pipeline(uuid,boolean),public.caller_save_pipeline(uuid,boolean,uuid,jsonb),public.caller_add_activity(uuid,boolean,uuid,uuid,text,text,text,text),public.caller_move_lead(uuid,boolean,uuid,uuid,text,jsonb),public.caller_bucket_on_lead() to service_role;
commit;
