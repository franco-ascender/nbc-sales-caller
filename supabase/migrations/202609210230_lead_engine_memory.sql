-- Owner Cell App, Phase 0 task 1: the memory tables and the caches the recipes need.
-- Additive on top of 202609140010 (untouched). Apply to production only with Franco's explicit go.
--
-- row_ledger and dial_outcomes are built before any list is produced because the data they hold
-- (provenance per delivered number, the result of every call with the row's features frozen at
-- delivery) cannot be recovered later. They are the training set of the Owner Probability Score.
begin;

-- 1. row_ledger: one append-only provenance record per delivered number.
create table if not exists public.lead_engine_row_ledger (
  id uuid primary key default gen_random_uuid(),
  phone10 text not null unique references public.lead_engine_deliveries(phone10),
  batch_id uuid not null references public.lead_engine_batches(id),
  operator_id uuid not null references auth.users(id),
  recipe text not null check (recipe in ('A','B','C','D')),
  bucket smallint check (bucket is null or bucket between 1 and 4),
  source_register text check (source_register is null or length(source_register) between 1 and 120),
  source_row_id text check (source_row_id is null or length(source_row_id) between 1 and 200),
  source_fetched_at timestamptz,
  maps_place_id text check (maps_place_id is null or length(maps_place_id) between 1 and 200),
  maps_phone_at_fetch text check (maps_phone_at_fetch is null or maps_phone_at_fetch ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  business_line_evidence text not null default 'none'
    check (business_line_evidence in ('register_eq_maps','verify_business_flag','none')),
  verify_vendor text not null check (length(verify_vendor) between 1 and 60),
  verified_at timestamptz not null,
  line_type text not null check (line_type = 'Mobile'),
  dnc_file_version text check (dnc_file_version is null or length(dnc_file_version) between 1 and 120),
  dnc_checked_at timestamptz not null,
  litigator_vendor text not null check (length(litigator_vendor) between 1 and 60),
  litigator_checked_at timestamptz not null,
  reassigned_checked_at timestamptz,
  legal_gate text not null check (length(legal_gate) between 1 and 200),
  tz text not null,
  -- The dial window is a schema rule, not a convention: 08:00 to 20:00 recipient local (Florida cap).
  dial_window_start_local time not null default '08:00' check (dial_window_start_local >= '08:00'),
  dial_window_end_local time not null default '20:00' check (dial_window_end_local <= '20:00'),
  features jsonb not null default '{}' check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  check (dial_window_start_local < dial_window_end_local),
  check (source_register is null or source_row_id is not null)
);
create index if not exists lead_engine_row_ledger_batch_idx on public.lead_engine_row_ledger(batch_id);
create index if not exists lead_engine_row_ledger_owner_idx on public.lead_engine_row_ledger(operator_id, created_at desc);
create index if not exists lead_engine_row_ledger_source_idx on public.lead_engine_row_ledger(source_register, source_row_id);

-- Freshness and consistency that a CHECK cannot express (subqueries, now()).
create or replace function public.lead_engine_ledger_gate() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare d public.lead_engine_deliveries;
begin
  select * into d from public.lead_engine_deliveries where phone10 = new.phone10;
  if not found or d.batch_id <> new.batch_id or d.operator_id <> new.operator_id then
    raise exception using errcode = 'P0001', message = 'ledger_delivery_mismatch';
  end if;
  if not exists (select 1 from pg_timezone_names where name = new.tz) or d.time_zone <> new.tz then
    raise exception using errcode = 'P0001', message = 'ledger_timezone_invalid';
  end if;
  if new.dnc_checked_at > now() + interval '1 minute' or new.dnc_checked_at <= now() - interval '31 days'
     or new.litigator_checked_at > now() + interval '1 minute' or new.litigator_checked_at <= now() - interval '31 days'
     or new.verified_at > now() + interval '1 minute' or new.verified_at <= now() - interval '31 days' then
    raise exception using errcode = 'P0001', message = 'ledger_scrub_stale';
  end if;
  return new;
end; $$;
drop trigger if exists lead_engine_ledger_gate on public.lead_engine_row_ledger;
create trigger lead_engine_ledger_gate before insert on public.lead_engine_row_ledger
  for each row execute function public.lead_engine_ledger_gate();

-- 2. dial_outcomes: every call, with the row's features frozen at delivery time.
create table if not exists public.lead_engine_dial_outcomes (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.lead_engine_row_ledger(id),
  phone10 text not null,
  batch_id uuid not null,
  operator_id uuid not null references auth.users(id),
  dialed_at_utc timestamptz not null,
  dialed_at_local time not null,
  local_hour smallint not null check (local_hour between 0 and 23),
  outcome text not null check (outcome in ('reached_owner','gatekeeper','wrong_number','voicemail','disconnected','opt_out','no_answer')),
  within_dial_window boolean not null,
  features_snapshot jsonb not null check (jsonb_typeof(features_snapshot) = 'object'),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists lead_engine_dial_outcomes_ledger_idx on public.lead_engine_dial_outcomes(ledger_id);
create index if not exists lead_engine_dial_outcomes_owner_idx on public.lead_engine_dial_outcomes(operator_id, dialed_at_utc desc);
create index if not exists lead_engine_dial_outcomes_outcome_idx on public.lead_engine_dial_outcomes(outcome);

-- The only write path for an outcome. Freezes the snapshot, derives local time from the ledger's zone,
-- and honours opt-outs and wrong numbers immediately and permanently through the global suppression list.
create or replace function public.lead_engine_record_dial_outcome(p_operator uuid, p_ledger uuid, p_outcome text, p_dialed_at timestamptz, p_notes text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare l public.lead_engine_row_ledger; local_ts timestamp; o public.lead_engine_dial_outcomes; snap jsonb;
begin
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into l from public.lead_engine_row_ledger where id = p_ledger and operator_id = p_operator;
  if not found then raise exception using errcode = 'P0001', message = 'ledger_not_found'; end if;
  if p_outcome is null or p_outcome not in ('reached_owner','gatekeeper','wrong_number','voicemail','disconnected','opt_out','no_answer') then
    raise exception using errcode = 'P0001', message = 'invalid_outcome';
  end if;
  -- Callers backfill yesterday's sheet, so the lower bound is the scrub window, not the delivery minute.
  if p_dialed_at is null or p_dialed_at > now() + interval '5 minutes' or p_dialed_at < l.created_at - interval '31 days' then
    raise exception using errcode = 'P0001', message = 'invalid_dial_time';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then raise exception using errcode = 'P0001', message = 'invalid_input'; end if;
  local_ts := p_dialed_at at time zone l.tz;
  snap := l.features || jsonb_build_object(
    'recipe', l.recipe, 'bucket', l.bucket, 'source_register', l.source_register,
    'business_line_evidence', l.business_line_evidence, 'line_type', l.line_type, 'tz', l.tz,
    'local_hour', extract(hour from local_ts)::int, 'delivered_at', l.created_at);
  insert into public.lead_engine_dial_outcomes(ledger_id, phone10, batch_id, operator_id, dialed_at_utc, dialed_at_local, local_hour, outcome, within_dial_window, features_snapshot, notes)
  values (l.id, l.phone10, l.batch_id, p_operator, p_dialed_at, local_ts::time, extract(hour from local_ts)::int, p_outcome,
          local_ts::time >= l.dial_window_start_local and local_ts::time < l.dial_window_end_local, snap, p_notes)
  returning * into o;
  if p_outcome in ('opt_out','wrong_number') then
    insert into public.lead_engine_suppressions(phone10, reason, evidence_ref)
    values (l.phone10, p_outcome, 'dial_outcome:' || o.id) on conflict (phone10) do nothing;
  end if;
  return to_jsonb(o);
end; $$;

-- 3. register_snapshots: every ingest is a snapshot and a diff, never an overwrite.
create table if not exists public.lead_engine_register_snapshots (
  source text not null check (source ~ '^[a-z0-9_.:-]{1,80}$'),
  snapshot_date date not null,
  row_key text not null check (length(row_key) between 1 and 300),
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  fetched_at timestamptz not null default now(),
  primary key (source, snapshot_date, row_key)
);
create index if not exists lead_engine_register_snapshots_key_idx on public.lead_engine_register_snapshots(source, row_key, snapshot_date desc);

-- 4. entity_graph_edges: what the public registers overwrite, we keep with history.
create table if not exists public.lead_engine_entity_graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_type text not null check (from_type in ('person','business','license','phone','place','permit','sos_entity','npi')),
  from_id text not null check (length(from_id) between 1 and 300),
  to_type text not null check (to_type in ('person','business','license','phone','place','permit','sos_entity','npi')),
  to_id text not null check (length(to_id) between 1 and 300),
  relation text not null check (relation ~ '^[a-z_]{1,60}$'),
  source text not null check (length(source) between 1 and 120),
  observed_at timestamptz not null default now(),
  payload jsonb check (payload is null or jsonb_typeof(payload) = 'object')
);
create index if not exists lead_engine_edges_from_idx on public.lead_engine_entity_graph_edges(from_type, from_id, observed_at desc);
create index if not exists lead_engine_edges_to_idx on public.lead_engine_entity_graph_edges(to_type, to_id, observed_at desc);

-- 5. verified: the 31 day verification cache shared across every user. Updatable; the ledger keeps history.
create table if not exists public.lead_engine_verified (
  phone10 text primary key check (phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  line_type text check (line_type is null or length(line_type) <= 40),
  dnc boolean,
  tcpa boolean,
  reachable boolean,
  carrier text check (carrier is null or length(carrier) <= 120),
  caller_type text check (caller_type is null or caller_type in ('business','consumer','unknown')),
  vendor text not null check (length(vendor) between 1 and 60),
  verified_at timestamptz not null,
  raw jsonb check (raw is null or jsonb_typeof(raw) = 'object')
);
create or replace function public.lead_engine_verified_fresh(p_phone text) returns boolean
language sql stable security invoker set search_path = pg_catalog, public as $$
  select exists (select 1 from public.lead_engine_verified where phone10 = p_phone and verified_at > now() - interval '31 days');
$$;

-- 6. names: recipe B, C and D input, one row per register record, idempotent on (source, source_row_id).
create table if not exists public.lead_engine_names (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source ~ '^[a-z0-9_.:-]{1,80}$'),
  source_row_id text not null check (length(source_row_id) between 1 and 200),
  first_name text check (first_name is null or length(first_name) <= 120),
  last_name text check (last_name is null or length(last_name) <= 120),
  company text check (company is null or length(company) <= 300),
  title_code text check (title_code is null or length(title_code) <= 80),
  business_type text check (business_type is null or length(business_type) <= 80),
  license_issue_date date,
  license_expires_at date,
  issuing_state text check (issuing_state is null or issuing_state ~ '^[A-Z]{2}$'),
  street text check (street is null or length(street) <= 300),
  city text check (city is null or length(city) <= 120),
  county text check (county is null or length(county) <= 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  zip text check (zip is null or zip ~ '^[0-9]{5}$'),
  phone10 text check (phone10 is null or phone10 ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'),
  email text check (email is null or length(email) <= 254),
  reuse_count integer not null default 0 check (reuse_count >= 0),
  ingested_at timestamptz not null default now(),
  unique (source, source_row_id)
);
create index if not exists lead_engine_names_source_state_idx on public.lead_engine_names(source, state);
create index if not exists lead_engine_names_phone_idx on public.lead_engine_names(phone10) where phone10 is not null;
create index if not exists lead_engine_names_person_idx on public.lead_engine_names(last_name, first_name);

-- 7. state_coverage: drives routing and the UI grey-out. Populated from brain_v2 by the loader, not seeded here.
create table if not exists public.lead_engine_state_coverage (
  state text not null check (state ~ '^[A-Z]{2}$'),
  recipe text not null check (recipe in ('A','B','C','D')),
  status text not null check (status in ('ok','partial','none')),
  legal_status text not null default 'ok' check (legal_status in ('ok','restricted','prohibited')),
  legal_note text check (legal_note is null or length(legal_note) <= 1000),
  name_sources jsonb not null default '[]' check (jsonb_typeof(name_sources) = 'array'),
  registry_phone_sources jsonb not null default '[]' check (jsonb_typeof(registry_phone_sources) = 'array'),
  address_source text check (address_source is null or length(address_source) <= 300),
  recipe_d_ready boolean not null default false,
  notes text check (notes is null or length(notes) <= 2000),
  brain_version text check (brain_version is null or length(brain_version) <= 40),
  updated_at timestamptz not null default now(),
  primary key (state, recipe)
);

-- 8. Jobs record which recipe and brain version produced them (01 section 5). Set at insert, never changed.
alter table public.lead_engine_batches
  add column if not exists recipe_version text check (recipe_version is null or length(recipe_version) <= 40),
  add column if not exists brain_version text check (brain_version is null or length(brain_version) <= 40);

-- Same posture as 202609140010: RLS on, default deny, service_role only, append-only where the data is evidence.
do $$
declare t text; f record;
begin
  foreach t in array array['row_ledger','dial_outcomes','register_snapshots','entity_graph_edges','verified','names','state_coverage'] loop
    execute format('alter table public.%I enable row level security', 'lead_engine_' || t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', 'lead_engine_' || t);
    execute format('grant select, insert on public.%I to service_role', 'lead_engine_' || t);
    if t in ('verified','names','state_coverage') then
      execute format('grant update on public.%I to service_role', 'lead_engine_' || t);
    end if;
    if t in ('row_ledger','dial_outcomes','register_snapshots','entity_graph_edges') then
      execute format('drop trigger if exists lead_engine_immutable on public.%I', 'lead_engine_' || t);
      execute format('create trigger lead_engine_immutable before update or delete on public.%I for each row execute function public.lead_engine_immutable()', 'lead_engine_' || t);
    end if;
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('lead_engine_record_dial_outcome','lead_engine_ledger_gate','lead_engine_verified_fresh') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

commit;
