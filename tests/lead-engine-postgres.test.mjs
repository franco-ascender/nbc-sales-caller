// Destructive only within an explicitly provided disposable local test database.
// Run: L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://.../nbc_l01_test node --test tests/lead-engine-postgres.test.mjs
// Requires psql and a fresh isolated PostgreSQL cluster/database. Never shared Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const connection = process.env.LEAD_ENGINE_TEST_DATABASE_URL;
const enabled = connection && process.env.L01_SQL_ISOLATED === '1';
function sql(statement, { fail = false } = {}) {
  return new Promise((resolve, reject) => {
    // libpq does not expand a URI in PGDATABASE; pass its fields privately.
    const url = new URL(connection);
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
    const child = spawn('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { env: {
      ...environment, PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username) || process.env.USER,
      PGPASSWORD: decodeURIComponent(url.password), PGPASSFILE: '/dev/null',
    }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { errors += part; });
    child.on('error', reject);
    child.on('close', code => {
      if (fail) { if (code !== 0) resolve(errors); else reject(Error('Expected SQL rejection')); }
      else if (code === 0) resolve(output.trim()); else reject(Error(errors));
    }); child.stdin.end(statement);
  });
}
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const uuid = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const input = JSON.stringify({ industry: 'Roofing', metro: 'Charlotte, NC', target: 1, hardBudgetCents: 1000, exclusions: [] });
function save(n, budget = 1000) { return `select (public.lead_engine_save_plan('${owner}','${uuid(n)}','${input}','A','test',6,${budget})).id;`; }
function batch(n, plan, cents, options = '') {
  return `insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,provider,search_claims,evidence_ref ${options ? ',business_claims' : ''}) values
    ('${uuid(n)}','${uuid(plan)}','${owner}','pilot','prepared',1,${cents},'synthetic','[{"source":"synthetic","query":"roofing ${n}","metro":"charlotte nc"}]','synthetic quote' ${options ? `,'${options}'` : ''});`;
}
function reserve(n, operator = owner) { return `select public.lead_engine_reserve_batch('${operator}','${uuid(n)}')->'batch'->>'status';`; }
function settle(n, outcome, cents) { return `select (public.lead_engine_settle_batch('${owner}','${uuid(n)}','${outcome}',${cents},'synthetic receipt')).status;`; }
test('isolated PostgreSQL: reservation, concurrency, ownership, dedupe, suppression and recovery', { skip: !enabled ? 'No isolated PostgreSQL configured; real atomicity NOT executed.' : false }, async t => {
  const url = new URL(connection);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only a local isolated database is allowed');
  assert.equal(url.pathname, '/nbc_l01_test', 'Use a fresh disposable nbc_l01_test database');
  assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%';"), '0', 'Refuse an already populated L01 database');
  await sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$; create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
  insert into auth.users values('${owner}'),('${other}') on conflict do nothing;
  grant usage on schema public to anon, authenticated, service_role;`);
  await sql(await readFile(new URL('../supabase/migrations/202609140010_lead_engine.sql', import.meta.url), 'utf8'));
  await t.test('RLS, grants and invoker functions deny direct client access', async () => {
    for (const role of ['anon','authenticated']) {
      assert.match(await sql(`set role ${role}; select * from public.lead_engine_plans;`, { fail: true }), /permission denied/);
      assert.match(await sql(`set role ${role}; ${save(1)}`, { fail: true }), /permission denied/);
      assert.match(await sql(`set role ${role}; select * from public.lead_engine_suppressions;`, { fail: true }), /permission denied/);
    }
    assert.equal(await sql("select count(*) from pg_proc where proname like 'lead_engine_%' and prosecdef;"), '0');
    assert.equal(await sql("select count(*) from pg_tables where schemaname='public' and tablename like 'lead_engine_%' and rowsecurity;"), '16');
    assert.equal(await sql(`set role service_role; ${save(1)}`), uuid(1));
  });
  await t.test('plan idempotency, ownership and dry-run without reservations', async () => {
    assert.equal(await sql(save(1)), uuid(1));
    assert.match(await sql(save(1, 999), { fail: true }), /idempotency_conflict/);
    assert.match(await sql(`select public.lead_engine_dry_run('${other}','${uuid(1)}','${uuid(2)}');`, { fail: true }), /plan_not_found/);
    const first = await sql(`select public.lead_engine_dry_run('${owner}','${uuid(1)}','${uuid(2)}');`);
    assert.equal(await sql(`select public.lead_engine_dry_run('${owner}','${uuid(1)}','${uuid(2)}');`), first);
    assert.equal(JSON.parse(first).executionEnabled, false); assert.equal(JSON.parse(first).reservedCents, 0);
    assert.match(await sql(reserve(2), { fail: true }), /invalid_state/);
    assert.equal(await sql('select count(*) from public.lead_engine_searches;'), '0');
  });
  // Synthetic server-side preflight only inside disposable DB. Not evidence of provider integration.
  await sql(`update public.lead_engine_control set execution_enabled=true;
    insert into public.lead_engine_provider_accounts(provider,balance_cents,verified_at,valid_until,evidence_ref)
    values('synthetic',100000,now(),now()+interval '1 hour','synthetic balance');`);
  await t.test('two concurrent sessions cannot overspend the same plan', async () => {
    await sql(save(10, 600) + batch(11,10,400) + batch(12,10,400));
    const outcomes = await Promise.allSettled([sql(`begin; ${reserve(11)} select pg_sleep(0.25); commit;`), sql(reserve(12))]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await sql(`select sum(reserved_cents) from public.lead_engine_batches where plan_id='${uuid(10)}';`), '400');
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id in ('${uuid(11)}','${uuid(12)}');`), '1');
  });
  await t.test('same job concurrent retries reserve and claim exactly once', async () => {
    await sql(save(20) + batch(21,20,100));
    const claims = await Promise.all([sql(`select public.lead_engine_reserve_batch('${owner}','${uuid(21)}');`),sql(`select public.lead_engine_reserve_batch('${owner}','${uuid(21)}');`)]);
    assert.equal(claims.map(value => JSON.parse(value)).filter(value => value.acquired).length, 1);
    assert.deepEqual(claims.map(value => JSON.parse(value).batch.status), ['reserved','reserved']);
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id='${uuid(21)}';`), '1');
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(21)}';`), '100');
    assert.match(await sql(reserve(21, other), { fail: true }), /batch_not_found/);
  });
  await t.test('partial/ambiguous outcomes retain funds, reconcile once, retain claims', async () => {
    assert.equal(await sql(settle(21,'uncertain',0)), 'uncertain');
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(21)}';`), '100');
    assert.equal(await sql(`select status from public.lead_engine_plans where id='${uuid(20)}';`), 'paused');
    assert.equal(await sql(settle(21,'partial',40)), 'partial');
    assert.equal(await sql(settle(21,'partial',40)), 'partial');
    assert.equal(await sql(`select consumed_cents||':'||released_cents from public.lead_engine_costs where batch_id='${uuid(21)}';`), '40:60');
    assert.match(await sql(settle(21,'completed',30), { fail: true }), /invalid_state/);
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id='${uuid(21)}';`), '1');
  });
  const contact = '[{"phone10":"2025550101","nameCity":"fixture roofer charlotte nc","placeId":"fixture-place","sourceUrl":"https://example.com/business"}]';
  await t.test('global suppression blocks other plans before reservation and rolls claims back', async () => {
    await sql(save(30) + batch(31,30,100,contact));
    await sql("insert into public.lead_engine_suppressions(phone10,reason,evidence_ref) values('2025550101','opt_out','synthetic');");
    assert.match(await sql(reserve(31), { fail: true }), /contact_unavailable/);
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(31)}';`), '0');
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id='${uuid(31)}';`), '0');
    assert.match(await sql("delete from public.lead_engine_suppressions where phone10='2025550101';", { fail: true }), /immutable_record/);
  });
  await t.test('search/business uniqueness is global across plans; failed claims never reserve', async () => {
    const clean = contact.replaceAll('2025550101','2025550102');
    await sql(save(40) + batch(41,40,100,clean) + save(42) + batch(43,42,100,clean));
    await sql(reserve(41)); assert.match(await sql(reserve(43), { fail: true }), /claim_unavailable/);
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(43)}';`), '0');
    await sql(save(44) + batch(45,44,100));
    // A prepared batch's quote is immutable; duplicate search is seeded in a new batch.
    await sql(`insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,provider,search_claims,evidence_ref)
      select '${uuid(46)}','${uuid(44)}','${owner}',stage,'prepared',businesses,estimate_cents,provider,search_claims,'synthetic' from public.lead_engine_batches where id='${uuid(41)}';`);
    assert.match(await sql(reserve(46), { fail: true }), /claim_unavailable/);
  });
  await t.test('filtered businesses without a phone stay in the global ledger', async () => {
    await sql(`insert into public.lead_engine_businesses(phone10,disposition,drop_reason,name_city,source_url,batch_id)
      values(null,'filtered','no published phone','filtered shop charlotte nc','https://example.com/shop','${uuid(41)}');`);
    assert.equal(await sql("select count(*) from public.lead_engine_businesses where disposition='filtered' and phone10 is null;"), '1');
  });
  await t.test('a suppression added after a claim blocks delivery without exposing another plan', async () => {
    await sql("insert into public.lead_engine_suppressions(phone10,reason,evidence_ref) values('2025550102','complaint','synthetic');");
    assert.match(await sql(`insert into public.lead_engine_deliveries(phone10,batch_id,plan_id,operator_id,line_type,dnc,tcpa,reachable,verified_at,time_zone,evidence_ref)
      values('2025550102','${uuid(41)}','${uuid(40)}','${owner}','Mobile',false,false,true,now(),'America/New_York','synthetic');`, { fail: true }), /contact_suppressed/);
    assert.equal(await sql('select count(*) from public.lead_engine_deliveries;'), '0');
  });
  await t.test('provider balance is shared atomically between plans', async () => {
    await sql(`insert into public.lead_engine_provider_accounts(provider,balance_cents,verified_at,valid_until,evidence_ref)
      values('shared-fixture',150,now(),now()+interval '1 hour','synthetic');` + save(60) + save(62)
      + batch(61,60,100).replace("'synthetic','[", "'shared-fixture','[") + batch(63,62,100).replace("'synthetic','[", "'shared-fixture','["));
    const outcomes = await Promise.allSettled([sql(reserve(61)),sql(reserve(63))]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await sql("select reserved_cents from public.lead_engine_provider_accounts where provider='shared-fixture';"), '100');
  });
  await t.test('large batch approval, budget projection and stop-loss remain server gates', async () => {
    await sql(save(70,50000));
    assert.match(await sql(`select public.lead_engine_blockers('${uuid(70)}','scale',500,16000,'synthetic',false);`), /large_batch_confirmation_required/);
    await sql(save(71,5));
    assert.match(await sql(`select public.lead_engine_blockers('${uuid(71)}','pilot',1,1,'synthetic',false);`), /forecast_over_budget/);
    assert.match(await sql(`select public.lead_engine_blockers('${uuid(20)}','pilot',1,1,'synthetic',false);`), /stop_loss_triggered/);
  });

  // R3 discovery fixtures: no real provider calls, billing or credentials.
  async function discovery(n) {
    const payload=JSON.stringify({industry:`Roofing ${n}`,metro:'Charlotte, NC',target:50,hardBudgetCents:1000,exclusions:[]});
    await sql(`select public.lead_engine_save_plan('${owner}','${uuid(n)}','${payload}','A','test',200,1000);
      insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,provider,search_claims,evidence_ref)
      values('${uuid(n+1)}','${uuid(n)}','${owner}','pilot','prepared',50,200,'apify','[{"source":"apify","query":"roofing ${n}","metro":"charlotte nc"}]','synthetic quote');
      insert into public.lead_engine_discovery_jobs(batch_id,plan_id,operator_id,actor_id,build_tag,search_term,location,max_results,max_cost_cents,contract_evidence_ref,approved_by,approved_at,valid_until)
      values('${uuid(n+1)}','${uuid(n)}','${owner}','ActorSynthetic123','1.2.3','Roofing ${n}','Charlotte, NC',50,200,'synthetic contract','${owner}',now(),now()+interval '1 hour');`);
  }
  const claimDiscovery = (n, op=owner) => `select public.lead_engine_claim_discovery('${op}','${uuid(n)}');`;
  const observeDiscovery = (n,status='running',run='RunSynthetic12345',dataset='DatasetSynthetic1') =>
    `select public.lead_engine_observe_discovery('${owner}','${uuid(n)}','${run}','${dataset}','ActorSynthetic123','1.2.3','${status}');`;
  await sql(`insert into public.lead_engine_provider_accounts(provider,balance_cents,verified_at,valid_until,evidence_ref)
    values('apify',10000,now(),now()+interval '1 hour','synthetic only');`);
  await t.test('discovery grants deny clients and concurrent claim permits one dispatch with one reservation',async () => {
    await discovery(100);
    for(const role of ['anon','authenticated']) {
      assert.match(await sql(`set role ${role}; select * from public.lead_engine_discovery_jobs;`,{fail:true}),/permission denied/);
      assert.match(await sql(`set role ${role}; ${claimDiscovery(101)}`,{fail:true}),/permission denied/);
    }
    const results=await Promise.all([sql(`set role service_role; ${claimDiscovery(101)}`),sql(`set role service_role; ${claimDiscovery(101)}`)]);
    assert.equal(results.map(JSON.parse).filter(row=>row.acquired).length,1);
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(101)}';`),'200');
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id='${uuid(101)}';`),'1');
    assert.match(await sql(claimDiscovery(101,other),{fail:true}),/batch_not_found/);
  });
  await t.test('discovery persists run identity, rejects substitutions and never regresses terminal observations',async () => {
    assert.equal(JSON.parse(await sql(observeDiscovery(101))).status,'running');
    assert.match(await sql(observeDiscovery(101,'running','AnotherRun1234567'),{fail:true}),/discovery_identity_mismatch/);
    assert.equal(JSON.parse(await sql(observeDiscovery(101,'succeeded'))).status,'succeeded');
    assert.equal(JSON.parse(await sql(observeDiscovery(101,'running'))).status,'succeeded');
    assert.equal(JSON.parse(await sql(claimDiscovery(101))).acquired,false);
    assert.equal(await sql(`select count(*) from public.lead_engine_costs where batch_id='${uuid(101)}';`),'0');
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(101)}';`),'200');
    assert.match(await sql(`update public.lead_engine_discovery_jobs set actor_id='OtherActor1234567' where batch_id='${uuid(101)}';`,{fail:true}),/invalid_state/);
    await discovery(140); await sql(claimDiscovery(141));
    assert.match(await sql(observeDiscovery(141),{fail:true}),/duplicate key/);
    assert.equal(await sql(`select status from public.lead_engine_discovery_jobs where batch_id='${uuid(141)}';`),'dispatching');

  });
  await t.test('uncertain dispatch and failed run retain full reservation, pause plan and cannot re-dispatch',async () => {
    await discovery(110); await sql(claimDiscovery(111));
    assert.equal(JSON.parse(await sql(`select public.lead_engine_uncertain_discovery('${owner}','${uuid(111)}');`)).status,'uncertain');
    assert.equal(JSON.parse(await sql(claimDiscovery(111))).acquired,false);
    assert.equal(await sql(`select reserved_cents||':'||status from public.lead_engine_batches where id='${uuid(111)}';`),'200:uncertain');
    assert.equal(await sql(`select status from public.lead_engine_plans where id='${uuid(110)}';`),'paused');
    await discovery(120); await sql(claimDiscovery(121));
    assert.equal(JSON.parse(await sql(observeDiscovery(121,'failed','FailedRun12345678','FailedData1234567'))).status,'failed');
    assert.equal(await sql(`select reserved_cents||':'||status from public.lead_engine_batches where id='${uuid(121)}';`),'200:uncertain');
  });
  await t.test('stale approvals, inconsistent quote and exhausted budget reject before any discovery dispatch',async () => {
    await discovery(130);
    // Roll back trigger removal and synthetic malformed setup together; do not mutate approved production records.
    assert.match(await sql(`begin; alter table public.lead_engine_discovery_jobs disable trigger lead_engine_discovery_transition;
      update public.lead_engine_discovery_jobs set approved_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where batch_id='${uuid(131)}';
      ${claimDiscovery(131)} rollback;`,{fail:true}),/verified_discovery_contract_required/);
    assert.match(await sql(`begin; alter table public.lead_engine_discovery_jobs disable trigger lead_engine_discovery_transition;
      update public.lead_engine_discovery_jobs set max_cost_cents=201 where batch_id='${uuid(131)}';
      ${claimDiscovery(131)} rollback;`,{fail:true}),/verified_discovery_contract_required/);
    assert.match(await sql(`begin; update public.lead_engine_provider_accounts set balance_cents=reserved_cents+consumed_cents where provider='apify';
      ${claimDiscovery(131)} rollback;`,{fail:true}),/provider_balance_exceeded/);
    assert.equal(await sql(`select status from public.lead_engine_discovery_jobs where batch_id='${uuid(131)}';`),'prepared');
    assert.equal(await sql(`select reserved_cents from public.lead_engine_batches where id='${uuid(131)}';`),'0');
    assert.equal(await sql(`select count(*) from public.lead_engine_searches where batch_id='${uuid(131)}';`),'0');
  });

  const quoteId=uuid(201),folder=uuid(202),foreignFolder=uuid(203);
  const quoteSql=(id=quoteId,count=50,folderId=folder)=>`select public.lead_engine_quote('${owner}','${id}','${uuid(200)}','${folderId}','Roofing pilot',${count});`;
  await sql(`select public.lead_engine_save_plan('${owner}','${uuid(200)}','{"industry":"Roofing 200","metro":"Charlotte, NC","target":50,"hardBudgetCents":1000,"exclusions":[]}','A','test',200,1000);`);
  await t.test('private folders are idempotent, unique by normalized name and isolated by owner',async()=>{
    const create=`select public.lead_engine_save_folder('${owner}','${folder}','Charlotte');`;
    assert.equal(JSON.parse(await sql(create)).id,folder);assert.equal(JSON.parse(await sql(create)).id,folder);
    await sql(`select public.lead_engine_save_folder('${other}','${foreignFolder}','Private folder');`);
    assert.match(await sql(`select public.lead_engine_save_folder('${owner}','${uuid(204)}','charlotte');`,{fail:true}),/folder_name_conflict/);
    assert.match(await sql(`select public.lead_engine_save_folder('${other}','${folder}','Charlotte');`,{fail:true}),/idempotency_conflict/);
    for(const role of ['anon','authenticated']) for(const table of ['folders','quotes','lists','candidates','pricing'])
      assert.match(await sql(`set role ${role};select * from public.lead_engine_${table};`,{fail:true}),/permission denied/);
  });
  await t.test('quotes use verified server pricing; reviewing/canceling does not create a job or reservation',async()=>{
    assert.match(await sql(quoteSql(),{fail:true}),/pricing_pending/);
    await sql(`insert into public.lead_engine_pricing(id,actor_id,build_tag,base_min_cents,base_max_cents,unit_min_millicents,unit_max_millicents,verified_at,valid_until,evidence_ref)
      values('${uuid(205)}','ActorSynthetic123','1.2.3',10,20,1000,1000,now(),now()+interval '1 hour','synthetic tariff only');`);
    const result=JSON.parse(await sql(quoteSql()));assert.equal(result.quote.min_cost_cents,60);assert.equal(result.quote.max_cost_cents,70);
    assert.equal(JSON.parse(await sql(quoteSql())).quote.expires_at,result.quote.expires_at);
    assert.equal(await sql(`select count(*) from public.lead_engine_batches where id='${quoteId}';`),'0');
    assert.match(await sql(quoteSql(quoteId,51),{fail:true}),/idempotency_conflict/);
    assert.match(await sql(quoteSql(uuid(206),50,foreignFolder),{fail:true}),/folder_not_found/);
    assert.match(await sql(`update public.lead_engine_quotes set max_cost_cents=1 where id='${quoteId}';`,{fail:true}),/check constraint|invalid_state/);
  });
  await t.test('expiry and changed budget block approval; repeated approvals create one saved list and one job',async()=>{
    assert.match(await sql(`begin;alter table public.lead_engine_quotes disable trigger lead_engine_quote_transition;update public.lead_engine_quotes set expires_at=now()-interval '1 second' where id='${quoteId}';select public.lead_engine_approve_quote('${owner}','${quoteId}');rollback;`,{fail:true}),/quote_expired/);
    assert.match(await sql(`begin;update public.lead_engine_provider_accounts set balance_cents=reserved_cents+consumed_cents where provider='apify';select public.lead_engine_approve_quote('${owner}','${quoteId}');rollback;`,{fail:true}),/provider_balance_exceeded/);
    assert.match(await sql(`select public.lead_engine_approve_quote('${other}','${quoteId}');`,{fail:true}),/quote_not_found/);
    const outputs=await Promise.all([sql(`select public.lead_engine_approve_quote('${owner}','${quoteId}');`),sql(`select public.lead_engine_approve_quote('${owner}','${quoteId}');`)]);
    assert.deepEqual(outputs,[quoteId,quoteId]);assert.equal(await sql(`select count(*) from public.lead_engine_lists where id='${quoteId}';`),'1');
    assert.equal(await sql(`select count(*) from public.lead_engine_discovery_jobs where batch_id='${quoteId}';`),'1');
    await sql(claimDiscovery(201));
    await sql(observeDiscovery(201,'succeeded','QuotedRun12345678','QuotedData1234567'));
  });
  const candidate={name:'Fixture Roofing',city:'Charlotte',state:'NC',website:'https://example.com',sourceUrl:'https://www.google.com/maps?cid=123',phone10:'2025550133',placeId:'quoted-place',businessKey:'fixture roofing|charlotte|nc',rejection:null};
  const ingest=(offset,total,rows)=>`select public.lead_engine_ingest_page('${owner}','${quoteId}',${offset},${total},'${JSON.stringify(rows)}');`;
  await t.test('ingestion atomically stores page and cursor; replays/concurrent refresh do not duplicate records',async()=>{
    await Promise.all([sql(ingest(0,2,[candidate])),sql(ingest(0,2,[candidate]))]);
    assert.equal(await sql(`select cursor from public.lead_engine_lists where id='${quoteId}';`),'1');
    assert.equal(await sql(`select count(*) from public.lead_engine_candidates where list_id='${quoteId}';`),'1');
    assert.match(await sql(ingest(1,3,[candidate]),{fail:true}),/invalid_dataset/);
    await sql(ingest(1,2,[candidate]));await sql(ingest(1,2,[candidate]));
    assert.equal(await sql(`select cursor||':'||import_status from public.lead_engine_lists where id='${quoteId}';`),'2:complete');
    assert.equal(await sql(`select rejection from public.lead_engine_candidates where list_id='${quoteId}' and position=1;`),'duplicate');
    const records=JSON.parse(await sql(`select public.lead_engine_list_records('${owner}','${quoteId}',0);`));
    assert.equal(records.length,2);assert.equal(records[0].reviewStatus,'verification_pending');assert.equal(JSON.stringify(records).includes('2025550133'),false);
    assert.equal(await sql(`select public.lead_engine_list_records('${other}','${quoteId}',0);`),'[]');
  });
  await t.test('moving a list cannot cross ownership or reset shared suppression/deduplication',async()=>{
    assert.match(await sql(`select public.lead_engine_move_list('${owner}','${quoteId}','${foreignFolder}');`,{fail:true}),/folder_not_found/);
    await sql(`select public.lead_engine_move_list('${owner}','${quoteId}',null);`);
    assert.equal(await sql(`select cursor from public.lead_engine_lists where id='${quoteId}';`),'2');
    await sql(`insert into public.lead_engine_suppressions(phone10,reason,evidence_ref) values('2025550133','opt_out','synthetic');`);
    const records=JSON.parse(await sql(`select public.lead_engine_list_records('${owner}','${quoteId}',0);`));assert.equal(records[0].reviewStatus,'suppressed');
  });
  await t.test('invalid amounts, expired balance, forecast, pilot aggregate and scale approval fail closed', async () => {
    await sql(save(50) + batch(51,50,600) + batch(52,50,600)); await sql(reserve(51));
    assert.match(await sql(reserve(52), { fail: true }), /hard_budget_exceeded|pilot_cap_exceeded/);
    await sql(save(53,2000) + batch(54,53,1001)); assert.match(await sql(reserve(54), { fail: true }), /pilot_cap_exceeded/);
    assert.match(await sql(settle(51,'completed',601), { fail: true }), /invalid_settlement/);
    await sql(`insert into public.lead_engine_batches(id,plan_id,operator_id,stage,status,businesses,estimate_cents,provider)
      values('${uuid(55)}','${uuid(53)}','${owner}','scale','prepared',1,10,'synthetic');`);
    assert.match(await sql(reserve(55), { fail: true }), /approved_measured_pilot_required/);
    await sql("update public.lead_engine_provider_accounts set verified_at=now()-interval '2 hours', valid_until=now()-interval '1 hour';");
    assert.match(await sql(reserve(45), { fail: true }), /balance_check_required/);
    assert.match(await sql(batch(56,53,-1), { fail: true }), /check constraint/);
  });
});
