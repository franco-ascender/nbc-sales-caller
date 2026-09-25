// Phase 0 task 1: the memory tables. Destructive only inside an explicitly provided disposable local database.
// Run: L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://user@127.0.0.1:54329/nbc_l01_test node --test tests/lead-engine-memory-postgres.test.mjs
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

const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const uuid = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const plan = uuid(1), batch = uuid(2), phone = '7045551234';
const input = JSON.stringify({ industry: 'HVAC', metro: 'Tampa, FL', target: 1, hardBudgetCents: 1000, exclusions: [] });

// A delivered number is the precondition of a ledger row. The batch is inserted directly as 'reserved'
// so this file exercises the memory tables, not the reservation chain (covered by the L01 test).
const deliveredFixture = `
  select public.lead_engine_save_plan('${owner}','${plan}','${input}','A','test',6,1000);
  insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,reserved_cents,search_claims,evidence_ref,recipe_version,brain_version)
    values('${batch}','${plan}','${owner}','pilot','reserved',1,50,50,'[]','synthetic quote','A','2026-09-21');
  insert into public.lead_engine_businesses(phone10,name_city,source_url,batch_id) values('${phone}','acme hvac tampa','https://www.google.com/maps/place/?q=place_id:x','${batch}');
  insert into public.lead_engine_deliveries(phone10,batch_id,plan_id,operator_id,line_type,dnc,tcpa,reachable,verified_at,time_zone,evidence_ref)
    values('${phone}','${batch}','${plan}','${owner}','Mobile',false,false,true,now(),'America/New_York','batchdata test');`;

function ledger(overrides = {}) {
  const row = {
    phone10: `'${phone}'`, batch_id: `'${batch}'`, operator_id: `'${owner}'`, recipe: `'A'`,
    verify_vendor: `'batchdata'`, verified_at: 'now()', line_type: `'Mobile'`, dnc_checked_at: 'now()',
    litigator_vendor: `'batchdata'`, litigator_checked_at: 'now()', legal_gate: `'FL: ok'`, tz: `'America/New_York'`,
    features: `'{"state":"FL","industry":"hvac"}'`, ...overrides,
  };
  return `insert into public.lead_engine_row_ledger(${Object.keys(row).join(',')}) values(${Object.values(row).join(',')}) returning id;`;
}

