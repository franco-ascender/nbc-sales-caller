-- Owner Cell App, Anas §4 stop-loss: "any job whose running cost per clean cell exceeds 2x the table
-- pauses, needs_attention". The table is the brain's measured cost per clean cell per recipe (A $0.05
-- to $0.07, B $0.15 to $0.27, C $0.01 to $0.02, D about A plus C). The meter already refuses over the
-- cap and over the daily ceiling; this adds the third refusal, computed from the job's own spend and
-- delivered count once there is enough signal (10 delivered cells) to judge.
begin;

alter table public.lead_engine_jobs add column if not exists expected_cost_cents_per_cell integer not null default 7
  check (expected_cost_cents_per_cell between 1 and 1000);

update public.lead_engine_jobs set expected_cost_cents_per_cell = case recipe when 'A' then 7 when 'B' then 25 when 'C' then 2 when 'D' then 9 else 7 end
  where expected_cost_cents_per_cell = 7;

create or replace function public.lead_engine_meter(p_operator uuid, p_job uuid, p_vendor text, p_step text, p_units integer, p_cents integer)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; c public.lead_engine_daily_ceilings; today integer; spend_id uuid; alert boolean := false;
        delivered integer; per_cell numeric;
begin
  if p_units is null or p_units < 0 or p_cents is null or p_cents < 0 then raise exception using errcode = 'P0001', message = 'invalid_charge'; end if;
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' and execution_enabled for update;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'execution_disabled', 'remaining_cents', 0); end if;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status not in ('sample_running','running') then
    return jsonb_build_object('allowed', false, 'reason', 'job_not_running', 'status', j.status, 'remaining_cents', j.cap_cents - j.spent_cents);
  end if;
  select * into c from public.lead_engine_daily_ceilings where vendor = p_vendor for update;
  if not found then raise exception using errcode = 'P0001', message = 'unknown_vendor'; end if;
  if j.spent_cents + p_cents > j.cap_cents then
    return jsonb_build_object('allowed', false, 'reason', 'cap', 'remaining_cents', j.cap_cents - j.spent_cents, 'requested_cents', p_cents);
  end if;
  -- Stop-loss: only once the run is past its sample and has delivered enough to measure.
  delivered := coalesce((j.progress->>'delivered')::integer, 0);
  if j.status = 'running' and delivered >= 10 then
    per_cell := (j.spent_cents + p_cents)::numeric / delivered;
    if per_cell > 2 * j.expected_cost_cents_per_cell then
      return jsonb_build_object('allowed', false, 'reason', 'stop_loss', 'remaining_cents', j.cap_cents - j.spent_cents,
        'cost_per_cell_cents', round(per_cell, 2), 'expected_cost_cents_per_cell', j.expected_cost_cents_per_cell, 'delivered', delivered);
    end if;
  end if;
  select coalesce(sum(cents), 0) into today from public.lead_engine_job_spend
    where vendor = p_vendor and created_at >= date_trunc('day', now());
  if today + p_cents > c.ceiling_cents then
    return jsonb_build_object('allowed', false, 'reason', 'daily_ceiling', 'remaining_cents', j.cap_cents - j.spent_cents,
      'vendor_today_cents', today, 'ceiling_cents', c.ceiling_cents);
  end if;
  alert := today + p_cents >= c.alert_cents;
  if p_units = 0 then
    return jsonb_build_object('allowed', true, 'reason', 'check_only', 'spend_id', null, 'remaining_cents', j.cap_cents - j.spent_cents, 'vendor_today_cents', today, 'alert', alert);
  end if;
  insert into public.lead_engine_job_spend(job_id, operator_id, vendor, step, units, cents)
    values (j.id, p_operator, p_vendor, p_step, p_units, p_cents) returning id into spend_id;
  update public.lead_engine_jobs set spent_cents = spent_cents + p_cents where id = j.id;
  return jsonb_build_object('allowed', true, 'reason', 'ok', 'spend_id', spend_id, 'remaining_cents', j.cap_cents - j.spent_cents - p_cents,
    'vendor_today_cents', today + p_cents, 'alert', alert);
end; $$;

-- create_job sets the expected cost from the recipe (the app may pass its own figure).
create or replace function public.lead_engine_create_job(p_operator uuid, p_id uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; per_cell integer; target integer; quoted integer; expected_cost integer;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  if p_id is null or p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception using errcode = 'P0001', message = 'invalid_input'; end if;
  select * into j from public.lead_engine_jobs where id = p_id;
  if found then
    if j.operator_id <> p_operator then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
    return to_jsonb(j);
  end if;
  if p_input->>'legal_status' = 'prohibited' then raise exception using errcode = 'P0001', message = 'legal_prohibited'; end if;
  target := (p_input->>'target_cells')::integer; per_cell := (p_input->>'credits_per_cell')::integer;
  quoted := target * per_cell;
  expected_cost := coalesce((p_input->>'expected_cost_cents_per_cell')::integer,
    case p_input->>'recipe' when 'A' then 7 when 'B' then 25 when 'C' then 2 when 'D' then 9 else 7 end);
  insert into public.lead_engine_jobs(id, operator_id, industry, industry_key, state, target_cells, dnc_mode, recipe, recipe_version, brain_version,
      legal_status, legal_note, expected_clean, credits_per_cell, credit_cents, cap_ratio, credits_quoted, status, quoted_at, expected_cost_cents_per_cell)
    values (p_id, p_operator, p_input->>'industry', p_input->>'industry_key', p_input->>'state', target, coalesce(p_input->>'dnc_mode', 'strict'),
      p_input->>'recipe', p_input->>'recipe_version', p_input->>'brain_version', p_input->>'legal_status', p_input->>'legal_note',
      (p_input->>'expected_clean')::numeric, per_cell, coalesce((p_input->>'credit_cents')::integer, 10), coalesce((p_input->>'cap_ratio')::numeric, 0.6),
      quoted, 'quoted', now(), expected_cost)
    returning * into j;
  insert into public.lead_engine_job_transitions(job_id, from_status, to_status, reason) values (j.id, 'draft', 'quoted', 'quoted on create');
  return to_jsonb(j);
end; $$;

-- Export guard (Anas §8): a list older than 31 days is stale; the app refuses the download unless the
-- operator overrides. Returns the oldest verification among the job's delivered rows.
create or replace function public.lead_engine_job_freshness(p_operator uuid, p_job uuid)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'oldest_verified_at', min(l.verified_at),
    'stale_rows', count(*) filter (where l.verified_at <= now() - interval '31 days'),
    'rows', count(*))
  from public.lead_engine_row_ledger l
  join public.lead_engine_jobs j on j.batch_id = l.batch_id and j.id = p_job and j.operator_id = p_operator;
$$;
revoke all on function public.lead_engine_job_freshness(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lead_engine_job_freshness(uuid, uuid) to service_role;

commit;
