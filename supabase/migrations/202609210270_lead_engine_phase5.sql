-- Owner Cell App, Phase 4 task 5 and Phase 5 tasks 2 and 3: the reviews vendors on the meter, the entity
-- graph dedupe key and read function, and the Owner Probability Score weekly report.
-- Additive on top of 202609210230, 0240 and 0250 (untouched). Apply to production only with Franco's explicit go.
begin;

-- 1. Vendors: anthropic (small-model owner name pass) joins the meter. The two vendor enums are CHECK
--    constraints, so they are dropped and re-added with the new value; 'reviews' is already a step.
alter table public.lead_engine_job_spend drop constraint if exists lead_engine_job_spend_vendor_check;
alter table public.lead_engine_job_spend add constraint lead_engine_job_spend_vendor_check
  check (vendor in ('outscraper','apify','batchdata','telnyx','datazapp','anthropic'));
alter table public.lead_engine_daily_ceilings drop constraint if exists lead_engine_daily_ceilings_vendor_check;
alter table public.lead_engine_daily_ceilings add constraint lead_engine_daily_ceilings_vendor_check
  check (vendor in ('outscraper','apify','batchdata','telnyx','datazapp','anthropic'));
insert into public.lead_engine_daily_ceilings(vendor, ceiling_cents, alert_cents) values ('anthropic', 500, 400)
on conflict (vendor) do nothing;

-- 2. Entity graph: one observation per (edge, source, day). observed_day is generated so PostgREST can
--    name it in ON CONFLICT; the cast goes through UTC to stay immutable.
alter table public.lead_engine_entity_graph_edges
  add column if not exists observed_day date generated always as (((observed_at at time zone 'UTC'))::date) stored;
create unique index if not exists lead_engine_edges_daily_uniq
  on public.lead_engine_entity_graph_edges(from_type, from_id, to_type, to_id, relation, source, observed_day);

-- The neighborhood of one phone: its own edges, the edges of the persons, businesses, licenses, places,
-- npis and sos_entities those touch, and one more ring (person -> license -> business). Other phones are
-- never expanded, so a shared front desk line cannot pull in a whole strip mall. Newest first, bounded.
create or replace function public.lead_engine_phone_neighborhood(p_phone text)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  with direct as (
    select * from public.lead_engine_entity_graph_edges
    where (from_type = 'phone' and from_id = p_phone) or (to_type = 'phone' and to_id = p_phone)
  ), nodes1 as (
    select from_type as t, from_id as i from direct where from_type <> 'phone'
    union select to_type, to_id from direct where to_type <> 'phone'
  ), hop1 as (
    select e.* from public.lead_engine_entity_graph_edges e join nodes1 n on (e.from_type = n.t and e.from_id = n.i) or (e.to_type = n.t and e.to_id = n.i)
  ), nodes2 as (
    select from_type as t, from_id as i from hop1 where from_type <> 'phone'
    union select to_type, to_id from hop1 where to_type <> 'phone'
  ), hop2 as (
    select e.* from public.lead_engine_entity_graph_edges e join nodes2 n on (e.from_type = n.t and e.from_id = n.i) or (e.to_type = n.t and e.to_id = n.i)
  ), all_edges as (
    select * from direct union select * from hop1 union select * from hop2
  )
  select coalesce(jsonb_agg(to_jsonb(x) - 'id' - 'observed_day' order by x.observed_at desc), '[]'::jsonb)
  from (select * from all_edges order by observed_at desc limit 500) x;
$$;

-- 3. Owner Probability Score report: reached-owner rate by bucket, recipe, source and state from every
--    dial outcome of the operator, features read from the frozen snapshot. Weekly acceptance report.
create or replace function public.lead_engine_score_report(p_operator uuid)
returns jsonb language sql stable security invoker set search_path = pg_catalog, public as $$
  with o as (
    select d.outcome, d.dialed_at_utc,
      coalesce(l.recipe, d.features_snapshot ->> 'recipe') as recipe,
      coalesce(l.bucket::text, d.features_snapshot ->> 'bucket', 'none') as bucket,
      coalesce(l.source_register, d.features_snapshot ->> 'source_register', 'unknown') as source,
      coalesce(d.features_snapshot ->> 'state', 'unknown') as state
    from public.lead_engine_dial_outcomes d join public.lead_engine_row_ledger l on l.id = d.ledger_id
    where d.operator_id = p_operator
  ), agg as (
    select 'bucket' as dim, bucket as key, count(*) as dials, count(*) filter (where outcome = 'reached_owner') as reached,
      count(*) filter (where outcome in ('gatekeeper')) as gatekeeper, count(*) filter (where outcome in ('wrong_number','disconnected')) as bad_number from o group by bucket
    union all select 'recipe', recipe, count(*), count(*) filter (where outcome = 'reached_owner'), count(*) filter (where outcome = 'gatekeeper'), count(*) filter (where outcome in ('wrong_number','disconnected')) from o group by recipe
    union all select 'source', source, count(*), count(*) filter (where outcome = 'reached_owner'), count(*) filter (where outcome = 'gatekeeper'), count(*) filter (where outcome in ('wrong_number','disconnected')) from o group by source
    union all select 'state', state, count(*), count(*) filter (where outcome = 'reached_owner'), count(*) filter (where outcome = 'gatekeeper'), count(*) filter (where outcome in ('wrong_number','disconnected')) from o group by state
  ), rows_json as (
    select dim, jsonb_agg(jsonb_build_object('key', key, 'dials', dials, 'reached_owner', reached, 'gatekeeper', gatekeeper, 'bad_number', bad_number,
      'reached_rate', case when dials > 0 then round(reached::numeric / dials, 4) else 0 end) order by dials desc, key) as items
    from agg group by dim
  )
  select jsonb_build_object(
    'generated_at', now(),
    'window', jsonb_build_object('from', (select min(dialed_at_utc) from o), 'to', (select max(dialed_at_utc) from o)),
    'total', jsonb_build_object('dials', (select count(*) from o), 'reached_owner', (select count(*) filter (where outcome = 'reached_owner') from o),
      'reached_rate', (select case when count(*) > 0 then round((count(*) filter (where outcome = 'reached_owner'))::numeric / count(*), 4) else 0 end from o),
      'last_7_days', (select count(*) from o where dialed_at_utc >= now() - interval '7 days')),
    'by_bucket', coalesce((select items from rows_json where dim = 'bucket'), '[]'::jsonb),
    'by_recipe', coalesce((select items from rows_json where dim = 'recipe'), '[]'::jsonb),
    'by_source', coalesce((select items from rows_json where dim = 'source'), '[]'::jsonb),
    'by_state', coalesce((select items from rows_json where dim = 'state'), '[]'::jsonb));
$$;

-- Same posture as the earlier files: functions to service_role only; the tables keep their RLS and grants.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('lead_engine_phone_neighborhood','lead_engine_score_report') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

commit;
