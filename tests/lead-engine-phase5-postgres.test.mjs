// Phase 4 task 5 and Phase 5 tasks 2 and 3 schema (migration 202609210270): the anthropic vendor on the
// meter, the entity graph dedupe key and neighborhood read, the Owner Probability Score report.
// Destructive only inside an explicitly provided disposable local database.
// Run: L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://user@127.0.0.1:54329/nbc_l01_test node --test tests/lead-engine-phase5-postgres.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const connection = process.env.LEAD_ENGINE_TEST_DATABASE_URL;
const enabled = connection && process.env.L01_SQL_ISOLATED === '1';

function sql(statement, { fail = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(connection);
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
    const child = spawn('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { env: {
      ...environment, PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username) || process.env.USER,
      PGPASSWORD: decodeURIComponent(url.password), PGPASSFILE: '/dev/null',
    }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { errors += part; });
    child.on('error', reject);
    child.on('close', code => {
      if (fail) { if (code !== 0) resolve(errors); else reject(Error('Expected SQL rejection')); }
      else if (code === 0) resolve(output.trim()); else reject(Error(errors));
    });
    child.stdin.end(statement);
  });
}
const json = async statement => JSON.parse(await sql(statement));

const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const job1 = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const input = JSON.stringify({ industry: 'Med spa', industry_key: 'medspa', state: 'FL', target_cells: 10, dnc_mode: 'strict', recipe: 'D', recipe_version: 'D', brain_version: '2026-09-21.1', legal_status: 'ok', legal_note: null, expected_clean: 0.2, credits_per_cell: 2, credit_cents: 10, cap_ratio: 0.6 });

