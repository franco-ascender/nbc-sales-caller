-- L01 / NBC internal. R9: integration authorized by Franco on 2026-09-15.
-- Apply once after isolated PostgreSQL checks; preserve this file after integration.
-- No SECURITY DEFINER, provider access, balance seed or execution approval.
begin;

create table if not exists public.lead_engine_control (
  scope text primary key default 'nbc-internal' check (scope = 'nbc-internal'),
  execution_enabled boolean not null default false
);
insert into public.lead_engine_control(scope) values ('nbc-internal') on conflict do nothing;

create table if not exists public.lead_engine_plans (
  id uuid primary key,
  operator_id uuid not null references auth.users(id),
  scope text not null default 'nbc-internal' references public.lead_engine_control(scope),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  lane text not null check (lane in ('A','B','C')),
  benchmark_version text not null,
  forecast_cents integer not null check (forecast_cents > 0),
  hard_budget_cents integer not null check (hard_budget_cents between 1 and 999999999),
  status text not null default 'draft' check (status in ('draft','paused','archived')),
  created_at timestamptz not null default now(),
  unique (id, operator_id)
);
create index if not exists lead_engine_plans_owner_idx on public.lead_engine_plans(operator_id, created_at desc, id);

create table if not exists public.lead_engine_provider_accounts (
  provider text primary key check (provider ~ '^[a-z0-9_-]{1,60}$'),
  balance_cents integer not null check (balance_cents >= 0),
  reserved_cents integer not null default 0 check (reserved_cents >= 0),
  consumed_cents integer not null default 0 check (consumed_cents >= 0),
  verified_at timestamptz not null,
  valid_until timestamptz not null check (valid_until > verified_at),
  evidence_ref text not null check (length(evidence_ref) between 1 and 300),
  check (reserved_cents::bigint + consumed_cents <= balance_cents)
);
-- Consumed means since the balance snapshot, not lifetime. Refresh/reconciliation is future work.
create table if not exists public.lead_engine_plan_approvals (
  plan_id uuid primary key references public.lead_engine_plans(id),
  pilot_measured_at timestamptz not null,
  pilot_approved_at timestamptz not null,
  approved_by uuid not null references auth.users(id),
  measured_forecast_cents integer not null check (measured_forecast_cents > 0),
  evidence_ref text not null check (length(evidence_ref) between 1 and 300)
);

