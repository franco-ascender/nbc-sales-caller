-- Owner Cell App, Phase 2 task 1: the nightly register ingest runs, their RPCs, the phone reuse counter
-- and the per-source summary. Additive on top of 202609210230 (register_snapshots, names) and
-- 202609210240 (jobs). Apply to production only with Franco's explicit go.
--
-- One run = one pass over one register. A serverless call ingests one segment (a Socrata page, a byte
-- range of a CSV, a PALS surname page), writes the rows, saves the cursor and returns. Any HTTP error
-- freezes the run (needs_attention) with a sanitized reason and the cursor kept; resume continues from it.
-- register_snapshots stays append-only (insert ... on conflict do nothing); names is upserted on
-- (source, source_row_id) so the recipe workers always read the register's latest view of a person.
begin;

-- 1. Runs.
create table if not exists public.lead_engine_register_ingests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source ~ '^[a-z0-9_.:-]{1,80}$'),
  operator_id uuid not null references auth.users(id),
  status text not null default 'draft' check (status in ('draft','running','done','needs_attention')),
  cursor jsonb not null default '{}' check (jsonb_typeof(cursor) = 'object'),
  rows_seen integer not null default 0 check (rows_seen >= 0),
  rows_named integer not null default 0 check (rows_named >= 0),
  rows_skipped integer not null default 0 check (rows_skipped >= 0),
  snapshot_date date not null default current_date,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  attention_reason text check (attention_reason is null or length(attention_reason) <= 600),
  check (status <> 'needs_attention' or attention_reason is not null),
  check (status <> 'done' or finished_at is not null)
);
-- One active run per source: a second start returns the existing run instead of opening another.
create unique index if not exists lead_engine_register_ingests_active_idx
  on public.lead_engine_register_ingests(source) where status in ('draft','running','needs_attention');
create index if not exists lead_engine_register_ingests_source_idx on public.lead_engine_register_ingests(source, started_at desc);

