// Phase 0 tasks 2-4: credits ledger, job state machine and meter. Destructive only inside an explicitly
// provided disposable local database.
// Run: L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://user@127.0.0.1:54329/nbc_l01_test node --test tests/lead-engine-jobs-postgres.test.mjs
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
const uuid = n => `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, '0')}`;
const job1 = uuid(1), job2 = uuid(2), job3 = uuid(3);
const input = (overrides = {}) => JSON.stringify({
  industry: 'HVAC', industry_key: 'hvac', state: 'FL', target_cells: 10, dnc_mode: 'strict', recipe: 'A', recipe_version: 'A',
  brain_version: '2026-09-21.1', legal_status: 'ok', legal_note: null, expected_clean: 0.2, credits_per_cell: 2, credit_cents: 10, cap_ratio: 0.6, ...overrides,
});
const meter = (job, cents = 7, vendor = 'batchdata', step = 'verify', who = owner) =>
  json(`select public.lead_engine_meter('${who}','${job}','${vendor}','${step}',1,${cents});`);

test('jobs: credits held at quote, meter stops at the cap with a clean ledger, freeze/resume, settle on delivered cells only',
  { skip: !enabled ? 'No isolated PostgreSQL configured; the jobs schema was NOT executed.' : false }, async t => {
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
  for (const file of ['202609140010_lead_engine.sql', '202609210230_lead_engine_memory.sql', '202609210240_lead_engine_jobs.sql']) {
    await sql(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await sql("update public.lead_engine_control set execution_enabled = true where scope = 'nbc-internal';");

  await t.test('schema: 29 RLS tables, no SECURITY DEFINER, anon and authenticated locked out', async () => {
    assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%' and rowsecurity;"), '29');
    assert.equal(await sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lead_engine_%' and p.prosecdef;"), '0');
    assert.equal(await sql("select count(*) from information_schema.role_table_grants where table_name in ('lead_engine_jobs','lead_engine_credits_ledger','lead_engine_job_spend') and grantee in ('anon','authenticated');"), '0');
    assert.equal(await sql("select count(*) from information_schema.role_routine_grants where routine_name = 'lead_engine_meter' and grantee in ('anon','authenticated','PUBLIC');"), '0');
  });

  await t.test('credits: grant, quote, hold; cap is credits x $0.10 x 0.6 and the batch opens reserved', async () => {
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 0, held: 0 });
    assert.deepEqual(await json(`select public.lead_engine_grant_credits('${owner}',100,'internal top up');`), { available: 100, held: 0 });
    const quoted = await json(`select public.lead_engine_create_job('${owner}','${job1}','${input()}');`);
    assert.equal(quoted.status, 'quoted'); assert.equal(quoted.credits_quoted, 20); assert.equal(quoted.credits_held, 0);
    // Replay with the same id returns the same job; another operator cannot see it.
    assert.equal((await json(`select public.lead_engine_create_job('${owner}','${job1}','${input({ target_cells: 99 })}');`)).credits_quoted, 20);
    assert.match(await sql(`select public.lead_engine_create_job('${other}','${job1}','${input()}');`, { fail: true }), /job_not_found/);
    assert.match(await sql(`select public.lead_engine_create_job('${owner}','${uuid(9)}','${input({ legal_status: 'prohibited', state: 'SC', recipe: 'C' })}');`, { fail: true }), /legal_prohibited/);
    const held = await json(`select public.lead_engine_hold_job('${owner}','${job1}');`);
    assert.equal(held.status, 'sample_running'); assert.equal(held.credits_held, 20); assert.equal(held.cap_cents, 120);
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 80, held: 20 });
    assert.equal(await sql(`select status || ':' || estimate_cents || ':' || reserved_cents from public.lead_engine_batches where id = '${held.batch_id}';`), 'reserved:120:120');
    assert.equal(await sql(`select lane from public.lead_engine_plans where id = '${held.plan_id}';`), 'A');
    // Holding twice is a no-op, not a second hold.
    assert.equal((await json(`select public.lead_engine_hold_job('${owner}','${job1}');`)).credits_held, 20);
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 80, held: 20 });
  });

  await t.test('meter acceptance: a $1.00 cap stops at $1.00, the ledger equals the spend, denied calls leave no trace', async () => {
    // 20 credits x 10 cents x 0.5 = exactly 100 cents.
    await json(`select public.lead_engine_create_job('${owner}','${job2}','${input({ cap_ratio: 0.5 })}');`);
    const held = await json(`select public.lead_engine_hold_job('${owner}','${job2}');`);
    assert.equal(held.cap_cents, 100);
    let allowed = 0, denied = null;
    for (let i = 0; i < 20; i++) {
      const decision = await meter(job2);
      if (decision.allowed) { allowed++; assert.ok(decision.spend_id); continue; }
      denied = decision; break;
    }
    assert.equal(allowed, 14, '14 x 7 cents = 98 cents fit under $1.00');
    assert.equal(denied.reason, 'cap'); assert.equal(denied.remaining_cents, 2); assert.equal(denied.requested_cents, 7);
    assert.equal(await sql(`select spent_cents from public.lead_engine_jobs where id = '${job2}';`), '98');
    assert.equal(await sql(`select count(*) || ':' || sum(cents) from public.lead_engine_job_spend where job_id = '${job2}';`), '14:98');
    // A second denied call costs nothing either.
    assert.equal((await meter(job2)).allowed, false);
    assert.equal(await sql(`select count(*) from public.lead_engine_job_spend where job_id = '${job2}';`), '14');
    // A 2-cent call still fits; then the job is at the cap exactly.
    assert.equal((await meter(job2, 2)).allowed, true);
    assert.equal(await sql(`select spent_cents || '/' || cap_cents from public.lead_engine_jobs where id = '${job2}';`), '100/100');
    // units = 0 is a pure check: it answers but records nothing.
    const probe = await json(`select public.lead_engine_meter('${owner}','${job2}','batchdata','verify',0,0);`);
    assert.equal(probe.allowed, true); assert.equal(probe.reason, 'check_only'); assert.equal(probe.spend_id, null);
    assert.equal(await sql(`select count(*) from public.lead_engine_job_spend where job_id = '${job2}';`), '15');
    assert.match(await sql(`select public.lead_engine_meter('${owner}','${job2}','batchdata','verify',-1,7);`, { fail: true }), /invalid_charge/);
    assert.match(await sql(`select public.lead_engine_meter('${owner}','${job2}','zapier','verify',1,7);`, { fail: true }), /unknown_vendor/);
    assert.match(await sql(`select public.lead_engine_meter('${other}','${job2}','batchdata','verify',1,7);`, { fail: true }), /job_not_found/);
  });

  await t.test('meter: execution switch and the vendor daily ceiling both stop spend before it happens', async () => {
    await sql("update public.lead_engine_control set execution_enabled = false;");
    assert.equal((await meter(job1)).reason, 'execution_disabled');
    await sql("update public.lead_engine_control set execution_enabled = true;");
    await sql("update public.lead_engine_daily_ceilings set ceiling_cents = 110, alert_cents = 105 where vendor = 'batchdata';");
    // batchdata already spent 100 today on job2; 7 more fits (107 >= alert), 7 after that does not.
    const first = await meter(job1);
    assert.equal(first.allowed, true); assert.equal(first.alert, true); assert.equal(first.vendor_today_cents, 107);
    const second = await meter(job1);
    assert.equal(second.reason, 'daily_ceiling'); assert.equal(second.vendor_today_cents, 107); assert.equal(second.ceiling_cents, 110);
    // Another vendor is unaffected.
    assert.equal((await meter(job1, 4, 'apify', 'scrape')).allowed, true);
    await sql("update public.lead_engine_daily_ceilings set ceiling_cents = 5000, alert_cents = 4000 where vendor = 'batchdata';");
    assert.equal(await sql(`select spent_cents from public.lead_engine_jobs where id = '${job1}';`), '11');
  });

  await t.test('sample gate: pass goes to running; fail refunds the whole hold and closes the batch as failed', async () => {
    const running = await json(`select public.lead_engine_sample_result('${owner}','${job1}','{"businesses":100,"clean":22,"expected":0.2}',true,null);`);
    assert.equal(running.status, 'running'); assert.equal(running.sample.clean, 22);
    assert.equal(await sql(`select string_agg(from_status || '>' || to_status, ',' order by id) from public.lead_engine_job_transitions where job_id = '${job1}';`),
      'draft>quoted,quoted>sample_running,sample_running>sample_done,sample_done>running');
    await json(`select public.lead_engine_create_job('${owner}','${job3}','${input({ industry: 'Roofing', industry_key: 'roofing', target_cells: 5 })}');`);
    const held = await json(`select public.lead_engine_hold_job('${owner}','${job3}');`);
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 50, held: 50 });
    await meter(job3, 5, 'apify', 'scrape');
    const failed = await json(`select public.lead_engine_sample_result('${owner}','${job3}','{"businesses":100,"clean":3,"expected":0.2}',false,'sample_below_expected: 3% vs 20%');`);
    assert.equal(failed.status, 'needs_attention'); assert.equal(failed.credits_held, 0); assert.match(failed.attention_reason, /3% vs 20%/);
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 60, held: 40 });
    assert.equal(await sql(`select status || ':' || consumed_cents || ':' || reserved_cents from public.lead_engine_batches where id = '${held.batch_id}';`), 'failed:5:0');
    assert.equal(await sql(`select outcome || ':' || consumed_cents || ':' || released_cents from public.lead_engine_costs where batch_id = '${held.batch_id}';`), 'failed:5:55');
    assert.match(await sql(`select public.lead_engine_resume_job('${owner}','${job3}',0);`, { fail: true }), /not_resumable/);
    assert.match(await sql(`select public.lead_engine_sample_result('${owner}','${job1}','{}',true,null);`, { fail: true }), /invalid_job_transition/);
  });

  await t.test('freeze and resume: nothing dies; the hold stays, the cap can grow, the meter refuses a frozen job', async () => {
    const frozen = await json(`select public.lead_engine_freeze_job('${owner}','${job1}','HTTP 500 from batchdata: {"status":"error"}');`);
    assert.equal(frozen.status, 'needs_attention'); assert.equal(frozen.resume_from, 'running'); assert.equal(frozen.credits_held, 20);
    assert.equal((await meter(job1)).reason, 'job_not_running');
    assert.equal((await json(`select public.lead_engine_freeze_job('${owner}','${job1}','again');`)).attention_reason, 'HTTP 500 from batchdata: {"status":"error"}');
    assert.match(await sql(`select public.lead_engine_resume_job('${owner}','${job1}',1000);`, { fail: true }), /insufficient_credits/);
    const resumed = await json(`select public.lead_engine_resume_job('${owner}','${job1}',10);`);
    assert.equal(resumed.status, 'running'); assert.equal(resumed.credits_held, 30); assert.equal(resumed.cap_cents, 180); assert.equal(resumed.attention_reason, null);
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 50, held: 50 });
    assert.equal((await meter(job1)).allowed, true);
    // A job frozen during its sample resumes into the sample, not into the run.
    assert.equal((await json(`select public.lead_engine_freeze_job('${owner}','${job2}','cap reached during sample');`)).resume_from, 'sample_running');
    await json(`select public.lead_engine_create_job('${owner}','${uuid(5)}','${input()}');`);
    assert.match(await sql(`select public.lead_engine_freeze_job('${owner}','${uuid(5)}','x');`, { fail: true }), /invalid_job_transition/);
  });

  await t.test('deliver: settle only delivered cells, release the rest, ledger row and dial outcome close the loop', async () => {
    const job = await json(`select to_jsonb(j) from public.lead_engine_jobs j where id = '${job1}';`);
    await json(`select public.lead_engine_job_progress('${owner}','${job1}','{"scraped":100,"verified":40}');`);
    for (const phone of ['7045551234', '8135551234']) {
      await sql(`insert into public.lead_engine_businesses(phone10,name_city,source_url,batch_id) values('${phone}','acme ${phone}','https://www.google.com/maps/place/?q=place_id:${phone}','${job.batch_id}');
        insert into public.lead_engine_deliveries(phone10,batch_id,plan_id,operator_id,line_type,dnc,tcpa,reachable,verified_at,time_zone,evidence_ref)
          values('${phone}','${job.batch_id}','${job.plan_id}','${owner}','Mobile',false,false,true,now(),'America/New_York','batchdata test');
        insert into public.lead_engine_row_ledger(phone10,batch_id,operator_id,recipe,verify_vendor,verified_at,line_type,dnc_checked_at,litigator_vendor,litigator_checked_at,legal_gate,tz,features)
          values('${phone}','${job.batch_id}','${owner}','A','batchdata',now(),'Mobile',now(),'batchdata',now(),'FL: ok','America/New_York','{"industry":"hvac","state":"FL"}');`);
    }
    const delivered = await json(`select public.lead_engine_deliver_job('${owner}','${job1}',2,0);`);
    assert.equal(delivered.status, 'delivered'); assert.equal(delivered.credits_settled, 4); assert.equal(delivered.credits_held, 0); assert.equal(delivered.delivered_count, 2);
    assert.equal(delivered.progress.scraped, 100);
    // 100 granted, 4 settled on job1, 20 still held by job2 (frozen at its cap): available 76.
    assert.deepEqual(await json(`select public.lead_engine_credit_balance('${owner}');`), { available: 76, held: 20 });
    assert.equal(await sql(`select status || ':' || consumed_cents || ':' || delivered_count from public.lead_engine_batches where id = '${job.batch_id}';`), 'partial:18:2');
    assert.equal(await sql(`select string_agg(kind || ':' || credits, ',' order by seq) from public.lead_engine_credits_ledger where job_id = '${job1}';`), 'hold:20,hold:10,settle:4,release:26');
    // Delivering again is idempotent; a dial outcome lands against the ledger row and an opt-out suppresses.
    assert.equal((await json(`select public.lead_engine_deliver_job('${owner}','${job1}',2,0);`)).credits_settled, 4);
    const ledger = await sql(`select id from public.lead_engine_row_ledger where phone10 = '7045551234';`);
    const outcome = await json(`select public.lead_engine_record_dial_outcome('${owner}','${ledger}','opt_out','2026-09-21T15:00:00Z','asked not to be called');`);
    assert.equal(outcome.outcome, 'opt_out');
    assert.equal(await sql("select reason from public.lead_engine_suppressions where phone10 = '7045551234';"), 'opt_out');
    // Flag mode bills DNC rows at half rate: 3 clean + 2 flagged x 2 credits = 6 + 2 = 8.
    await json(`select public.lead_engine_grant_credits('${owner}',100,'more');`);
    const flagJob = uuid(4);
    await json(`select public.lead_engine_create_job('${owner}','${flagJob}','${input({ dnc_mode: 'flag' })}');`);
    await json(`select public.lead_engine_hold_job('${owner}','${flagJob}');`);
    await json(`select public.lead_engine_sample_result('${owner}','${flagJob}','{}',true,null);`);
    assert.equal((await json(`select public.lead_engine_deliver_job('${owner}','${flagJob}',3,2);`)).credits_settled, 8);
  });

  await t.test('append-only: ledger, spend and transitions refuse update and delete', async () => {
    for (const table of ['lead_engine_credits_ledger', 'lead_engine_job_spend', 'lead_engine_job_transitions']) {
      assert.match(await sql(`update public.${table} set created_at = now() where true;`, { fail: true }), /immutable_record/, table);
      assert.match(await sql(`delete from public.${table} where true;`, { fail: true }), /immutable_record/, table);
    }
    assert.match(await sql(`update public.lead_engine_jobs set status = 'draft' where id = '${job1}';`, { fail: true }), /invalid_job_transition/);
    assert.equal(await sql(`select count(*) from public.lead_engine_job_transitions;`), '19');
  });
});
