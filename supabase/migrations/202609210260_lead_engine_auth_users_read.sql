-- Owner Cell App fix: on Supabase the service role has no SELECT on auth.users, so two functions that
-- probed it directly failed with 42501 in production (found 2026-09-21 on the first live ingest).
-- The foreign keys on operator_id already guarantee the operator exists; the probes are dropped and the
-- FK violation is mapped to the same operator_not_found message. Bodies otherwise identical.
begin;

create or replace function public.lead_engine_register_start(p_operator uuid, p_source text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.lead_engine_register_ingests;
begin
  if p_source is null or p_source !~ '^[a-z0-9_.:-]{1,80}$' then raise exception using errcode = 'P0001', message = 'invalid_source'; end if;
  if p_operator is null then raise exception using errcode = 'P0001', message = 'operator_not_found'; end if;
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into r from public.lead_engine_register_ingests where source = p_source and status in ('draft','running','needs_attention') limit 1;
  if found then return to_jsonb(r); end if;
  begin
    insert into public.lead_engine_register_ingests(source, operator_id) values (p_source, p_operator) returning * into r;
  exception when foreign_key_violation then
    raise exception using errcode = 'P0001', message = 'operator_not_found';
  end;
  return to_jsonb(r);
end; $$;

create or replace function public.lead_engine_grant_credits(p_operator uuid, p_credits integer, p_note text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_operator is null then raise exception using errcode = 'P0001', message = 'operator_not_found'; end if;
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  begin
    return public.lead_engine_credit_move(p_operator, null, 'grant', p_credits, coalesce(p_note, 'grant'));
  exception when foreign_key_violation then
    raise exception using errcode = 'P0001', message = 'operator_not_found';
  end;
end; $$;

commit;
