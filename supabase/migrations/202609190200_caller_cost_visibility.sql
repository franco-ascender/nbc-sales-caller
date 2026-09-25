begin;

alter table public.call_sessions
  add column if not exists cost_microusd bigint check(cost_microusd between 0 and 1000000000000),
  add column if not exists cost_scope text not null default 'unknown' check(cost_scope in ('unknown','llm_only','total'));

create or replace function public.nbc_usage_record(p_member uuid,p_source text,p_key text,p_feature text,p_input bigint,p_output bigint,p_cached bigint,p_seconds integer,p_cost bigint,p_scope text,p_at timestamptz) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare row_id uuid;begin
 insert into public.nbc_usage_events(member_id,source,event_key,feature,input_tokens,output_tokens,cached_tokens,duration_seconds,cost_microusd,cost_scope,occurred_at)
 values(p_member,p_source,p_key,p_feature,p_input,p_output,p_cached,p_seconds,p_cost,p_scope,p_at)
 on conflict(source,event_key) do update set
  input_tokens=coalesce(excluded.input_tokens,nbc_usage_events.input_tokens),
  output_tokens=coalesce(excluded.output_tokens,nbc_usage_events.output_tokens),
  cached_tokens=coalesce(excluded.cached_tokens,nbc_usage_events.cached_tokens),
  duration_seconds=coalesce(excluded.duration_seconds,nbc_usage_events.duration_seconds),
  cost_microusd=case when excluded.cost_scope='total' and nbc_usage_events.cost_scope<>'total' then excluded.cost_microusd when nbc_usage_events.cost_microusd is null then excluded.cost_microusd else nbc_usage_events.cost_microusd end,
  cost_scope=case when excluded.cost_scope='total' and nbc_usage_events.cost_scope<>'total' then 'total' when nbc_usage_events.cost_microusd is null then excluded.cost_scope else nbc_usage_events.cost_scope end
 where nbc_usage_events.member_id=excluded.member_id and nbc_usage_events.feature=excluded.feature
 returning id into row_id;
 if row_id is null then raise exception 'usage_identity_conflict' using errcode='23505';end if;return row_id;
end $$;

revoke all on function public.nbc_usage_record(uuid,text,text,text,bigint,bigint,bigint,integer,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.nbc_usage_record(uuid,text,text,text,bigint,bigint,bigint,integer,bigint,text,timestamptz) to service_role;

commit;