test('phase 5 schema: anthropic on the meter, graph edges dedupe per day with a two hop read, score report by bucket/recipe/source/state',
  { skip: !enabled ? 'No isolated PostgreSQL configured; the phase 5 schema was NOT executed.' : false }, async t => {
  const url = new URL(connection);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only a local isolated database is allowed');
  assert.equal(url.pathname, '/nbc_l01_test', 'Use a fresh disposable nbc_l01_test database');
  assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%';"), '0', 'Refuse an already populated database');
  await sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$; create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
  insert into auth.users values('${owner}'),('${other}') on conflict do nothing;
  grant usage on schema public to anon, authenticated, service_role;`);
  for (const file of ['202609140010_lead_engine.sql', '202609210230_lead_engine_memory.sql', '202609210240_lead_engine_jobs.sql', '202609210250_lead_engine_registers.sql', '202609210270_lead_engine_phase5.sql']) {
    await sql(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  // Idempotent: the phase 5 file applies twice without error.
  await sql(await readFile(new URL('../supabase/migrations/202609210270_lead_engine_phase5.sql', import.meta.url), 'utf8'));
  await sql("update public.lead_engine_control set execution_enabled = true where scope = 'nbc-internal';");

  await t.test('posture: no SECURITY DEFINER, new functions service_role only, edges still RLS and immutable', async () => {
    assert.equal(await sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lead_engine_%' and p.prosecdef;"), '0');
    assert.equal(await sql("select count(*) from information_schema.role_routine_grants where routine_name in ('lead_engine_score_report','lead_engine_phone_neighborhood') and grantee in ('anon','authenticated','PUBLIC');"), '0');
    assert.equal(await sql("select count(*) from information_schema.role_routine_grants where routine_name in ('lead_engine_score_report','lead_engine_phone_neighborhood') and grantee = 'service_role';"), '2');
    assert.equal(await sql("select rowsecurity from pg_tables where tablename = 'lead_engine_entity_graph_edges';"), 't');
  });

  await t.test('meter: anthropic is a vendor with a 500 cent ceiling; a made-up vendor still fails', async () => {
    assert.equal(await sql("select ceiling_cents || ':' || alert_cents from public.lead_engine_daily_ceilings where vendor = 'anthropic';"), '500:400');
    await json(`select public.lead_engine_grant_credits('${owner}',100,'top up');`);
    await json(`select public.lead_engine_create_job('${owner}','${job1}','${input}');`);
    await json(`select public.lead_engine_hold_job('${owner}','${job1}');`);
    const model = await json(`select public.lead_engine_meter('${owner}','${job1}','anthropic','reviews',1,1);`);
    assert.equal(model.allowed, true); assert.ok(model.spend_id);
    const reviews = await json(`select public.lead_engine_meter('${owner}','${job1}','apify','reviews',50,3);`);
    assert.equal(reviews.allowed, true);
    assert.equal(await sql(`select string_agg(vendor || ':' || step || ':' || cents, ',' order by created_at) from public.lead_engine_job_spend where job_id = '${job1}';`), 'anthropic:reviews:1,apify:reviews:3');
    assert.match(await sql(`select public.lead_engine_meter('${owner}','${job1}','openai','reviews',1,1);`, { fail: true }), /unknown_vendor/);
    assert.match(await sql("insert into public.lead_engine_job_spend(job_id,operator_id,vendor,step,units,cents) values ('" + job1 + "','" + owner + "','openai','reviews',1,1);", { fail: true }), /vendor_check/);
  });

  await t.test('graph: same edge same day inserts once, next day adds history; two hop neighborhood of a phone', async () => {
    const edge = (day, relation = 'register_phone') => `insert into public.lead_engine_entity_graph_edges(from_type,from_id,to_type,to_id,relation,source,observed_at)
      values ('person','jane acme','phone','8135550101','${relation}','fl_dbpr','${day}') on conflict (from_type,from_id,to_type,to_id,relation,source,observed_day) do nothing;`;
    await sql(edge('2026-09-20T10:00:00Z')); await sql(edge('2026-09-20T18:00:00Z')); await sql(edge('2026-09-21T10:00:00Z'));
    assert.equal(await sql("select count(*) from public.lead_engine_entity_graph_edges where from_id = 'jane acme';"), '2');
    assert.match(await sql("insert into public.lead_engine_entity_graph_edges(from_type,from_id,to_type,to_id,relation,source) values ('person','x','phone','y','register_phone','s') returning observed_day = (now() at time zone 'UTC')::date;"), /^t$/);
    await sql(`insert into public.lead_engine_entity_graph_edges(from_type,from_id,to_type,to_id,relation,source,observed_at) values
      ('person','jane acme','license','fl_dbpr:CGC123','holds_license','fl_dbpr','2026-09-21T10:00:00Z'),
      ('license','fl_dbpr:CGC123','business','acme roofing|FL|33602','licenses_business','fl_dbpr','2026-09-21T10:00:00Z'),
      ('business','acme roofing|FL|33602','place','ChIJ-acme','listed_at','google_maps','2026-09-21T10:00:00Z'),
      ('person','someone else','phone','9995550101','register_phone','fl_dbpr','2026-09-21T10:00:00Z');`);
    const hood = await json("select public.lead_engine_phone_neighborhood('8135550101');");
    const kinds = new Set(hood.map(item => `${item.from_type}>${item.relation}>${item.to_type}`));
    assert.ok(kinds.has('person>register_phone>phone')); assert.ok(kinds.has('person>holds_license>license'), 'hop 1'); assert.ok(kinds.has('license>licenses_business>business'), 'hop 2 via the license node');
    assert.ok(!hood.some(item => item.from_id === 'someone else'), 'unrelated persons stay out');
    assert.ok(hood.every(item => item.id === undefined && item.observed_day === undefined && typeof item.observed_at === 'string'));
    assert.deepEqual(await json("select public.lead_engine_phone_neighborhood('0000000000');"), []);
    assert.match(await sql("update public.lead_engine_entity_graph_edges set source = 'x' where from_id = 'jane acme';", { fail: true }), /immutable_record/);
  });

  await t.test('score report: reached-owner rate by bucket, recipe, source and state from the frozen snapshots', async () => {
    await json(`select public.lead_engine_sample_result('${owner}','${job1}','{}',true,null);`);
    const job = await json(`select to_jsonb(j) from public.lead_engine_jobs j where id = '${job1}';`);
    const rows = [['7045550001', 2, 'fl_dbpr', 'FL'], ['7045550002', 2, 'fl_dbpr', 'FL'], ['7045550003', 3, 'fl_dbpr', 'FL'], ['7045550004', null, 'google_maps', 'GA']];
    for (const [phone, bucket, source, state] of rows) {
      await sql(`insert into public.lead_engine_businesses(phone10,name_city,source_url,batch_id) values('${phone}','acme ${phone}','https://www.google.com/maps/place/?q=place_id:${phone}','${job.batch_id}');
        insert into public.lead_engine_deliveries(phone10,batch_id,plan_id,operator_id,line_type,dnc,tcpa,reachable,verified_at,time_zone,evidence_ref)
          values('${phone}','${job.batch_id}','${job.plan_id}','${owner}','Mobile',false,false,true,now(),'America/New_York','batchdata test');
        insert into public.lead_engine_row_ledger(phone10,batch_id,operator_id,recipe,bucket,source_register,source_row_id,verify_vendor,verified_at,line_type,dnc_checked_at,litigator_vendor,litigator_checked_at,legal_gate,tz,features)
          values('${phone}','${job.batch_id}','${owner}','D',${bucket ?? 'null'},'${source}','${phone}','batchdata',now(),'Mobile',now(),'batchdata',now(),'FL: ok','America/New_York','{"industry":"medspa","state":"${state}","title_code":"owner"}');`);
    }
    const ledger = async phone => sql(`select id from public.lead_engine_row_ledger where phone10 = '${phone}';`);
    const outcomes = [['7045550001', 'reached_owner'], ['7045550002', 'gatekeeper'], ['7045550003', 'gatekeeper'], ['7045550004', 'wrong_number']];
    for (const [phone, outcome] of outcomes) await json(`select public.lead_engine_record_dial_outcome('${owner}','${await ledger(phone)}','${outcome}','2026-09-21T15:00:00Z',null);`);
    const report = await json(`select public.lead_engine_score_report('${owner}');`);
    assert.equal(report.total.dials, 4); assert.equal(report.total.reached_owner, 1); assert.equal(Number(report.total.reached_rate), 0.25);
    const bucket2 = report.by_bucket.find(item => item.key === '2'); assert.equal(bucket2.dials, 2); assert.equal(bucket2.reached_owner, 1); assert.equal(Number(bucket2.reached_rate), 0.5); assert.equal(bucket2.gatekeeper, 1);
    assert.equal(report.by_bucket.find(item => item.key === 'none').bad_number, 1);
    assert.deepEqual(report.by_recipe.map(item => item.key), ['D']);
    assert.deepEqual(report.by_source.map(item => item.key), ['fl_dbpr', 'google_maps']);
    assert.deepEqual(report.by_state.map(item => [item.key, item.dials]), [['FL', 3], ['GA', 1]]);
    assert.equal(report.total.last_7_days, 4);
    const empty = await json(`select public.lead_engine_score_report('${other}');`);
    assert.equal(empty.total.dials, 0); assert.deepEqual(empty.by_bucket, []); assert.equal(Number(empty.total.reached_rate), 0);
  });
});
