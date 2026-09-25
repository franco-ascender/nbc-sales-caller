// Anas §4 stop-loss and §8 export freshness on real Postgres. Destructive only inside a disposable local DB.
// Run: L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://user@127.0.0.1:54329/nbc_l01_test node --test tests/lead-engine-stoploss-postgres.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const connection = process.env.LEAD_ENGINE_TEST_DATABASE_URL;
const enabled = connection && process.env.L01_SQL_ISOLATED === '1';
function sql(statement) {
  return new Promise((resolve, reject) => {
    const url = new URL(connection);
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
    const child = spawn('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { env: { ...environment, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username) || process.env.USER, PGPASSFILE: '/dev/null' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { errors += part; });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(output.trim()) : reject(Error(errors)));
    child.stdin.end(statement);
  });
}
const json = async statement => JSON.parse(await sql(statement));
const owner = '11111111-1111-4111-8111-111111111111', job = 'eeeeeeee-eeee-4eee-8eee-000000000001';

test('stop-loss: a running job whose spend per delivered cell passes 2x the table is refused by the meter', { skip: !enabled ? 'No isolated PostgreSQL configured.' : false }, async () => {
  assert.equal(new URL(connection).pathname, '/nbc_l01_test');
  assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%';"), '0');
  await sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
    create schema if not exists auth; create table if not exists auth.users(id uuid primary key); insert into auth.users values('${owner}') on conflict do nothing; grant usage on schema public to anon, authenticated, service_role;`);
  for (const file of ['202609140010_lead_engine', '202609210230_lead_engine_memory', '202609210240_lead_engine_jobs', '202609210250_lead_engine_registers', '202609210260_lead_engine_auth_users_read', '202609210270_lead_engine_phase5', '202609210280_lead_engine_stop_loss']) {
    await sql(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8'));
  }
  await sql("update public.lead_engine_control set execution_enabled = true;");
  await json(`select public.lead_engine_grant_credits('${owner}',1000,'t');`);
  const created = await json(`select public.lead_engine_create_job('${owner}','${job}','{"industry":"HVAC","industry_key":"hvac","state":"FL","target_cells":100,"recipe":"A","recipe_version":"A","brain_version":"t","legal_status":"ok","expected_clean":0.2,"credits_per_cell":2}');`);
  assert.equal(created.expected_cost_cents_per_cell, 7, 'recipe A table cost is 7 cents per clean cell');
  await json(`select public.lead_engine_hold_job('${owner}','${job}');`);
  await json(`select public.lead_engine_sample_result('${owner}','${job}','{}',true,null);`);
  // 10 delivered cells for 100 cents spent = 10 cents per cell: under 14, allowed.
  await json(`select public.lead_engine_job_progress('${owner}','${job}','{"delivered":10}');`);
  await json(`select public.lead_engine_meter('${owner}','${job}','batchdata','verify',1,100);`);
  assert.equal((await json(`select public.lead_engine_meter('${owner}','${job}','batchdata','verify',1,30);`)).allowed, true, '130/10 = 13 cents, still under 14');
  const refused = await json(`select public.lead_engine_meter('${owner}','${job}','batchdata','verify',1,20);`);
  assert.equal(refused.allowed, false); assert.equal(refused.reason, 'stop_loss'); assert.equal(refused.delivered, 10); assert.equal(Number(refused.cost_per_cell_cents), 15);
  // Under 10 delivered the rule stays quiet (sample-sized runs are noisy).
  await json(`select public.lead_engine_job_progress('${owner}','${job}','{"delivered":5}');`);
  assert.equal((await json(`select public.lead_engine_meter('${owner}','${job}','batchdata','verify',0,0);`)).allowed, true);
  // Freshness: no ledger rows yet -> nothing stale.
  const fresh = await json(`select public.lead_engine_job_freshness('${owner}','${job}');`);
  assert.equal(fresh.rows, 0); assert.equal(fresh.stale_rows, 0);
});
