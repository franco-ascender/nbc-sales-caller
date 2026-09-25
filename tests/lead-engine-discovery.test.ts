import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createApifyDiscoveryProvider } from '../src/services/lead-engine-apify.ts';
import { createDiscoveryStore } from '../src/services/lead-engine-discovery-store.ts';
import { createDiscoveryWorker } from '../src/services/lead-engine-discovery.ts';
import { assertDiscoveryJob, parseDiscoveryObservation } from '../src/lib/lead-engine-discovery.ts';
import type { DiscoveryJob, DiscoveryObservation, DiscoveryProvider, DiscoveryStore } from '../src/lib/lead-engine-discovery.ts';
const owner = '11111111-1111-4111-8111-111111111111', batch = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const job: DiscoveryJob = { batchId: batch, planId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002', operatorId: owner,
  actorId: 'ActorSynthetic123', build: '1.2.3', searchTerm: 'Roofing', location: 'Charlotte, NC',
  maxResults: 50, maxCostCents: 200, status: 'prepared', runId: null, datasetId: null };
const observation: DiscoveryObservation = { actorId: job.actorId, build: job.build, runId: 'RunSynthetic12345', datasetId: 'DatasetSynthetic1', status: 'running' };
const wire = (status = 'RUNNING') => ({ data: { id: observation.runId, actId: job.actorId, buildNumber: job.build,
  defaultDatasetId: observation.datasetId, status, usageTotalUsd: 12345, userId: 'private-never-return', statusMessage: 'private-never-return' } });
