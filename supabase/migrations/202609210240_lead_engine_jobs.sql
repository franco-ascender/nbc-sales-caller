-- Owner Cell App, Phase 0 tasks 2, 3 and 4: the credits ledger, the job state machine and the meter.
-- Additive on top of 202609140010 and 202609210230 (both untouched).
--
-- One job = one order for N owner cells. Credits are held at quote, settled on delivered cells only, and
-- released or refunded otherwise. Every paid call goes through lead_engine_meter, which checks the job cap
-- (credits held x $0.10 x 0.6) and the vendor's daily ceiling BEFORE the money leaves, and records the
-- spend AFTER. Nothing dies: a job that hits a wall goes to needs_attention with the status it must
-- resume from, and lead_engine_resume_job puts it back.
begin;

-- Recipe D (register phone vs Maps phone) joins the lanes the plan table accepts.
alter table public.lead_engine_plans drop constraint if exists lead_engine_plans_lane_check;
alter table public.lead_engine_plans add constraint lead_engine_plans_lane_check check (lane in ('A','B','C','D'));

-- 1. Jobs and their transitions.
create table if not exists public.lead_engine_jobs (
  id uuid primary key,
  operator_id uuid not null references auth.users(id),
  scope text not null default 'nbc-internal' references public.lead_engine_control(scope),
  industry text not null check (length(btrim(industry)) between 1 and 80),
  industry_key text not null check (industry_key ~ '^[a-z0-9_]{1,60}$'),
  state text not null check (state ~ '^[A-Z]{2}$'),
  target_cells integer not null check (target_cells between 1 and 100000),
  dnc_mode text not null default 'strict' check (dnc_mode in ('strict','flag')),
  recipe text not null check (recipe in ('A','B','C','D')),
  recipe_version text not null check (length(recipe_version) between 1 and 40),
  brain_version text not null check (length(brain_version) between 1 and 40),
  legal_status text not null check (legal_status in ('ok','restricted')),
  legal_note text check (legal_note is null or length(legal_note) <= 600),
  expected_clean numeric(5,4) not null check (expected_clean > 0 and expected_clean <= 1),
  credits_per_cell integer not null check (credits_per_cell between 1 and 100),
  credit_cents integer not null default 10 check (credit_cents between 1 and 1000),
  cap_ratio numeric(4,3) not null default 0.600 check (cap_ratio > 0 and cap_ratio <= 1),
  credits_quoted integer not null default 0 check (credits_quoted >= 0),
  credits_held integer not null default 0 check (credits_held >= 0),
  credits_settled integer not null default 0 check (credits_settled >= 0),
  cap_cents integer not null default 0 check (cap_cents >= 0),
  spent_cents integer not null default 0 check (spent_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft','quoted','sample_running','sample_done','running','delivered','needs_attention')),
  resume_from text check (resume_from is null or resume_from in ('sample_running','running')),
  attention_reason text check (attention_reason is null or length(attention_reason) <= 600),
  sample jsonb not null default '{}' check (jsonb_typeof(sample) = 'object'),
  progress jsonb not null default '{}' check (jsonb_typeof(progress) = 'object'),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  plan_id uuid,
  batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quoted_at timestamptz,
  delivered_at timestamptz,
  unique (id, operator_id),
  check (spent_cents <= cap_cents),
  check (status not in ('sample_running','sample_done','running') or credits_held > 0),
  check (status <> 'needs_attention' or attention_reason is not null),
  check (status <> 'delivered' or (delivered_at is not null and credits_held = 0))
);
create index if not exists lead_engine_jobs_operator_idx on public.lead_engine_jobs(operator_id, created_at desc);

create table if not exists public.lead_engine_job_transitions (
  id bigserial primary key,
  job_id uuid not null references public.lead_engine_jobs(id),
  from_status text not null,
  to_status text not null,
  reason text check (reason is null or length(reason) <= 600),
  created_at timestamptz not null default now()
);

create or replace function public.lead_engine_job_transition() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  new.updated_at := now();
  if new.status = old.status then return new; end if;
  if not (old.status = 'draft' and new.status = 'quoted'
       or old.status = 'quoted' and new.status in ('sample_running','draft')
       or old.status = 'sample_running' and new.status in ('sample_done','needs_attention')
       or old.status = 'sample_done' and new.status in ('running','needs_attention')
       or old.status = 'running' and new.status in ('delivered','needs_attention')
       or old.status = 'needs_attention' and new.status in ('sample_running','running','delivered')) then
    raise exception using errcode = 'P0001', message = 'invalid_job_transition';
  end if;
  insert into public.lead_engine_job_transitions(job_id, from_status, to_status, reason)
    values (new.id, old.status, new.status, new.attention_reason);
  return new;
end; $$;
drop trigger if exists lead_engine_job_transition on public.lead_engine_jobs;
create trigger lead_engine_job_transition before update on public.lead_engine_jobs
  for each row execute function public.lead_engine_job_transition();

-- 2. Credits ledger: append only. available = what the operator can hold; held = what jobs have locked.
create table if not exists public.lead_engine_credits_ledger (
  id uuid primary key default gen_random_uuid(),
  -- Two moves in one transaction share created_at; the sequence keeps the balance chain unambiguous.
  seq bigserial not null unique,
  operator_id uuid not null references auth.users(id),
  job_id uuid references public.lead_engine_jobs(id),
  kind text not null check (kind in ('grant','hold','settle','release','refund')),
  credits integer not null check (credits > 0),
  available_after integer not null check (available_after >= 0),
  held_after integer not null check (held_after >= 0),
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  check ((kind = 'grant') = (job_id is null))
);
create index if not exists lead_engine_credits_ledger_operator_idx on public.lead_engine_credits_ledger(operator_id, created_at desc);

create or replace function public.lead_engine_credit_balance(p_operator uuid)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  select coalesce((select jsonb_build_object('available', available_after, 'held', held_after)
                     from public.lead_engine_credits_ledger where operator_id = p_operator
                     order by seq desc limit 1),
                  jsonb_build_object('available', 0, 'held', 0));
$$;

-- Internal helper: one ledger line, computed from the last balance. Callers hold the control lock.
create or replace function public.lead_engine_credit_move(p_operator uuid, p_job uuid, p_kind text, p_credits integer, p_note text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare bal jsonb; available integer; held integer;
begin
  if p_credits is null or p_credits <= 0 then raise exception using errcode = 'P0001', message = 'invalid_credits'; end if;
  bal := public.lead_engine_credit_balance(p_operator);
  available := (bal->>'available')::integer; held := (bal->>'held')::integer;
  if p_kind = 'grant' then available := available + p_credits;
  elsif p_kind = 'hold' then
    if available < p_credits then raise exception using errcode = 'P0001', message = 'insufficient_credits'; end if;
    available := available - p_credits; held := held + p_credits;
  elsif p_kind = 'settle' then
    if held < p_credits then raise exception using errcode = 'P0001', message = 'ledger_inconsistent'; end if;
    held := held - p_credits;
  elsif p_kind in ('release','refund') then
    if held < p_credits then raise exception using errcode = 'P0001', message = 'ledger_inconsistent'; end if;
    held := held - p_credits; available := available + p_credits;
  else raise exception using errcode = 'P0001', message = 'invalid_kind';
  end if;
  insert into public.lead_engine_credits_ledger(operator_id, job_id, kind, credits, available_after, held_after, note)
    values (p_operator, p_job, p_kind, p_credits, available, held, p_note);
  return jsonb_build_object('available', available, 'held', held);
end; $$;

create or replace function public.lead_engine_grant_credits(p_operator uuid, p_credits integer, p_note text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  if not exists(select 1 from auth.users where id = p_operator) then raise exception using errcode = 'P0001', message = 'operator_not_found'; end if;
  return public.lead_engine_credit_move(p_operator, null, 'grant', p_credits, coalesce(p_note, 'grant'));
end; $$;

-- 3. Spend per paid call, and the daily ceiling per vendor.
create table if not exists public.lead_engine_job_spend (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.lead_engine_jobs(id),
  operator_id uuid not null references auth.users(id),
  vendor text not null check (vendor in ('outscraper','apify','batchdata','telnyx','datazapp')),
  step text not null check (step in ('scrape','verify','trace','line_type','cell_append','litigator','reviews')),
  units integer not null check (units > 0),
  cents integer not null check (cents >= 0),
  provider_ref text check (provider_ref is null or length(provider_ref) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists lead_engine_job_spend_job_idx on public.lead_engine_job_spend(job_id, created_at);
create index if not exists lead_engine_job_spend_vendor_day_idx on public.lead_engine_job_spend(vendor, created_at);

create table if not exists public.lead_engine_daily_ceilings (
  vendor text primary key check (vendor in ('outscraper','apify','batchdata','telnyx','datazapp')),
  ceiling_cents integer not null check (ceiling_cents >= 0),
  alert_cents integer not null check (alert_cents between 0 and ceiling_cents),
  updated_at timestamptz not null default now()
);
insert into public.lead_engine_daily_ceilings(vendor, ceiling_cents, alert_cents) values
  ('outscraper', 5000, 4000), ('apify', 5000, 4000), ('batchdata', 5000, 4000), ('telnyx', 0, 0), ('datazapp', 0, 0)
on conflict (vendor) do nothing;

-- The meter. Checks first, records second, never both halves apart. Returns allowed=false with the
-- reason instead of raising so the caller can deliver what exists and stop cleanly. p_units = 0 is a
-- pure check (would this spend be allowed?) that records nothing.
create or replace function public.lead_engine_meter(p_operator uuid, p_job uuid, p_vendor text, p_step text, p_units integer, p_cents integer)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; c public.lead_engine_daily_ceilings; today integer; spend_id uuid; alert boolean := false;
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

-- 4. Job lifecycle RPCs. The brain lives in the app; the app passes the route it resolved.
create or replace function public.lead_engine_create_job(p_operator uuid, p_id uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; per_cell integer; target integer; quoted integer;
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
  insert into public.lead_engine_jobs(id, operator_id, industry, industry_key, state, target_cells, dnc_mode, recipe, recipe_version, brain_version,
      legal_status, legal_note, expected_clean, credits_per_cell, credit_cents, cap_ratio, credits_quoted, status, quoted_at)
    values (p_id, p_operator, p_input->>'industry', p_input->>'industry_key', p_input->>'state', target, coalesce(p_input->>'dnc_mode', 'strict'),
      p_input->>'recipe', p_input->>'recipe_version', p_input->>'brain_version', p_input->>'legal_status', p_input->>'legal_note',
      (p_input->>'expected_clean')::numeric, per_cell, coalesce((p_input->>'credit_cents')::integer, 10), coalesce((p_input->>'cap_ratio')::numeric, 0.6),
      quoted, 'quoted', now())
    returning * into j;
  insert into public.lead_engine_job_transitions(job_id, from_status, to_status, reason) values (j.id, 'draft', 'quoted', 'quoted on create');
  return to_jsonb(j);
end; $$;

-- Hold the quoted credits and open the job's batch so the delivery gate and the row ledger have a home.
create or replace function public.lead_engine_hold_job(p_operator uuid, p_job uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; cap integer; plan uuid; batch uuid;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status <> 'quoted' then return to_jsonb(j); end if;
  cap := floor(j.credits_quoted * j.credit_cents * j.cap_ratio);
  if cap < 1 then raise exception using errcode = 'P0001', message = 'cap_too_small'; end if;
  perform public.lead_engine_credit_move(p_operator, j.id, 'hold', j.credits_quoted, 'hold at quote');
  plan := gen_random_uuid(); batch := gen_random_uuid();
  insert into public.lead_engine_plans(id, operator_id, input, lane, benchmark_version, forecast_cents, hard_budget_cents)
    values (plan, p_operator, jsonb_build_object('job', j.id, 'industry', j.industry, 'state', j.state, 'target', j.target_cells), j.recipe, j.brain_version, cap, cap);
  insert into public.lead_engine_batches(id, plan_id, operator_id, stage, status, businesses, estimate_cents, reserved_cents, evidence_ref, recipe_version, brain_version)
    values (batch, plan, p_operator, 'scale', 'reserved', j.target_cells, cap, cap, 'job ' || j.id::text || ' hold', j.recipe_version, j.brain_version);
  update public.lead_engine_jobs set credits_held = credits_quoted, cap_cents = cap, plan_id = plan, batch_id = batch, status = 'sample_running'
    where id = j.id returning * into j;
  return to_jsonb(j);
end; $$;

-- Sample gate: pass moves on; fail refunds the whole hold and parks the job with the numbers.
create or replace function public.lead_engine_sample_result(p_operator uuid, p_job uuid, p_sample jsonb, p_pass boolean, p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status <> 'sample_running' then raise exception using errcode = 'P0001', message = 'invalid_job_transition'; end if;
  if p_pass then
    update public.lead_engine_jobs set sample = coalesce(p_sample, '{}'), status = 'sample_done' where id = j.id returning * into j;
    update public.lead_engine_jobs set status = 'running' where id = j.id returning * into j;
  else
    update public.lead_engine_jobs set sample = coalesce(p_sample, '{}'), status = 'needs_attention', resume_from = null,
      attention_reason = coalesce(p_reason, 'sample_below_expected') where id = j.id returning * into j;
    perform public.lead_engine_credit_move(p_operator, j.id, 'refund', j.credits_held, 'sample below expected');
    update public.lead_engine_jobs set credits_held = 0 where id = j.id returning * into j;
    perform public.lead_engine_close_batch(j.batch_id, j.spent_cents, 'sample failed');
  end if;
  return to_jsonb(j);
end; $$;

-- Freeze (any API error, cap, ceiling): keep the hold, remember where to resume.
create or replace function public.lead_engine_freeze_job(p_operator uuid, p_job uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status = 'needs_attention' then return to_jsonb(j); end if;
  if j.status not in ('sample_running','running') then raise exception using errcode = 'P0001', message = 'invalid_job_transition'; end if;
  update public.lead_engine_jobs set status = 'needs_attention', resume_from = j.status, attention_reason = left(coalesce(p_reason, 'frozen'), 600)
    where id = j.id returning * into j;
  return to_jsonb(j);
end; $$;

-- Resume: back to the frozen step. With p_extra_credits the cap grows (the usual answer to a cap stop).
create or replace function public.lead_engine_resume_job(p_operator uuid, p_job uuid, p_extra_credits integer)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; extra integer := coalesce(p_extra_credits, 0);
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status <> 'needs_attention' or j.resume_from is null or j.credits_held = 0 then raise exception using errcode = 'P0001', message = 'not_resumable'; end if;
  if extra > 0 then
    perform public.lead_engine_credit_move(p_operator, j.id, 'hold', extra, 'top up on resume');
    update public.lead_engine_jobs set credits_held = credits_held + extra, cap_cents = floor((credits_held + extra) * credit_cents * cap_ratio) where id = j.id;
  end if;
  update public.lead_engine_jobs set status = j.resume_from, resume_from = null, attention_reason = null where id = j.id returning * into j;
  return to_jsonb(j);
end; $$;

-- Progress counters from the runner (scraped / verified / delivered), merged not replaced.
create or replace function public.lead_engine_job_progress(p_operator uuid, p_job uuid, p_progress jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs;
begin
  update public.lead_engine_jobs set progress = progress || coalesce(p_progress, '{}') where id = p_job and operator_id = p_operator returning * into j;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  return to_jsonb(j);
end; $$;

-- Close the job's batch with the real spend. Deliveries decide completed vs partial vs failed.
create or replace function public.lead_engine_close_batch(p_batch uuid, p_consumed integer, p_evidence text)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare b public.lead_engine_batches; delivered integer; outcome text;
begin
  select * into b from public.lead_engine_batches where id = p_batch for update;
  if not found or b.status <> 'reserved' then return; end if;
  select count(*) into delivered from public.lead_engine_deliveries where batch_id = b.id;
  outcome := case when delivered = 0 then 'failed' when delivered >= b.businesses then 'completed' else 'partial' end;
  insert into public.lead_engine_costs(batch_id, consumed_cents, released_cents, outcome, evidence_ref)
    values (b.id, least(p_consumed, b.reserved_cents), b.reserved_cents - least(p_consumed, b.reserved_cents), outcome, left(p_evidence, 300));
  update public.lead_engine_batches set status = outcome, reserved_cents = 0, consumed_cents = least(p_consumed, b.reserved_cents),
    delivered_count = delivered, settled_at = now(), evidence_ref = left(p_evidence, 300) where id = b.id;
end; $$;

-- Deliver: settle credits on delivered clean cells only (flag-mode DNC rows at half rate), release the rest.
create or replace function public.lead_engine_deliver_job(p_operator uuid, p_job uuid, p_delivered integer, p_flagged integer)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_jobs; due integer; flagged integer := coalesce(p_flagged, 0);
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_jobs where id = p_job and operator_id = p_operator for update;
  if not found then raise exception using errcode = 'P0001', message = 'job_not_found'; end if;
  if j.status = 'delivered' then return to_jsonb(j); end if;
  if j.status not in ('running','needs_attention') or j.credits_held = 0 then raise exception using errcode = 'P0001', message = 'invalid_job_transition'; end if;
  if p_delivered is null or p_delivered < 0 or flagged < 0 then raise exception using errcode = 'P0001', message = 'invalid_input'; end if;
  due := least(j.credits_held, p_delivered * j.credits_per_cell + ceil(flagged * j.credits_per_cell / 2.0)::integer);
  if due > 0 then perform public.lead_engine_credit_move(p_operator, j.id, 'settle', due, format('%s clean cells, %s flagged', p_delivered, flagged)); end if;
  if j.credits_held - due > 0 then perform public.lead_engine_credit_move(p_operator, j.id, 'release', j.credits_held - due, 'unused hold released'); end if;
  perform public.lead_engine_close_batch(j.batch_id, j.spent_cents, format('job %s delivered %s', j.id, p_delivered));
  update public.lead_engine_jobs set status = 'delivered', credits_settled = due, credits_held = 0, delivered_count = p_delivered,
    delivered_at = now(), resume_from = null, attention_reason = null where id = j.id returning * into j;
  return to_jsonb(j);
end; $$;

-- 5. The job's working rows: everything scraped or ingested, with the stage each row reached.
create table if not exists public.lead_engine_job_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.lead_engine_jobs(id),
  operator_id uuid not null references auth.users(id),
  phone10 text check (phone10 is null or phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  name text not null check (length(name) between 1 and 200),
  city text check (city is null or length(city) <= 150),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  zip text check (zip is null or zip ~ '^[0-9]{5}$'),
  place_id text check (place_id is null or length(place_id) <= 200),
  source_url text check (source_url is null or length(source_url) <= 2000),
  website text check (website is null or length(website) <= 2000),
  rating numeric(3,2), reviews integer,
  owner_name text check (owner_name is null or length(owner_name) <= 200),
  email text check (email is null or length(email) <= 320),
  source_register text check (source_register is null or length(source_register) <= 120),
  source_row_id text check (source_row_id is null or length(source_row_id) <= 200),
  bucket smallint check (bucket is null or bucket between 1 and 4),
  maps_phone text check (maps_phone is null or maps_phone ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  stage text not null default 'scraped' check (stage in ('scraped','filtered','verified','dropped','held','delivered')),
  drop_reason text check (drop_reason is null or length(drop_reason) <= 120),
  verification jsonb not null default '{}' check (jsonb_typeof(verification) = 'object'),
  time_zone text,
  ledger_id uuid references public.lead_engine_row_ledger(id),
  sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lead_engine_job_rows_phone_idx on public.lead_engine_job_rows(job_id, phone10) where phone10 is not null;
create index if not exists lead_engine_job_rows_stage_idx on public.lead_engine_job_rows(job_id, stage);

-- 6. Access: RLS on, default deny, service_role only. Append-only tables get the immutable trigger.
do $$ declare t text; begin
  foreach t in array array['lead_engine_jobs','lead_engine_job_transitions','lead_engine_credits_ledger','lead_engine_job_spend','lead_engine_daily_ceilings','lead_engine_job_rows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert on public.%I to service_role', t);
  end loop;
  foreach t in array array['lead_engine_jobs','lead_engine_daily_ceilings','lead_engine_job_rows'] loop
    execute format('grant update on public.%I to service_role', t);
  end loop;
  foreach t in array array['lead_engine_job_transitions','lead_engine_credits_ledger','lead_engine_job_spend'] loop
    execute format('drop trigger if exists lead_engine_immutable on public.%I', t);
    execute format('create trigger lead_engine_immutable before update or delete on public.%I for each row execute function public.lead_engine_immutable()', t);
  end loop;
end $$;
grant usage, select on sequence public.lead_engine_job_transitions_id_seq, public.lead_engine_credits_ledger_seq_seq to service_role;
revoke all on function public.lead_engine_credit_balance(uuid), public.lead_engine_credit_move(uuid,uuid,text,integer,text),
  public.lead_engine_grant_credits(uuid,integer,text), public.lead_engine_meter(uuid,uuid,text,text,integer,integer),
  public.lead_engine_create_job(uuid,uuid,jsonb), public.lead_engine_hold_job(uuid,uuid), public.lead_engine_sample_result(uuid,uuid,jsonb,boolean,text),
  public.lead_engine_freeze_job(uuid,uuid,text), public.lead_engine_resume_job(uuid,uuid,integer), public.lead_engine_job_progress(uuid,uuid,jsonb),
  public.lead_engine_close_batch(uuid,integer,text), public.lead_engine_deliver_job(uuid,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.lead_engine_credit_balance(uuid), public.lead_engine_credit_move(uuid,uuid,text,integer,text), public.lead_engine_close_batch(uuid,integer,text),
  public.lead_engine_grant_credits(uuid,integer,text),
  public.lead_engine_meter(uuid,uuid,text,text,integer,integer), public.lead_engine_create_job(uuid,uuid,jsonb), public.lead_engine_hold_job(uuid,uuid),
  public.lead_engine_sample_result(uuid,uuid,jsonb,boolean,text), public.lead_engine_freeze_job(uuid,uuid,text), public.lead_engine_resume_job(uuid,uuid,integer),
  public.lead_engine_job_progress(uuid,uuid,jsonb), public.lead_engine_deliver_job(uuid,uuid,integer,integer) to service_role;

commit;