test('memory tables: ledger per delivered row, frozen outcome snapshots, append-only evidence', { skip: !enabled ? 'No isolated PostgreSQL configured; the memory schema was NOT executed.' : false }, async t => {
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
  await sql(await readFile(new URL('../supabase/migrations/202609140010_lead_engine.sql', import.meta.url), 'utf8'));
  await sql(await readFile(new URL('../supabase/migrations/202609210230_lead_engine_memory.sql', import.meta.url), 'utf8'));

  await t.test('seven new tables, all RLS, default deny, no SECURITY DEFINER anywhere', async () => {
    assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%' and rowsecurity;"), '23');
    assert.equal(await sql("select count(*) from pg_proc where proname like 'lead_engine_%' and prosecdef;"), '0');
    for (const role of ['anon', 'authenticated']) {
      assert.match(await sql(`set role ${role}; select * from public.lead_engine_row_ledger;`, { fail: true }), /permission denied/);
      assert.match(await sql(`set role ${role}; select public.lead_engine_record_dial_outcome('${owner}','${uuid(9)}','reached_owner',now(),null);`, { fail: true }), /permission denied/);
    }
  });

  let ledgerId = '';
  await t.test('a ledger row needs a matching delivery, a fresh scrub, a real zone and the 8pm window', async () => {
    assert.match(await sql(ledger(), { fail: true }), /ledger_delivery_mismatch|violates foreign key/, 'no delivery yet, no ledger');
    await sql(deliveredFixture);
    assert.match(await sql(ledger({ dnc_checked_at: "now() - interval '40 days'" }), { fail: true }), /ledger_scrub_stale/);
    assert.match(await sql(ledger({ tz: "'Mars/Phobos'" }), { fail: true }), /ledger_timezone_invalid/);
    assert.match(await sql(ledger({ dial_window_end_local: "'21:00'" }), { fail: true }), /violates check constraint/, 'the 8pm cap is a schema rule, not a convention');
    assert.match(await sql(ledger({ recipe: "'Z'" }), { fail: true }), /violates check constraint/);
    ledgerId = await sql(`set role service_role; ${ledger()}`);
    assert.match(ledgerId, /^[0-9a-f-]{36}$/);
    assert.match(await sql(ledger(), { fail: true }), /duplicate key|unique/, 'one ledger row per delivered number');
    assert.match(await sql(`update public.lead_engine_row_ledger set legal_gate='changed' where id='${ledgerId}';`, { fail: true }), /immutable_record/);
    assert.match(await sql(`delete from public.lead_engine_row_ledger where id='${ledgerId}';`, { fail: true }), /immutable_record/);
  });

  await t.test('outcomes freeze the snapshot, derive local time from the ledger zone, and suppress opt-outs', async () => {
    const call = (op, outcome, at, notes = 'null') => `select public.lead_engine_record_dial_outcome('${op}','${ledgerId}','${outcome}','${at}'::timestamptz,${notes});`;
    assert.match(await sql(call(other, 'reached_owner', '2026-09-15T18:30:00Z'), { fail: true }), /ledger_not_found/, 'another operator cannot post against my row');
    assert.match(await sql(call(owner, 'answered', '2026-09-15T18:30:00Z'), { fail: true }), /invalid_outcome/);
    assert.match(await sql(call(owner, 'reached_owner', '2030-01-01T00:00:00Z'), { fail: true }), /invalid_dial_time/);
    assert.match(await sql(call(owner, 'reached_owner', '2020-01-01T00:00:00Z'), { fail: true }), /invalid_dial_time/, 'a dial older than the scrub window is not against this delivery');
    const inWindow = JSON.parse(await sql(`set role service_role; ${call(owner, 'reached_owner', '2026-09-15T18:30:00Z', "'spoke to Mike'")}`));
    assert.equal(inWindow.dialed_at_local, '14:30:00', '18:30 UTC is 14:30 in New York in September');
    assert.equal(inWindow.local_hour, 14);
    assert.equal(inWindow.within_dial_window, true);
    assert.equal(inWindow.features_snapshot.recipe, 'A');
    assert.equal(inWindow.features_snapshot.industry, 'hvac', 'delivery-time features travel into the snapshot');
    assert.equal(inWindow.features_snapshot.tz, 'America/New_York');
    const late = JSON.parse(await sql(call(owner, 'voicemail', '2026-09-16T01:30:00Z')));
    assert.equal(late.dialed_at_local, '21:30:00');
    assert.equal(late.within_dial_window, false, 'a 9:30pm dial is recorded and flagged, never hidden');
    assert.equal(await sql(`select count(*) from public.lead_engine_suppressions where phone10='${phone}';`), '0');
    await sql(call(owner, 'opt_out', '2026-09-16T15:00:00Z'));
    assert.equal(await sql(`select reason from public.lead_engine_suppressions where phone10='${phone}';`), 'opt_out', 'opt-out suppresses globally and permanently, in the same transaction');
    await sql(call(owner, 'wrong_number', '2026-09-16T15:05:00Z'));
    assert.equal(await sql(`select count(*) from public.lead_engine_suppressions where phone10='${phone}';`), '1', 'a second suppression reason never errors or overwrites');
    assert.equal(await sql(`select count(*) from public.lead_engine_dial_outcomes where ledger_id='${ledgerId}';`), '4');
    assert.match(await sql(`update public.lead_engine_dial_outcomes set outcome='reached_owner';`, { fail: true }), /immutable_record/);
  });

  await t.test('register snapshots and graph edges are append-only; verified and names are idempotent caches', async () => {
    const hash = 'a'.repeat(64);
    await sql(`insert into public.lead_engine_register_snapshots(source,snapshot_date,row_key,row_hash,payload) values('wa_lni','2026-09-21','LIC1','${hash}','{"phonenumber":"5095551234"}');`);
    assert.match(await sql(`insert into public.lead_engine_register_snapshots(source,snapshot_date,row_key,row_hash,payload) values('wa_lni','2026-09-21','LIC1','${hash}','{}');`, { fail: true }), /duplicate key/);
    await sql(`insert into public.lead_engine_register_snapshots(source,snapshot_date,row_key,row_hash,payload) values('wa_lni','2026-09-22','LIC1','${'b'.repeat(64)}','{"phonenumber":"5095559999"}');`);
    assert.equal(await sql(`select count(distinct snapshot_date) from public.lead_engine_register_snapshots where source='wa_lni' and row_key='LIC1';`), '2', 'a changed row is a second snapshot, not an overwrite');
    assert.match(await sql(`update public.lead_engine_register_snapshots set payload='{}';`, { fail: true }), /immutable_record/);
    await sql(`insert into public.lead_engine_entity_graph_edges(from_type,from_id,to_type,to_id,relation,source) values('person','SHEFLO HARVEY B','license','CSLB:12345','sole_owner_of','cslb');`);
    assert.match(await sql(`delete from public.lead_engine_entity_graph_edges;`, { fail: true }), /immutable_record/);
    assert.match(await sql(`insert into public.lead_engine_entity_graph_edges(from_type,from_id,to_type,to_id,relation,source) values('alien','x','license','y','r','s');`, { fail: true }), /violates check constraint/);
    await sql(`insert into public.lead_engine_verified(phone10,line_type,dnc,tcpa,reachable,vendor,verified_at) values('${phone}','Mobile',false,false,true,'batchdata',now());`);
    assert.equal(await sql(`select public.lead_engine_verified_fresh('${phone}');`), 't');
    await sql(`update public.lead_engine_verified set verified_at=now() - interval '40 days' where phone10='${phone}';`);
    assert.equal(await sql(`select public.lead_engine_verified_fresh('${phone}');`), 'f', 'a 40 day old verification is stale');
    assert.equal(await sql(`select public.lead_engine_verified_fresh('7045550000');`), 'f');
    await sql(`insert into public.lead_engine_names(source,source_row_id,first_name,last_name,company,title_code,state,phone10) values('cslb','12345','Harvey','Sheflo','SHEFLO PLUMBING CO','Sole Owner','CA','8189918475');`);
    await sql(`insert into public.lead_engine_names(source,source_row_id,first_name,last_name,state,phone10) values('cslb','12345','Harvey','Sheflo','CA','8189918475')
      on conflict (source,source_row_id) do update set reuse_count=public.lead_engine_names.reuse_count+1;`);
    assert.equal(await sql(`select count(*)||':'||max(reuse_count) from public.lead_engine_names where source='cslb';`), '1:1', 'the same register row ingested twice is one row');
    assert.match(await sql(`insert into public.lead_engine_names(source,source_row_id,state) values('x','1','California');`, { fail: true }), /violates check constraint/);
  });

  await t.test('jobs carry the recipe and brain versions that produced them', async () => {
    assert.equal(await sql(`select recipe_version||'/'||brain_version from public.lead_engine_batches where id='${batch}';`), 'A/2026-09-21');
  });
});