// Fixture only: simulates the RPC contract. It does NOT validate PostgreSQL locks or transactions.
function memoryStore() {
  let current = structuredClone(job); let starts = 0; let polls = 0;
  const store: DiscoveryStore = {
    async get(op) { if (op !== owner) throw Error('not_found'); return structuredClone(current); },
    async claim(op) {
      if (op !== owner) throw Error('not_found');
      const acquired = current.status === 'prepared'; if (acquired) current.status = 'dispatching';
      return { job: structuredClone(current), acquired };
    },
    async observe(_op, _batch, result) {
      current = { ...current, status: result.status, runId: result.runId, datasetId: result.datasetId }; return structuredClone(current);
    },
    async uncertain() { current.status = 'uncertain'; return structuredClone(current); },
  };
  const provider: DiscoveryProvider = { async start() { starts++; return observation; }, async poll() { polls++; return { ...observation, status: 'succeeded' }; } };
  return { store, provider, counts: () => ({ starts, polls }), current: () => current };
}
test('dispatch replays only consume a newly acquired SQL contract; polling never starts a second run (fixture)', async () => {
  const f = memoryStore(), worker = createDiscoveryWorker(f.store, f.provider);
  await Promise.all([worker.start(owner,batch), worker.start(owner,batch)]);
  await worker.start(owner,batch);
  assert.equal(f.counts().starts, 1);
  assert.equal((await worker.sync(owner,batch)).status, 'succeeded');
  assert.equal((await worker.sync(owner,batch)).status, 'succeeded');
  assert.deepEqual(f.counts(), { starts: 1, polls: 1 });
});
test('lost POST response is uncertain; retries preserve original dispatch identity without further consumption', async () => {
  const f = memoryStore(); let attempts = 0;
  f.provider.start = async () => { attempts++; throw Error('lost-secret-response'); };
  const worker = createDiscoveryWorker(f.store,f.provider);
  await assert.rejects(worker.start(owner,batch), error => error instanceof Error && !error.message.includes('secret'));
  assert.equal((await worker.start(owner,batch)).status, 'uncertain'); assert.equal(attempts, 1);
  assert.equal((await worker.sync(owner,batch)).status, 'uncertain'); assert.equal(f.counts().polls, 0);
});
test('lost claim commit, failed checkpoint and unavailable recovery DB never cause automatic POST retry', async () => {
  const a = memoryStore(); const claim = a.store.claim;
  a.store.claim = async (op,id) => { await claim(op,id); throw Error('commit response lost'); };
  await assert.rejects(createDiscoveryWorker(a.store,a.provider).start(owner,batch)); assert.equal(a.counts().starts, 0);
  a.store.claim = claim;
  assert.equal((await createDiscoveryWorker(a.store,a.provider).start(owner,batch)).status, 'dispatching');
  const b = memoryStore();
  b.store.observe = async () => { throw Error('database down'); }; b.store.uncertain = async () => { throw Error('database down'); };
  const worker = createDiscoveryWorker(b.store,b.provider);
  await assert.rejects(worker.start(owner,batch));
  assert.equal((await worker.start(owner,batch)).status, 'dispatching'); assert.equal(b.counts().starts, 1);
});
test('known-run GET failure is retryable and cannot release a reservation or start a new run', async () => {
  const f = memoryStore(), worker = createDiscoveryWorker(f.store,f.provider); await worker.start(owner,batch);
  f.provider.poll = async () => { throw Error('temporary outage'); };
  await assert.rejects(worker.sync(owner,batch)); assert.equal(f.current().status,'running');
  f.provider.poll = async () => ({...observation,status:'succeeded'});
  assert.equal((await worker.sync(owner,batch)).status,'succeeded'); assert.equal(f.counts().starts,1);
});
test('invalid identities, ownership and malformed persisted jobs prevent provider calls', async () => {
  const f = memoryStore(), worker = createDiscoveryWorker(f.store,f.provider);
  await assert.rejects(worker.start('bad',batch)); await assert.rejects(worker.start('22222222-2222-4222-8222-222222222222',batch));
  for (const change of [{maxCostCents:0},{maxCostCents:1001},{maxResults:301},{build:'latest'},{actorId:'../admin'},{location:'\n'}, {status:'running',runId:null}]) {
    assert.throws(() => assertDiscoveryJob({...job,...change} as DiscoveryJob,owner,batch));
  }
  f.store.claim = async () => ({ job: {...job,operatorId:'22222222-2222-4222-8222-222222222222',status:'dispatching'}, acquired:true });
  await assert.rejects(worker.start(owner,batch)); assert.equal(f.counts().starts,0);
});
test('Apify transport fixes cap, build, source input and disabled add-ons; secrets only in header; no retries', async () => {
  const calls: Array<{url:URL; options:RequestInit}> = [];
  const provider = createApifyDiscoveryProvider('synthetic-private-token',async (input,options) => {
    calls.push({url:new URL(String(input)),options:options!}); return Response.json(wire());
  });
  const started = await provider.start({...job,status:'dispatching'});
  assert.equal(calls.length,1); const {url,options} = calls[0];
  assert.equal(url.origin,'https://api.apify.com'); assert.equal(url.pathname,`/v2/acts/${job.actorId}/runs`);
  assert.equal(url.searchParams.get('maxTotalChargeUsd'),'2.00'); assert.equal(url.searchParams.get('restartOnError'),'false');
  assert.equal(url.searchParams.get('build'),'1.2.3'); assert.equal(url.searchParams.has('token'),false);
  assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store'); assert.ok(options.signal);
  assert.equal((options.headers as Record<string,string>).Authorization,'Bearer synthetic-private-token');
  assert.deepEqual(JSON.parse(String(options.body)),{searchStringsArray:['Roofing'],locationQuery:'Charlotte, NC',maxCrawledPlacesPerSearch:50,
    language:'en',scrapeContacts:false,maxReviews:0,scrapeReviewsPersonalData:false,maxImages:0});
  assert.deepEqual(started,observation); assert.equal(JSON.stringify(started).includes('private'),false);
  await provider.poll({...job,status:'running',runId:started.runId,datasetId:started.datasetId});
  assert.equal(calls[1].options.method,'GET'); assert.equal(calls[1].url.pathname,`/v2/actor-runs/${started.runId}`);
  await assert.rejects(provider.start(job)); assert.equal(calls.length,2);
});
test('provider malformed, oversized, HTTP failures and redirects fail closed with sanitized error', async () => {
  for (const response of [new Response('private',{status:401}),new Response('private',{status:429}),new Response('private',{status:500}),
    new Response('private',{status:302,headers:{location:'https://example.com'}}),new Response('{'),Response.json({data:{...wire().data,actId:'different'}}),
    new Response('x'.repeat(262145))]) {
    let count = 0; const provider = createApifyDiscoveryProvider('synthetic',async () => {count++; return response;});
    await assert.rejects(provider.start({...job,status:'dispatching'}),error => error instanceof Error && !error.message.includes('private'));
    assert.equal(count,1);
  }
});
test('run identity, dataset, build and unknown status cannot masquerade as successful discovery', () => {
  const existing = {...job,status:'running' as const,runId:observation.runId,datasetId:observation.datasetId};
  for (const change of [{id:'AnotherRun1234567'},{defaultDatasetId:'AnotherData123456'},{buildNumber:'1.2.4'},{status:'UNKNOWN'},{defaultDatasetId:null}]) {
    assert.throws(() => parseDiscoveryObservation({data:{...wire().data,...change}},existing));
  }
  for (const state of ['FAILED','ABORTED','TIMED-OUT']) assert.equal(parseDiscoveryObservation(wire(state),existing).status,'failed');
  assert.equal(parseDiscoveryObservation(wire('SUCCEEDED'),existing).status,'succeeded');
  assert.equal('consumedCents' in parseDiscoveryObservation(wire('SUCCEEDED'),existing),false);
});
test('Supabase store uses atomic claim RPC and ownership-filtered reads; missing migration remains pending', async () => {
  const paths: URL[]=[]; const bodies: Record<string,unknown>[]=[];
  const row = {batch_id:batch,plan_id:job.planId,operator_id:owner,actor_id:job.actorId,build_tag:job.build,search_term:job.searchTerm,
    location:job.location,max_results:job.maxResults,max_cost_cents:job.maxCostCents,status:'dispatching',run_id:null,dataset_id:null};
  const db = createClient('http://127.0.0.1:1','synthetic',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (input,init) => {
    const url=new URL(String(input)); paths.push(url); if(init?.body) bodies.push(JSON.parse(String(init.body)));
    if(url.pathname.endsWith('/rpc/lead_engine_claim_discovery')) return Response.json({job:row,acquired:true});
    return Response.json(row);
  }}});
  const store=createDiscoveryStore(db); assert.equal((await store.claim(owner,batch)).acquired,true);
  assert.deepEqual(bodies[0],{p_operator:owner,p_batch:batch}); await store.get(owner,batch);
  assert.equal(paths[1].searchParams.get('operator_id'),`eq.${owner}`); assert.equal(paths[1].searchParams.get('batch_id'),`eq.${batch}`);
  const missing=createDiscoveryStore(createClient('http://127.0.0.1:1','synthetic',{auth:{persistSession:false},global:{fetch:async () => Response.json({code:'PGRST202'},{status:404})}}));
  await assert.rejects(missing.claim(owner,batch),{code:'storage_pending'});
});
