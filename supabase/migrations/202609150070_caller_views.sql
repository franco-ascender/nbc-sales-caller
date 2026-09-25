begin;
create table public.caller_views (
 operator_id uuid not null references auth.users(id) on delete cascade,
 is_demo boolean not null default false,
 scope text not null check(scope in ('analytics','crm')),
 config jsonb not null check(jsonb_typeof(config)='object' and octet_length(config::text)<=65536),
 version uuid not null default gen_random_uuid(),
 last_request uuid not null,
 last_payload jsonb not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(operator_id,is_demo,scope)
);
alter table public.caller_views enable row level security;
revoke all on public.caller_views from public,anon,authenticated;
grant all on public.caller_views to service_role;
create function public.caller_save_view(p_owner uuid,p_demo boolean,p_scope text,p_version uuid,p_request uuid,p_config jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare saved public.caller_views; payload jsonb;
begin
 if p_owner is null or p_request is null or p_demo is null or p_scope not in ('analytics','crm') or jsonb_typeof(p_config) is distinct from 'object' then raise exception 'invalid_view';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_demo::text||p_scope,5));
 payload:=jsonb_build_object('version',p_version,'config',p_config);
 select * into saved from public.caller_views where operator_id=p_owner and is_demo=p_demo and scope=p_scope for update;
 if found then
  if saved.last_request=p_request then
   if saved.last_payload=payload then return;end if;
   raise exception 'view_conflict';
  end if;
  if p_version is distinct from saved.version then raise exception 'view_conflict';end if;
 elsif p_version is not null then raise exception 'view_conflict';end if;
 insert into public.caller_views(operator_id,is_demo,scope,config,last_request,last_payload) values(p_owner,p_demo,p_scope,p_config,p_request,payload)
 on conflict(operator_id,is_demo,scope) do update set config=excluded.config,version=gen_random_uuid(),last_request=excluded.last_request,last_payload=excluded.last_payload,updated_at=clock_timestamp();
end;$$;
revoke all on function public.caller_save_view(uuid,boolean,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.caller_save_view(uuid,boolean,text,uuid,uuid,jsonb) to service_role;
commit;