create table if not exists public.lead_engine_batches (
  id uuid primary key,
  plan_id uuid not null,
  operator_id uuid not null,
  foreign key (plan_id, operator_id) references public.lead_engine_plans(id, operator_id),
  stage text not null check (stage in ('pilot','scale')),
  status text not null check (status in ('dry_run','prepared','reserved','uncertain','completed','partial','failed')),
  businesses integer not null check (businesses between 1 and 100000),
  estimate_cents integer not null check (estimate_cents between 1 and 999999999),
  reserved_cents integer not null default 0 check (reserved_cents >= 0),
  consumed_cents integer not null default 0 check (consumed_cents >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  provider text references public.lead_engine_provider_accounts(provider),
  -- Canonical claims are set only by a future trusted source/quote adapter, never HTTP input.
  search_claims jsonb not null default '[]' check (jsonb_typeof(search_claims) = 'array' and jsonb_array_length(search_claims) <= 300),
  business_claims jsonb not null default '[]' check (jsonb_typeof(business_claims) = 'array' and jsonb_array_length(business_claims) <= 300),
  large_approved_at timestamptz,
  large_approved_by uuid references auth.users(id),
  evidence_ref text,
  dry_run jsonb check (dry_run is null or jsonb_typeof(dry_run) = 'object'),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (id, plan_id, operator_id),
  check (reserved_cents + consumed_cents <= estimate_cents),
  check (delivered_count <= businesses),
  check ((large_approved_at is null) = (large_approved_by is null)),
  check (status not in ('dry_run','prepared') or (reserved_cents = 0 and consumed_cents = 0)),
  check (status not in ('reserved','uncertain') or (reserved_cents = estimate_cents and consumed_cents = 0)),
  check (status not in ('completed','partial','failed') or (reserved_cents = 0 and settled_at is not null))
);
create index if not exists lead_engine_batches_plan_idx on public.lead_engine_batches(plan_id, created_at desc);

create table if not exists public.lead_engine_costs (
  batch_id uuid primary key references public.lead_engine_batches(id),
  consumed_cents integer not null check (consumed_cents >= 0),
  released_cents integer not null check (released_cents >= 0),
  outcome text not null check (outcome in ('completed','partial','failed')),
  evidence_ref text not null check (length(evidence_ref) between 1 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.lead_engine_searches (
  source text not null check (source ~ '^[a-z0-9_-]{1,60}$'),
  query text not null check (query ~ '^[a-z0-9]+( [a-z0-9]+)*$' and length(query) <= 150),
  metro text not null check (metro ~ '^[a-z0-9]+( [a-z0-9]+)*$' and length(metro) <= 150),
  batch_id uuid not null references public.lead_engine_batches(id),
  claimed_at timestamptz not null default now(),
  primary key (source, query, metro)
);
create table if not exists public.lead_engine_businesses (
  id uuid primary key default gen_random_uuid(),
  phone10 text unique check (phone10 is null or phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  disposition text not null default 'claimed' check (disposition in ('claimed','filtered')),
  drop_reason text,
  check ((disposition = 'claimed' and phone10 is not null and drop_reason is null)
    or (disposition = 'filtered' and drop_reason is not null and length(drop_reason) between 1 and 300)),
  name_city text not null unique check (name_city ~ '^[a-z0-9]+( [a-z0-9]+)*$' and length(name_city) <= 300),
  place_id text unique check (place_id is null or length(place_id) between 1 and 200),
  source_url text not null check (source_url ~ '^https://' and length(source_url) <= 2000),
  batch_id uuid not null references public.lead_engine_batches(id),
  claimed_at timestamptz not null default now()
);
create table if not exists public.lead_engine_suppressions (
  phone10 text primary key check (phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  reason text not null check (reason in ('opt_out','complaint','wrong_number','bad_fit')),
  evidence_ref text not null check (length(evidence_ref) between 1 and 300),
  added_at timestamptz not null default now()
);
create table if not exists public.lead_engine_deliveries (
  phone10 text primary key references public.lead_engine_businesses(phone10),
  batch_id uuid not null,
  plan_id uuid not null,
  operator_id uuid not null,
  foreign key (batch_id, plan_id, operator_id) references public.lead_engine_batches(id, plan_id, operator_id),
  line_type text not null check (line_type = 'Mobile'),
  dnc boolean not null check (dnc = false),
  tcpa boolean not null check (tcpa = false),
  reachable boolean not null check (reachable = true),
  verified_at timestamptz not null,
  time_zone text not null,
  evidence_ref text not null check (length(evidence_ref) between 1 and 300),
  delivered_at timestamptz not null default now()
);

-- Invariant triggers protect immutable snapshots and append-only evidence.
create or replace function public.lead_engine_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  raise exception using errcode = 'P0001', message = 'immutable_record';
end; $$;
create or replace function public.lead_engine_plan_transition() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
    or (new.status <> old.status and not (old.status = 'draft' and new.status in ('paused','archived') or old.status = 'paused' and new.status = 'archived')) then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  return new;
end; $$;
drop trigger if exists lead_engine_plan_transition on public.lead_engine_plans;
create trigger lead_engine_plan_transition before update on public.lead_engine_plans for each row execute function public.lead_engine_plan_transition();

create or replace function public.lead_engine_batch_transition() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if (to_jsonb(new) - array['status','reserved_cents','consumed_cents','delivered_count','evidence_ref','settled_at'])
    is distinct from (to_jsonb(old) - array['status','reserved_cents','consumed_cents','delivered_count','evidence_ref','settled_at'])
    or not (old.status = 'prepared' and new.status = 'reserved'
      or old.status = 'reserved' and new.status in ('uncertain','completed','partial','failed')
      or old.status = 'uncertain' and new.status in ('completed','partial','failed')) then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  return new;
end; $$;
drop trigger if exists lead_engine_batch_transition on public.lead_engine_batches;
create trigger lead_engine_batch_transition before update on public.lead_engine_batches for each row execute function public.lead_engine_batch_transition();

-- Serialize suppression and delivery, including direct trusted-server inserts.
create or replace function public.lead_engine_contact_gate() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  if TG_TABLE_NAME = 'lead_engine_deliveries' then
    if exists(select 1 from public.lead_engine_suppressions where phone10 = new.phone10) then
      raise exception using errcode = 'P0001', message = 'contact_suppressed';
    end if;
    if new.verified_at > now() or new.verified_at <= now() - interval '31 days'
      or not exists(select 1 from pg_timezone_names where name = new.time_zone)
      or not exists(select 1 from public.lead_engine_businesses where phone10 = new.phone10 and batch_id = new.batch_id)
      or not exists(select 1 from public.lead_engine_batches where id = new.batch_id and status = 'reserved') then
      raise exception using errcode = 'P0001', message = 'invalid_delivery_evidence';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists lead_engine_delivery_gate on public.lead_engine_deliveries;
create trigger lead_engine_delivery_gate before insert on public.lead_engine_deliveries for each row execute function public.lead_engine_contact_gate();
drop trigger if exists lead_engine_suppression_gate on public.lead_engine_suppressions;
create trigger lead_engine_suppression_gate before insert on public.lead_engine_suppressions for each row execute function public.lead_engine_contact_gate();

-- Atomic create-or-replay; conflicting payload never overwrites a plan.
create or replace function public.lead_engine_save_plan(p_operator uuid, p_id uuid, p_input jsonb, p_lane text, p_benchmark text, p_forecast integer, p_budget integer)
returns public.lead_engine_plans language plpgsql security invoker set search_path = pg_catalog, public as $$
declare result public.lead_engine_plans;
begin
  insert into public.lead_engine_plans(id, operator_id, input, lane, benchmark_version, forecast_cents, hard_budget_cents)
  values (p_id, p_operator, p_input, p_lane, p_benchmark, p_forecast, p_budget) on conflict (id) do nothing;
  select * into result from public.lead_engine_plans where id = p_id and operator_id = p_operator;
  if not found then raise exception using errcode = 'P0001', message = 'plan_not_found'; end if;
  if result.input <> p_input or result.lane <> p_lane or result.benchmark_version <> p_benchmark or result.forecast_cents <> p_forecast or result.hard_budget_cents <> p_budget then
    raise exception using errcode = 'P0001', message = 'idempotency_conflict';
  end if;
  return result;
end; $$;

-- Internal assessment shared by dry-run and reservation. Caller must hold control mutex.
create or replace function public.lead_engine_blockers(p_plan uuid, p_stage text, p_businesses integer, p_estimate integer, p_provider text, p_large boolean)
returns text[] language plpgsql security invoker set search_path = pg_catalog, public as $$
declare p public.lead_engine_plans; a public.lead_engine_provider_accounts; approved public.lead_engine_plan_approvals;
  reasons text[] := '{}'; used bigint; pilot_cost bigint; pilot_businesses bigint;
begin
  select * into p from public.lead_engine_plans where id = p_plan;
  if not found then return array['plan_not_found']; end if;
  if p.status <> 'draft' then reasons := array_append(reasons, 'plan_paused'); end if;
  if not (select execution_enabled from public.lead_engine_control where scope = 'nbc-internal') then reasons := array_append(reasons, 'execution_not_connected'); end if;
  if p.lane <> 'A' then reasons := array_append(reasons, 'lane_paused'); end if;
  select * into approved from public.lead_engine_plan_approvals where plan_id = p.id;
  if coalesce(approved.measured_forecast_cents, p.forecast_cents) > p.hard_budget_cents then reasons := array_append(reasons, 'forecast_over_budget'); end if;
  if p_stage = 'scale' and (approved.plan_id is null or approved.pilot_measured_at > now() or approved.pilot_approved_at > now()
    or not exists(select 1 from public.lead_engine_batches where plan_id = p.id and stage = 'pilot' and status = 'completed' and delivered_count > 0)) then
    reasons := array_append(reasons, 'approved_measured_pilot_required');
  end if;
  select coalesce(sum(reserved_cents::bigint + consumed_cents),0),
    coalesce(sum(estimate_cents) filter (where stage = 'pilot' and status not in ('dry_run','prepared')),0),
    coalesce(sum(businesses) filter (where stage = 'pilot' and status not in ('dry_run','prepared')),0)
    into used, pilot_cost, pilot_businesses from public.lead_engine_batches where plan_id = p.id;
  if p_estimate > p.hard_budget_cents - used then reasons := array_append(reasons, 'hard_budget_exceeded'); end if;
  if p_stage = 'pilot' and (pilot_cost + p_estimate > 1000 or pilot_businesses + p_businesses > 300) then reasons := array_append(reasons, 'pilot_cap_exceeded'); end if;
  if p_estimate > 15000 and p_large is not true then reasons := array_append(reasons, 'large_batch_confirmation_required'); end if;
  if exists(select 1 from public.lead_engine_batches where plan_id = p.id and (status = 'uncertain' or consumed_cents > delivered_count::bigint * 15)) then
    reasons := array_append(reasons, 'stop_loss_triggered');
  end if;
  select * into a from public.lead_engine_provider_accounts where provider = p_provider;
  if not found or a.verified_at > now() or a.valid_until <= now() then reasons := array_append(reasons, 'balance_check_required');
  elsif p_estimate > a.balance_cents::bigint - a.reserved_cents - a.consumed_cents then reasons := array_append(reasons, 'provider_balance_exceeded'); end if;
  return reasons;
end; $$;

create or replace function public.lead_engine_dry_run(p_operator uuid, p_plan uuid, p_batch uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare p public.lead_engine_plans; b public.lead_engine_batches; reasons text[]; report jsonb;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into p from public.lead_engine_plans where id = p_plan and operator_id = p_operator;
  if not found then raise exception using errcode = 'P0001', message = 'plan_not_found'; end if;
  select * into b from public.lead_engine_batches where id = p_batch;
  if found then
    if b.plan_id <> p_plan or b.operator_id <> p_operator or b.status <> 'dry_run' then raise exception using errcode = 'P0001', message = 'idempotency_conflict'; end if;
    return b.dry_run;
  end if;
  if p.status <> 'draft' then raise exception using errcode = 'P0001', message = 'invalid_state'; end if;
  reasons := public.lead_engine_blockers(p_plan, 'pilot', 300, 1000, null, false);
  -- No quote/source adapter exists in L01, even if a trusted admin changes control.
  reasons := array_append(reasons, 'verified_source_and_quote_required');
  report := jsonb_build_object('version',1,'batchId',p_batch,'planId',p_plan,'status','dry_run','executionEnabled',false,
    'maxBusinesses',300,'maxCostCents',1000,'reservedCents',0,'consumedCents',0,'claimsCreated',0,'blockers',reasons,'checkedAt',now());
  insert into public.lead_engine_batches(id, plan_id, operator_id, stage, status, businesses, estimate_cents, dry_run)
  values (p_batch,p_plan,p_operator,'pilot','dry_run',300,1000,report);
  return report;
end; $$;

-- Future trusted adapter creates a prepared batch from verified quote and canonical inputs.
-- Never invoke this from browser/API L01. Reservation and every claim commit or rollback together.
create or replace function public.lead_engine_reserve_batch(p_operator uuid, p_batch uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare b public.lead_engine_batches; reasons text[]; item jsonb;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into b from public.lead_engine_batches where id = p_batch and operator_id = p_operator;
  if not found then raise exception using errcode = 'P0001', message = 'batch_not_found'; end if;
  if b.status in ('reserved','uncertain','completed','partial','failed') then return jsonb_build_object('batch',to_jsonb(b),'acquired',false); end if;
  if b.status <> 'prepared' then raise exception using errcode = 'P0001', message = 'invalid_state'; end if;
  reasons := public.lead_engine_blockers(b.plan_id,b.stage,b.businesses,b.estimate_cents,b.provider,
    b.large_approved_at is not null and b.large_approved_at <= now() and b.large_approved_by is not null);
  if cardinality(reasons) > 0 then raise exception using errcode = 'P0001', message = reasons[1]; end if;
  if b.evidence_ref is null or length(b.evidence_ref) not between 1 and 300
    or jsonb_array_length(b.search_claims) + jsonb_array_length(b.business_claims) = 0
    or jsonb_array_length(b.business_claims) > b.businesses then
    raise exception using errcode = 'P0001', message = 'verified_source_and_quote_required';
  end if;
  for item in select value from jsonb_array_elements(b.search_claims) loop
    insert into public.lead_engine_searches(source,query,metro,batch_id) values(item->>'source',item->>'query',item->>'metro',b.id);
  end loop;
  for item in select value from jsonb_array_elements(b.business_claims) loop
    if exists(select 1 from public.lead_engine_suppressions where phone10 = item->>'phone10')
      or exists(select 1 from public.lead_engine_deliveries where phone10 = item->>'phone10') then
      raise exception using errcode = 'P0001', message = 'contact_unavailable';
    end if;
    insert into public.lead_engine_businesses(phone10,name_city,place_id,source_url,batch_id)
    values(item->>'phone10',item->>'nameCity',nullif(item->>'placeId',''),item->>'sourceUrl',b.id);
  end loop;
  update public.lead_engine_provider_accounts set reserved_cents = reserved_cents + b.estimate_cents where provider = b.provider;
  update public.lead_engine_batches set status = 'reserved', reserved_cents = estimate_cents where id = b.id returning * into b;
  return jsonb_build_object('batch',to_jsonb(b),'acquired',true);
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'claim_unavailable';
end; $$;

create or replace function public.lead_engine_settle_batch(p_operator uuid, p_batch uuid, p_outcome text, p_consumed integer, p_evidence text)
returns public.lead_engine_batches language plpgsql security invoker set search_path = pg_catalog, public as $$
declare b public.lead_engine_batches; delivered integer;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into b from public.lead_engine_batches where id = p_batch and operator_id = p_operator;
  if not found then raise exception using errcode = 'P0001', message = 'batch_not_found'; end if;
  if p_outcome is null or p_outcome not in ('uncertain','completed','partial','failed') or p_evidence is null or length(p_evidence) not between 1 and 300
    or p_consumed is null or p_consumed < 0 or p_consumed > b.estimate_cents or (p_outcome = 'uncertain' and p_consumed <> 0) then
    raise exception using errcode = 'P0001', message = 'invalid_settlement';
  end if;
  if b.status = p_outcome and b.consumed_cents = p_consumed and b.evidence_ref = p_evidence then return b; end if;
  if b.status not in ('reserved','uncertain') or (b.status = 'uncertain' and p_outcome = 'uncertain') then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  if p_outcome = 'uncertain' then
    update public.lead_engine_batches set status = 'uncertain', evidence_ref = p_evidence where id = b.id returning * into b;
    update public.lead_engine_plans set status = 'paused' where id = b.plan_id and status = 'draft';
    return b;
  end if;
  select count(*) into delivered from public.lead_engine_deliveries where batch_id = b.id;
  if p_outcome = 'failed' and delivered > 0 then raise exception using errcode = 'P0001', message = 'invalid_settlement'; end if;
  insert into public.lead_engine_costs(batch_id,consumed_cents,released_cents,outcome,evidence_ref)
    values(b.id,p_consumed,b.reserved_cents-p_consumed,p_outcome,p_evidence);
  update public.lead_engine_provider_accounts set reserved_cents = reserved_cents - b.reserved_cents, consumed_cents = consumed_cents + p_consumed where provider = b.provider;
  update public.lead_engine_batches set status = p_outcome, reserved_cents = 0, consumed_cents = p_consumed,
    delivered_count = delivered, settled_at = now(), evidence_ref = p_evidence where id = b.id returning * into b;
  if p_outcome in ('partial','failed') or p_consumed > delivered::bigint * 15 then
    update public.lead_engine_plans set status = 'paused' where id = b.plan_id and status = 'draft';
  end if;
  return b;
end; $$;


-- R3: proposed durable discovery dispatch. No seeds, execution routes or scheduler.
create table if not exists public.lead_engine_discovery_jobs (
  batch_id uuid primary key,
  plan_id uuid not null,
  operator_id uuid not null,
  foreign key (batch_id,plan_id,operator_id) references public.lead_engine_batches(id,plan_id,operator_id),
  actor_id text not null check (actor_id ~ '^[a-zA-Z0-9]{15,30}$'),
  build_tag text not null check (build_tag ~ '^[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}$'),
  search_term text not null check (length(btrim(search_term)) between 1 and 150 and search_term !~ '[[:cntrl:]]'),
  location text not null check (length(btrim(location)) between 1 and 150 and location !~ '[[:cntrl:]]'),
  max_results integer not null check (max_results between 1 and 300),
  max_cost_cents integer not null check (max_cost_cents between 1 and 1000),
  contract_evidence_ref text not null check (length(contract_evidence_ref) between 1 and 300),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  valid_until timestamptz not null check (valid_until > approved_at),
  status text not null default 'prepared' check (status in ('prepared','dispatching','running','succeeded','failed','uncertain')),
  run_id text unique check (run_id is null or run_id ~ '^[a-zA-Z0-9]{15,30}$'),
  dataset_id text unique check (dataset_id is null or dataset_id ~ '^[a-zA-Z0-9]{15,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((run_id is null) = (dataset_id is null)),
  check (status not in ('prepared','dispatching') or run_id is null),
  check (status not in ('running','succeeded','failed') or run_id is not null)
);
create index if not exists lead_engine_discovery_owner_idx on public.lead_engine_discovery_jobs(operator_id,created_at desc);
create or replace function public.lead_engine_discovery_transition() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if (to_jsonb(new) - array['status','run_id','dataset_id','updated_at']) is distinct from
     (to_jsonb(old) - array['status','run_id','dataset_id','updated_at'])
    or (old.run_id is not null and (new.run_id is distinct from old.run_id or new.dataset_id is distinct from old.dataset_id))
    or not (old.status = 'prepared' and new.status = 'dispatching'
      or old.status = 'dispatching' and new.status in ('running','succeeded','failed','uncertain')
      or old.status = 'running' and new.status in ('running','succeeded','failed','uncertain')) then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  return new;
end; $$;
create trigger lead_engine_discovery_transition before update on public.lead_engine_discovery_jobs
  for each row execute function public.lead_engine_discovery_transition();
create trigger lead_engine_discovery_no_delete before delete on public.lead_engine_discovery_jobs
  for each row execute function public.lead_engine_immutable();

create or replace function public.lead_engine_claim_discovery(p_operator uuid, p_batch uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_discovery_jobs; b public.lead_engine_batches; p public.lead_engine_plans; reservation jsonb;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into j from public.lead_engine_discovery_jobs where batch_id=p_batch and operator_id=p_operator;
  if not found then raise exception using errcode='P0001', message='batch_not_found'; end if;
  if j.status <> 'prepared' then return jsonb_build_object('job',to_jsonb(j),'acquired',false); end if;
  select * into b from public.lead_engine_batches where id=j.batch_id and operator_id=p_operator;
  select * into p from public.lead_engine_plans where id=j.plan_id and operator_id=p_operator;
  if j.approved_by <> p_operator or j.approved_at > now() or j.valid_until <= now()
    or b.provider is distinct from 'apify' or b.stage <> 'pilot' or b.status <> 'prepared'
    or j.max_results <> b.businesses or j.max_cost_cents <> b.estimate_cents
    or j.search_term is distinct from p.input->>'industry' or j.location is distinct from p.input->>'metro'
    or b.business_claims <> '[]'::jsonb
    or b.search_claims <> jsonb_build_array(jsonb_build_object('source','apify',
      'query', btrim(regexp_replace(lower(j.search_term),'[^a-z0-9]+',' ','g')),
      'metro', btrim(regexp_replace(lower(j.location),'[^a-z0-9]+',' ','g')))) then
    raise exception using errcode='P0001', message='verified_discovery_contract_required';
  end if;
  reservation := public.lead_engine_reserve_batch(p_operator,p_batch);
  if (reservation->>'acquired')::boolean is not true then raise exception using errcode='P0001', message='invalid_state'; end if;
  update public.lead_engine_discovery_jobs set status='dispatching', updated_at=now() where batch_id=p_batch returning * into j;
  return jsonb_build_object('job',to_jsonb(j),'acquired',true);
end; $$;

create or replace function public.lead_engine_observe_discovery(p_operator uuid, p_batch uuid, p_run text, p_dataset text, p_actor text, p_build text, p_status text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_discovery_jobs;
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into j from public.lead_engine_discovery_jobs where batch_id=p_batch and operator_id=p_operator;
  if not found then raise exception using errcode='P0001', message='batch_not_found'; end if;
  if p_actor is distinct from j.actor_id or p_build is distinct from j.build_tag
    or p_run is null or p_run !~ '^[a-zA-Z0-9]{15,30}$' or p_dataset is null or p_dataset !~ '^[a-zA-Z0-9]{15,30}$'
    or p_status is null or p_status not in ('running','succeeded','failed')
    or (j.run_id is not null and (j.run_id <> p_run or j.dataset_id <> p_dataset)) then
    raise exception using errcode='P0001', message='discovery_identity_mismatch';
  end if;
  -- Late GET results must not regress a terminal outcome or attach identity after an uncertain dispatch.
  if j.status in ('succeeded','failed','uncertain') then return to_jsonb(j); end if;
  if j.status not in ('dispatching','running') then raise exception using errcode='P0001', message='invalid_state'; end if;
  if not exists(select 1 from public.lead_engine_batches where id=p_batch and status='reserved') then
    raise exception using errcode='P0001', message='invalid_state';
  end if;
  update public.lead_engine_discovery_jobs set status=p_status,run_id=p_run,dataset_id=p_dataset,updated_at=now()
    where batch_id=p_batch returning * into j;
  if p_status='failed' then
    perform public.lead_engine_settle_batch(p_operator,p_batch,'uncertain',0,'discovery:provider_failed');
  end if;
  return to_jsonb(j);
end; $$;

create or replace function public.lead_engine_uncertain_discovery(p_operator uuid, p_batch uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.lead_engine_discovery_jobs;
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into j from public.lead_engine_discovery_jobs where batch_id=p_batch and operator_id=p_operator;
  if not found then raise exception using errcode='P0001', message='batch_not_found'; end if;
  if j.status in ('succeeded','failed','uncertain') then return to_jsonb(j); end if;
  if j.status not in ('dispatching','running') then raise exception using errcode='P0001', message='invalid_state'; end if;
  update public.lead_engine_discovery_jobs set status='uncertain',updated_at=now() where batch_id=p_batch returning * into j;
  perform public.lead_engine_settle_batch(p_operator,p_batch,'uncertain',0,'discovery:dispatch_uncertain');
  return to_jsonb(j);
end; $$;


-- R4 private folders, immutable commercial quotes and resumable result ingestion.
create table if not exists public.lead_engine_pricing (
  id uuid primary key, actor_id text not null check(actor_id ~ '^[a-zA-Z0-9]{15,30}$'),
  build_tag text not null check(build_tag ~ '^[0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}$'),
  base_min_cents integer not null check(base_min_cents>=0), base_max_cents integer not null check(base_max_cents>=base_min_cents and base_max_cents<=1000),
  unit_min_millicents integer not null check(unit_min_millicents>=0),
  unit_max_millicents integer not null check(unit_max_millicents>=unit_min_millicents and unit_max_millicents<=1000000),
  verified_at timestamptz not null, valid_until timestamptz not null check(valid_until>verified_at),
  evidence_ref text not null check(length(evidence_ref) between 1 and 300)
);
create table if not exists public.lead_engine_folders (
  id uuid primary key, operator_id uuid not null references auth.users(id),
  name text not null check(length(btrim(name)) between 1 and 80 and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(), unique(id,operator_id)
);
create unique index if not exists lead_engine_folder_name on public.lead_engine_folders(operator_id,lower(btrim(name)));
create table if not exists public.lead_engine_quotes (
  id uuid primary key, operator_id uuid not null, plan_id uuid not null, folder_id uuid,
  foreign key(plan_id,operator_id) references public.lead_engine_plans(id,operator_id),
  foreign key(folder_id,operator_id) references public.lead_engine_folders(id,operator_id),
  name text not null check(length(btrim(name)) between 1 and 80 and name !~ '[[:cntrl:]]'),
  max_results integer not null check(max_results between 1 and 300), rate_id uuid not null references public.lead_engine_pricing(id),
  min_cost_cents integer not null check(min_cost_cents>=0), max_cost_cents integer not null check(max_cost_cents>=min_cost_cents and max_cost_cents between 1 and 1000),
  expires_at timestamptz not null, approved_at timestamptz, created_at timestamptz not null default now(), unique(id,operator_id)
);
create table if not exists public.lead_engine_lists (
  id uuid primary key, operator_id uuid not null, plan_id uuid not null, folder_id uuid,
  foreign key(id,operator_id) references public.lead_engine_quotes(id,operator_id),
  foreign key(id,plan_id,operator_id) references public.lead_engine_batches(id,plan_id,operator_id),
  foreign key(folder_id,operator_id) references public.lead_engine_folders(id,operator_id),
  name text not null, cursor integer not null default 0 check(cursor between 0 and 300),
  dataset_total integer check(dataset_total is null or dataset_total between 0 and 300),
  import_status text not null default 'waiting' check(import_status in ('waiting','importing','complete')),
  created_at timestamptz not null default now(), unique(id,operator_id)
);
create index if not exists lead_engine_lists_owner_idx on public.lead_engine_lists(operator_id,created_at desc,id);
create table if not exists public.lead_engine_candidates (
  list_id uuid not null references public.lead_engine_lists(id), position integer not null check(position between 0 and 299),
  name text not null check(length(name)<=200), city text not null check(length(city)<=150), state text not null check(length(state)<=100),
  website text check(website is null or (length(website)<=2000 and website ~ '^https?://')),
  source_url text check(source_url is null or (length(source_url)<=2000 and source_url ~ '^https://')),
  phone10 text check(phone10 is null or phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  place_id text check(place_id is null or length(place_id) between 1 and 200),
  business_key text not null check(length(business_key)<=600), rejection text check(rejection is null or length(rejection) between 1 and 100),
  created_at timestamptz not null default now(), primary key(list_id,position)
);
create unique index if not exists lead_engine_candidate_phone on public.lead_engine_candidates(phone10) where rejection is null;
create unique index if not exists lead_engine_candidate_place on public.lead_engine_candidates(place_id) where rejection is null;
create unique index if not exists lead_engine_candidate_business on public.lead_engine_candidates(business_key) where rejection is null;

create or replace function public.lead_engine_quote_transition() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$ begin
  if (to_jsonb(new)-'approved_at') is distinct from (to_jsonb(old)-'approved_at') or old.approved_at is not null or new.approved_at is null then
    raise exception using errcode='P0001',message='invalid_state'; end if; return new;
end; $$;
create trigger lead_engine_quote_transition before update on public.lead_engine_quotes for each row execute function public.lead_engine_quote_transition();
create or replace function public.lead_engine_list_transition() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$ begin
  if (to_jsonb(new)-array['folder_id','cursor','import_status','dataset_total']) is distinct from (to_jsonb(old)-array['folder_id','cursor','import_status','dataset_total'])
    or (old.dataset_total is not null and new.dataset_total is distinct from old.dataset_total)
    or new.cursor<old.cursor or (old.import_status='complete' and new.import_status<>'complete') then
    raise exception using errcode='P0001',message='invalid_state'; end if; return new;
end; $$;
create trigger lead_engine_list_transition before update on public.lead_engine_lists for each row execute function public.lead_engine_list_transition();

create or replace function public.lead_engine_save_folder(p_operator uuid,p_id uuid,p_name text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare f public.lead_engine_folders;
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into f from public.lead_engine_folders where id=p_id;
  if found then
    if f.operator_id<>p_operator or f.name<>p_name then raise exception using errcode='P0001',message='idempotency_conflict'; end if;
    return to_jsonb(f);
  end if;
  if (select count(*) from public.lead_engine_folders where operator_id=p_operator)>=200 then raise exception using errcode='P0001',message='folder_limit'; end if;
  insert into public.lead_engine_folders(id,operator_id,name) values(p_id,p_operator,p_name) returning * into f;
  return to_jsonb(f);
exception when unique_violation then raise exception using errcode='P0001',message='folder_name_conflict';
end; $$;

create or replace function public.lead_engine_quote(p_operator uuid,p_id uuid,p_plan uuid,p_folder uuid,p_name text,p_count integer)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare q public.lead_engine_quotes; r public.lead_engine_pricing; p public.lead_engine_plans; hi integer; lo integer; blockers text[];
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into q from public.lead_engine_quotes where id=p_id;
  if found then
    if q.operator_id<>p_operator or q.plan_id<>p_plan or q.folder_id is distinct from p_folder or q.name<>p_name or q.max_results<>p_count then
      raise exception using errcode='P0001',message='idempotency_conflict'; end if;
  else
    select * into p from public.lead_engine_plans where id=p_plan and operator_id=p_operator;
    if not found then raise exception using errcode='P0001',message='plan_not_found'; end if;
    if p.status<>'draft' or p.lane<>'A' then raise exception using errcode='P0001',message='invalid_state'; end if;
    if p_count is null or p_count not between 1 and 300 then raise exception using errcode='P0001',message='invalid_input'; end if;
    if p_folder is not null and not exists(select 1 from public.lead_engine_folders where id=p_folder and operator_id=p_operator) then
      raise exception using errcode='P0001',message='folder_not_found'; end if;
    select * into r from public.lead_engine_pricing where verified_at<=now() and valid_until>now() order by verified_at desc,id limit 1;
    if not found then raise exception using errcode='P0001',message='pricing_pending'; end if;
    lo:=r.base_min_cents+ceil(p_count::numeric*r.unit_min_millicents/1000)::integer;
    hi:=greatest(1,r.base_max_cents+ceil(p_count::numeric*r.unit_max_millicents/1000)::integer);
    if hi>1000 or hi>p.hard_budget_cents then raise exception using errcode='P0001',message='quote_over_budget'; end if;
    insert into public.lead_engine_quotes(id,operator_id,plan_id,folder_id,name,max_results,rate_id,min_cost_cents,max_cost_cents,expires_at)
      values(p_id,p_operator,p_plan,p_folder,p_name,p_count,r.id,lo,hi,least(now()+interval '15 minutes',r.valid_until)) returning * into q;
  end if;
  blockers:=public.lead_engine_blockers(q.plan_id,'pilot',q.max_results,q.max_cost_cents,'apify',false);
  if q.expires_at<=now() then blockers:=array_append(blockers,'quote_expired'); end if;
  return jsonb_build_object('quote',to_jsonb(q),'blockers',to_jsonb(blockers),'scope','discovery_only');
end; $$;

create or replace function public.lead_engine_approve_quote(p_operator uuid,p_quote uuid)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare q public.lead_engine_quotes; r public.lead_engine_pricing; p public.lead_engine_plans; blockers text[];
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into q from public.lead_engine_quotes where id=p_quote and operator_id=p_operator;
  if not found then raise exception using errcode='P0001',message='quote_not_found'; end if;
  if q.approved_at is not null then return q.id; end if;
  if q.expires_at<=now() then raise exception using errcode='P0001',message='quote_expired'; end if;
  select * into r from public.lead_engine_pricing where id=q.rate_id;
  if r.valid_until<=now() or r.verified_at>now() then raise exception using errcode='P0001',message='pricing_pending'; end if;
  blockers:=public.lead_engine_blockers(q.plan_id,'pilot',q.max_results,q.max_cost_cents,'apify',false);
  if cardinality(blockers)>0 then raise exception using errcode='P0001',message=blockers[1]; end if;
  select * into p from public.lead_engine_plans where id=q.plan_id;
  insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,provider,search_claims,evidence_ref)
    values(q.id,q.plan_id,p_operator,'pilot','prepared',q.max_results,q.max_cost_cents,'apify',
      jsonb_build_array(jsonb_build_object('source','apify','query',btrim(regexp_replace(lower(p.input->>'industry'),'[^a-z0-9]+',' ','g')),
        'metro',btrim(regexp_replace(lower(p.input->>'metro'),'[^a-z0-9]+',' ','g')))),r.evidence_ref);
  insert into public.lead_engine_discovery_jobs(batch_id,plan_id,operator_id,actor_id,build_tag,search_term,location,max_results,max_cost_cents,contract_evidence_ref,approved_by,approved_at,valid_until)
    values(q.id,q.plan_id,p_operator,r.actor_id,r.build_tag,p.input->>'industry',p.input->>'metro',q.max_results,q.max_cost_cents,r.evidence_ref,p_operator,now(),q.expires_at);
  insert into public.lead_engine_lists(id,operator_id,plan_id,folder_id,name) values(q.id,p_operator,q.plan_id,q.folder_id,q.name);
  update public.lead_engine_quotes set approved_at=now() where id=q.id;
  return q.id;
end; $$;

create or replace function public.lead_engine_move_list(p_operator uuid,p_list uuid,p_folder uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$ begin
  if p_folder is not null and not exists(select 1 from public.lead_engine_folders where id=p_folder and operator_id=p_operator) then
    raise exception using errcode='P0001',message='folder_not_found'; end if;
  update public.lead_engine_lists set folder_id=p_folder where id=p_list and operator_id=p_operator;
  if not found then raise exception using errcode='P0001',message='list_not_found'; end if;
end; $$;

create or replace function public.lead_engine_ingest_page(p_operator uuid,p_list uuid,p_offset integer,p_total integer,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare l public.lead_engine_lists; j public.lead_engine_discovery_jobs; item jsonb; idx integer:=0; n integer; reason text;
begin
  perform 1 from public.lead_engine_control where scope='nbc-internal' for update;
  select * into l from public.lead_engine_lists where id=p_list and operator_id=p_operator;
  if not found then raise exception using errcode='P0001',message='list_not_found'; end if;
  select * into j from public.lead_engine_discovery_jobs where batch_id=p_list and operator_id=p_operator;
  if j.status is distinct from 'succeeded' then raise exception using errcode='P0001',message='invalid_state'; end if;
  if p_offset is null or p_offset<0 or p_total is null or p_total<0 or p_total>j.max_results or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode='P0001',message='invalid_dataset'; end if;
  n:=jsonb_array_length(p_rows);
  if (l.dataset_total is not null and l.dataset_total<>p_total) or n>50 or p_offset+n>p_total or (n=0 and p_offset<p_total) then raise exception using errcode='P0001',message='invalid_dataset'; end if;
  if p_offset<l.cursor or l.import_status='complete' then return to_jsonb(l); end if;
  if p_offset<>l.cursor then raise exception using errcode='P0001',message='cursor_conflict'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    reason:=item->>'rejection';
    if reason is null and (coalesce(item->>'name','')='' or item->>'phone10' is null or item->>'sourceUrl' is null or coalesce(item->>'businessKey','')='') then
      reason:='incomplete_source'; end if;
    if exists(select 1 from public.lead_engine_suppressions where phone10=item->>'phone10') then reason:='suppressed';
    elsif exists(select 1 from public.lead_engine_deliveries where phone10=item->>'phone10') then reason:='already_delivered';
    elsif exists(select 1 from public.lead_engine_businesses where phone10=item->>'phone10' or place_id=item->>'placeId' or name_city=replace(item->>'businessKey','|',' ')) then reason:='already_processed';
    elsif reason is null and exists(select 1 from public.lead_engine_candidates where rejection is null and
      (phone10=item->>'phone10' or place_id=item->>'placeId' or business_key=item->>'businessKey')) then reason:='duplicate'; end if;
    insert into public.lead_engine_candidates(list_id,position,name,city,state,website,source_url,phone10,place_id,business_key,rejection)
      values(p_list,p_offset+idx,coalesce(item->>'name',''),coalesce(item->>'city',''),coalesce(item->>'state',''),item->>'website',item->>'sourceUrl',item->>'phone10',item->>'placeId',coalesce(item->>'businessKey',''),reason);
    idx:=idx+1;
  end loop;
  update public.lead_engine_lists set cursor=p_offset+n,dataset_total=p_total,import_status=case when p_offset+n=p_total then 'complete' else 'importing' end where id=p_list returning * into l;
  return to_jsonb(l);
end; $$;

-- Public presentation through authenticated server only. Never include raw/unverified phones.
create or replace function public.lead_engine_list_records(p_operator uuid,p_list uuid,p_offset integer)
returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(jsonb_build_object('position',c.position,'name',c.name,'city',c.city,'state',c.state,'website',c.website,'sourceUrl',c.source_url,
    'reviewStatus',case when exists(select 1 from public.lead_engine_suppressions s where s.phone10=c.phone10) then 'suppressed' else coalesce(c.rejection,'verification_pending') end)
    order by c.position),'[]'::jsonb)
  from (select r.* from public.lead_engine_candidates r join public.lead_engine_lists l on l.id=r.list_id
    where l.operator_id=p_operator and l.id=p_list and r.position>=p_offset order by r.position limit 50) c;
$$;

-- Minimal direct roles: app server only. service_role bypasses RLS by Supabase design;
-- owner filters are mandatory in services/RPCs. No multi-tenant guarantee is claimed.
do $$
declare t text; f record;
begin
  foreach t in array array['control','plans','provider_accounts','plan_approvals','batches','costs','searches','businesses','suppressions','deliveries','discovery_jobs','pricing','folders','quotes','lists','candidates'] loop
    execute format('alter table public.%I enable row level security', 'lead_engine_' || t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', 'lead_engine_' || t);
    execute format('grant select, insert on public.%I to service_role', 'lead_engine_' || t);
    if t in ('control','plans','provider_accounts','batches','discovery_jobs','quotes','lists') then
      execute format('grant update on public.%I to service_role', 'lead_engine_' || t);
    end if;
    if t in ('costs','searches','businesses','suppressions','deliveries','plan_approvals','pricing','folders','candidates') then
      execute format('drop trigger if exists lead_engine_immutable on public.%I', 'lead_engine_' || t);
      execute format('create trigger lead_engine_immutable before update or delete on public.%I for each row execute function public.lead_engine_immutable()', 'lead_engine_' || t);
    end if;
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'lead_engine_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end; $$;
-- No user policies: default deny, matching the existing NBC internal service pattern.
-- Rollback requires reviewed backup and dropping only these L01 functions/tables in FK order.
-- Do not rerun/modify after integration; follow-up fixes need a separately assigned migration.
commit;
