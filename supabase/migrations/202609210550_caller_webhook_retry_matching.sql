begin;

create or replace function public.caller_apply_elevenlabs_postcall(
  p_receipt text,
  p_event_at timestamptz,
  p_call text,
  p_agent text,
  p_status text,
  p_started timestamptz,
  p_ended timestamptz,
  p_duration integer,
  p_transcript jsonb,
  p_summary text,
  p_analysis jsonb,
  p_failure text,
  p_cost bigint,
  p_cost_scope text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare target public.call_sessions; inserted integer; receipt_status text;
begin
  if p_status not in ('completed','failed') or jsonb_typeof(p_transcript) <> 'array' or (p_analysis is not null and jsonb_typeof(p_analysis) <> 'object') then
    raise exception 'invalid_postcall' using errcode='22023';
  end if;
  insert into public.caller_webhook_receipts(id,provider,event_type,provider_call_id,provider_agent_id,event_timestamp,status)
  values(p_receipt,'elevenlabs','post_call_transcription',p_call,p_agent,p_event_at,'unmatched') on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    select status into receipt_status from public.caller_webhook_receipts where id=p_receipt;
    if receipt_status = 'matched' then return jsonb_build_object('duplicate',true,'matched',true); end if;
  end if;

  select * into target from public.call_sessions where provider='elevenlabs' and provider_call_id=p_call and provider_agent_id=p_agent for update;
  if target.id is null then return jsonb_build_object('duplicate',inserted=0,'matched',false); end if;

  update public.call_sessions set
    status=p_status,
    started_at=coalesce(p_started,started_at),
    ended_at=coalesce(p_ended,ended_at),
    duration_seconds=coalesce(p_duration,duration_seconds),
    transcript=case when jsonb_array_length(p_transcript) >= jsonb_array_length(transcript) then p_transcript else transcript end,
    summary=coalesce(p_summary,summary),
    post_call_analysis=coalesce(p_analysis,post_call_analysis),
    failure_code=case when p_status='failed' then coalesce(p_failure,failure_code,'provider_failed') else null end,
    cost_microusd=coalesce(p_cost,cost_microusd),
    cost_scope=case when p_cost is not null then p_cost_scope else cost_scope end,
    synced_at=clock_timestamp()
  where id=target.id;
  update public.caller_webhook_receipts set session_id=target.id,status='matched' where id=p_receipt;
  return jsonb_build_object('duplicate',inserted=0,'matched',true,'sessionId',target.id);
end $$;

revoke all on function public.caller_apply_elevenlabs_postcall(text,timestamptz,text,text,text,timestamptz,timestamptz,integer,jsonb,text,jsonb,text,bigint,text) from public,anon,authenticated;
grant execute on function public.caller_apply_elevenlabs_postcall(text,timestamptz,text,text,text,timestamptz,timestamptz,integer,jsonb,text,jsonb,text,bigint,text) to service_role;

commit;