-- 2. Start: idempotent. Returns the active run for the source or opens a draft one.
create or replace function public.lead_engine_register_start(p_operator uuid, p_source text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.lead_engine_register_ingests;
begin
  if p_source is null or p_source !~ '^[a-z0-9_.:-]{1,80}$' then raise exception using errcode = 'P0001', message = 'invalid_source'; end if;
  if not exists(select 1 from auth.users where id = p_operator) then raise exception using errcode = 'P0001', message = 'operator_not_found'; end if;
  perform 1 from public.lead_engine_control where scope = 'nbc-internal' for update;
  select * into r from public.lead_engine_register_ingests where source = p_source and status in ('draft','running','needs_attention') limit 1;
  if found then return to_jsonb(r); end if;
  insert into public.lead_engine_register_ingests(source, operator_id) values (p_source, p_operator) returning * into r;
  return to_jsonb(r);
end; $$;

-- 3. Progress after one segment: cursor and counters are replaced by what the runner holds (it is the
-- single writer of the run). p_done closes the run; p_reason parks it; otherwise it is running.
create or replace function public.lead_engine_register_progress(p_operator uuid, p_run uuid, p_cursor jsonb, p_seen integer, p_named integer, p_skipped integer, p_done boolean, p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.lead_engine_register_ingests;
begin
  if p_cursor is null or jsonb_typeof(p_cursor) <> 'object' then raise exception using errcode = 'P0001', message = 'invalid_cursor'; end if;
  if coalesce(p_seen, -1) < 0 or coalesce(p_named, -1) < 0 or coalesce(p_skipped, -1) < 0 then raise exception using errcode = 'P0001', message = 'invalid_counters'; end if;
  select * into r from public.lead_engine_register_ingests where id = p_run for update;
  if not found then raise exception using errcode = 'P0001', message = 'run_not_found'; end if;
  if r.status = 'done' then raise exception using errcode = 'P0001', message = 'run_finished'; end if;
  if r.status = 'needs_attention' and p_reason is null and not coalesce(p_done, false) then raise exception using errcode = 'P0001', message = 'run_needs_attention'; end if;
  update public.lead_engine_register_ingests set
    cursor = p_cursor, rows_seen = p_seen, rows_named = p_named, rows_skipped = p_skipped, updated_at = now(),
    status = case when p_reason is not null then 'needs_attention' when coalesce(p_done, false) then 'done' else 'running' end,
    attention_reason = case when p_reason is not null then left(p_reason, 600) else null end,
    finished_at = case when p_reason is null and coalesce(p_done, false) then now() else null end
    where id = r.id returning * into r;
  return to_jsonb(r);
end; $$;

-- 4. Resume a parked run: back to running with the cursor it kept.
create or replace function public.lead_engine_register_resume(p_operator uuid, p_run uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.lead_engine_register_ingests;
begin
  select * into r from public.lead_engine_register_ingests where id = p_run for update;
  if not found then raise exception using errcode = 'P0001', message = 'run_not_found'; end if;
  if r.status <> 'needs_attention' then raise exception using errcode = 'P0001', message = 'not_resumable'; end if;
  update public.lead_engine_register_ingests set status = 'running', attention_reason = null, updated_at = now() where id = r.id returning * into r;
  return to_jsonb(r);
end; $$;

-- 5. Write one segment: snapshots append-only, names upserted. p_rows is an array of
-- {row_key, row_hash, payload, name: {source_row_id, first_name, ...} | null}. Returns the counts written.
create or replace function public.lead_engine_register_write(p_operator uuid, p_run uuid, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.lead_engine_register_ingests; snapshots integer := 0; names integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception using errcode = 'P0001', message = 'invalid_rows'; end if;
  select * into r from public.lead_engine_register_ingests where id = p_run;
  if not found then raise exception using errcode = 'P0001', message = 'run_not_found'; end if;
  if r.status = 'done' then raise exception using errcode = 'P0001', message = 'run_finished'; end if;
  with src as (
    select distinct on (row_key) row_key, row_hash, payload
      from jsonb_to_recordset(p_rows) as x(row_key text, row_hash text, payload jsonb)
      where row_key is not null and row_hash is not null and payload is not null
  ), ins as (
    insert into public.lead_engine_register_snapshots(source, snapshot_date, row_key, row_hash, payload)
      select r.source, r.snapshot_date, row_key, row_hash, payload from src
      on conflict (source, snapshot_date, row_key) do nothing
      returning 1
  ) select count(*) into snapshots from ins;
  with src as (
    select distinct on (n.source_row_id) n.*
      from jsonb_to_recordset(p_rows) as x(name jsonb)
      cross join lateral jsonb_to_record(x.name) as n(source_row_id text, first_name text, last_name text, company text, title_code text, business_type text,
        license_issue_date date, license_expires_at date, issuing_state text, street text, city text, county text, state text, zip text, phone10 text, email text)
      where x.name is not null and jsonb_typeof(x.name) = 'object' and n.source_row_id is not null
      order by n.source_row_id
  ), ups as (
    insert into public.lead_engine_names(source, source_row_id, first_name, last_name, company, title_code, business_type, license_issue_date, license_expires_at, issuing_state, street, city, county, state, zip, phone10, email)
      select r.source, source_row_id, first_name, last_name, company, title_code, business_type, license_issue_date, license_expires_at, issuing_state, street, city, county, state, zip, phone10, email from src
      on conflict (source, source_row_id) do update set
        first_name = excluded.first_name, last_name = excluded.last_name, company = excluded.company, title_code = excluded.title_code, business_type = excluded.business_type,
        license_issue_date = excluded.license_issue_date, license_expires_at = excluded.license_expires_at, issuing_state = excluded.issuing_state,
        street = excluded.street, city = excluded.city, county = excluded.county, state = excluded.state, zip = excluded.zip, phone10 = excluded.phone10, email = excluded.email,
        ingested_at = now()
      returning 1
  ) select count(*) into names from ups;
  return jsonb_build_object('snapshots', snapshots, 'names', names);
end; $$;

-- 6. Phone reuse within a source: how many distinct register rows share each phone. The recipe worker
-- drops phones on more than 3 licences (MN: one phone on 189 licences; CSLB Sole Owner worst case 5).
create or replace function public.lead_engine_names_reuse(p_source text)
returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare updated integer;
begin
  if p_source is null or p_source !~ '^[a-z0-9_.:-]{1,80}$' then raise exception using errcode = 'P0001', message = 'invalid_source'; end if;
  with counts as (
    select phone10, count(distinct source_row_id)::integer as uses from public.lead_engine_names where source = p_source and phone10 is not null group by phone10
  ), changed as (
    update public.lead_engine_names n set reuse_count = coalesce(c.uses, 0)
      from public.lead_engine_names m left join counts c on c.phone10 = m.phone10
      where n.id = m.id and n.source = p_source and n.reuse_count <> coalesce(c.uses, 0)
      returning 1
  ) select count(*) into updated from changed;
  return updated;
end; $$;

-- 7. Per-source summary for the UI: names, with phone, reusable phones, last snapshot, last run.
create or replace function public.lead_engine_register_summary()
returns table (source text, names bigint, with_phone bigint, dialable bigint, last_snapshot_date date, snapshot_rows bigint,
               run_id uuid, run_status text, rows_seen integer, rows_named integer, rows_skipped integer, attention_reason text, run_updated_at timestamptz, run_cursor jsonb)
language sql stable security invoker set search_path = pg_catalog, public as $$
  with sources as (
    select source from public.lead_engine_names
    union select source from public.lead_engine_register_snapshots
    union select source from public.lead_engine_register_ingests
  ), n as (
    select source, count(*) as names, count(phone10) as with_phone, count(*) filter (where phone10 is not null and reuse_count <= 3) as dialable
      from public.lead_engine_names group by source
  ), s as (
    select source, max(snapshot_date) as last_snapshot_date from public.lead_engine_register_snapshots group by source
  ), sr as (
    select sn.source, count(*) as snapshot_rows from public.lead_engine_register_snapshots sn join s on s.source = sn.source and s.last_snapshot_date = sn.snapshot_date group by sn.source
  ), r as (
    select distinct on (source) source, id, status, rows_seen, rows_named, rows_skipped, attention_reason, updated_at, cursor
      from public.lead_engine_register_ingests order by source, started_at desc
  )
  select src.source, coalesce(n.names, 0), coalesce(n.with_phone, 0), coalesce(n.dialable, 0), s.last_snapshot_date, coalesce(sr.snapshot_rows, 0),
         r.id, r.status, r.rows_seen, r.rows_named, r.rows_skipped, r.attention_reason, r.updated_at, r.cursor
    from sources src left join n on n.source = src.source left join s on s.source = src.source left join sr on sr.source = src.source left join r on r.source = src.source
    order by src.source;
$$;

-- 8. New licensees (Phase 5 task 1): names whose first snapshot within the source is within the last p_days.
create or replace function public.lead_engine_new_licensees(p_source text, p_days integer)
returns setof public.lead_engine_names language sql stable security invoker set search_path = pg_catalog, public as $$
  with first_seen as (
    select row_key, min(snapshot_date) as first_snapshot from public.lead_engine_register_snapshots where source = p_source group by row_key
  ), earliest as (
    select min(snapshot_date) as oldest from public.lead_engine_register_snapshots where source = p_source
  )
  select n.* from public.lead_engine_names n
    join first_seen f on f.row_key = n.source_row_id
    cross join earliest e
    where n.source = p_source
      and p_days between 1 and 3650
      and f.first_snapshot > current_date - p_days
      -- A row is "new" only once an older snapshot exists to compare against; the first ever ingest is a baseline, not news.
      and e.oldest < f.first_snapshot
    order by f.first_snapshot desc, n.license_issue_date desc nulls last;
$$;

-- 9. Access: RLS on, default deny, service_role only. Runs are updatable (cursor moves); snapshots keep their immutable trigger from 202609210230.
alter table public.lead_engine_register_ingests enable row level security;
revoke all on public.lead_engine_register_ingests from public, anon, authenticated;
grant select, insert, update on public.lead_engine_register_ingests to service_role;
revoke all on function public.lead_engine_register_start(uuid,text), public.lead_engine_register_progress(uuid,uuid,jsonb,integer,integer,integer,boolean,text),
  public.lead_engine_register_resume(uuid,uuid), public.lead_engine_register_write(uuid,uuid,jsonb), public.lead_engine_names_reuse(text),
  public.lead_engine_register_summary(), public.lead_engine_new_licensees(text,integer) from public, anon, authenticated;
grant execute on function public.lead_engine_register_start(uuid,text), public.lead_engine_register_progress(uuid,uuid,jsonb,integer,integer,integer,boolean,text),
  public.lead_engine_register_resume(uuid,uuid), public.lead_engine_register_write(uuid,uuid,jsonb), public.lead_engine_names_reuse(text),
  public.lead_engine_register_summary(), public.lead_engine_new_licensees(text,integer) to service_role;

commit;
