import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { parseLeadPlanCreate, parseLeadDryRun, parseLeadOffset, leadStorageError, LeadEngineError } from '../src/lib/lead-engine-storage.ts';
import { createLeadEngineStore } from '../src/services/lead-engine-store.ts';
import { leadEngineHandler } from '../src/services/lead-engine-http.ts';
import type { LeadEngineStore } from '../src/services/lead-engine-store.ts';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const input = { industry: 'Roofing', metro: 'Charlotte, NC', target: 1000, hardBudgetCents: 10000, exclusions: [] };
const body = { version: 1, planId: id, input };
const row = { id, input, status: 'draft', created_at: '2026-09-14T00:00:00Z', operator_id: owner };
function mockDb(respond: (url: URL, init: RequestInit) => Response) {
  return createClient('http://127.0.0.1:1', 'synthetic-key', { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: async (url, init) => respond(new URL(String(url)), init ?? {}),
  } });
}
test('create validates strict shape, limits and untrusted approval/balance/owner flags', () => {
  assert.equal(parseLeadPlanCreate(body).plan.estimate?.maxCents, 6000);
  for (const change of [null, {}, { ...body, version: '1' }, { ...body, operatorId: owner }, { ...body, approved: true },
    ...[{ target: '1000' }, { target: 100001 }, { target: 0 }, { hardBudgetCents: 1.5 }, { hardBudgetCents: Number.MAX_SAFE_INTEGER },
      { exclusions: [3] }, { exclusions: Array(51).fill('term') }, { operation: true }, { operation: { toString: () => 'A' } }, { industry: 'Dentist', operation: 'A' }, { balancesVerified: true }, { spentCents: 0 }, { metro: 'Paris, FR' }, { industry: 'Roof\u0000ing' }]
      .map(change => ({ ...body, input: { ...input, ...change } }))]) assert.throws(() => parseLeadPlanCreate(change), LeadEngineError);
  assert.equal(parseLeadPlanCreate({ ...body, input: { ...input, hardBudgetCents: 1 } }).plan.overBudget, true, 'over-budget drafts may save but cannot execute');
});
test('dry-run and pagination reject invented flags, arrays, duplicate params and malformed IDs', () => {
  assert.equal(parseLeadDryRun({ version: 1, batchId: id }), id);
  for (const value of [{ version: 1, batchId: id, approved: true }, { version: 1, batchId: 'bad' }, []]) assert.throws(() => parseLeadDryRun(value));
  for (const query of ['offset=-1', 'offset=1.5', 'offset=1000000', 'offset=0&offset=1', 'operatorId=other', 'limit=1000']) assert.throws(() => parseLeadOffset(`http://local/?${query}`));
  assert.equal(parseLeadOffset('http://local/?offset=20'), 20);
});
test('storage dependency is distinguished from transient outage; SQL/internal messages never escape', () => {
  for (const code of ['42P01', 'PGRST202', 'PGRST205', '42883']) assert.equal(leadStorageError({ code }).code, 'storage_pending');
  assert.equal(leadStorageError({ code: '42501', message: 'secret schema' }).code, 'storage_unavailable');
  assert.equal(leadStorageError({ code: 'P0001', message: 'idempotency_conflict' }).status, 409);
  assert.equal(leadStorageError({ code: 'P0001', message: 'plan_not_found' }).status, 404);
  assert.doesNotMatch(leadStorageError({ message: 'secret schema' }).message, /secret/);
});
test('save uses a single SQL RPC and preserves idempotency identity across response failure', async () => {
  const requests: unknown[] = []; let count = 0;
  const store = createLeadEngineStore(mockDb((url, init) => {
    assert.equal(url.pathname, '/rest/v1/rpc/lead_engine_save_plan');
    assert.equal(new Headers(init.headers).get('accept'), 'application/vnd.pgrst.object+json');
    requests.push(JSON.parse(String(init.body)));
    return ++count === 1 ? Response.json({ code: '57014' }, { status: 503 }) : Response.json(row);
  }));
  await assert.rejects(store.create(owner, body));
  const result = await store.create(owner, body);
  assert.deepEqual(requests[0], requests[1]); assert.equal(result.id, id);
  assert.equal((requests[1] as { p_operator: string }).p_operator, owner);
  assert.equal('operator_id' in result, false);
  assert.equal('executionEnabled' in (requests[1] as object), false);
});
test('list/get constrain ownership, projections and page size through real Supabase query builder', async () => {
  let calls = 0;
  const store = createLeadEngineStore(mockDb(url => {
    calls++; assert.equal(url.searchParams.get('operator_id'), `eq.${owner}`);
    assert.equal(url.searchParams.get('select'), 'id,input,status,created_at');
    if (calls === 1) {
      assert.equal(url.searchParams.get('offset'), '20'); assert.equal(url.searchParams.get('limit'), '21');
      return Response.json(Array(21).fill(row));
    }
    assert.equal(url.searchParams.get('id'), `eq.${id}`); return Response.json([]);
  }));
  const page = await store.list(owner, 20); assert.equal(page.plans.length, 20); assert.equal(page.nextOffset, 40);
  await assert.rejects(store.get(owner, id), (error: unknown) => error instanceof LeadEngineError && error.status === 404);
});
test('dry-run calls only diagnostic RPC with server-derived operator identity', async () => {
  const store = createLeadEngineStore(mockDb((url, init) => {
    assert.equal(url.pathname, '/rest/v1/rpc/lead_engine_dry_run');
    assert.deepEqual(JSON.parse(String(init.body)), { p_operator: owner, p_plan: id, p_batch: id });
    return Response.json({ executionEnabled: false, reservedCents: 0 });
  }));
  assert.equal((await store.dryRun(owner, id, id)).executionEnabled, false);
});
test('every HTTP action authorizes before body/storage access and sanitizes failures', async () => {
  let accessed = false;
  const handler = leadEngineHandler({ authorize: async () => { throw new LeadEngineError(403, 'forbidden', 'Access denied.'); },
    readBody: async () => { accessed = true; return body; }, store: () => { accessed = true; throw Error('not called'); } });
  for (const action of ['create', 'list', 'get', 'dryRun'] as const) {
    const response = await handler(action, new Request('http://local/api'), id);
    assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(accessed, false);
});
test('HTTP contracts reject invalid dry-run payload before storage and return state errors', async () => {
  let accessed = false;
  const handler = leadEngineHandler({ authorize: async () => owner, readBody: async () => ({ version: 1, batchId: id, balancesVerified: true }),
    store: () => { accessed = true; throw Error('not called'); } });
  assert.equal((await handler('dryRun', new Request('http://local/api'), id)).status, 400); assert.equal(accessed, false);
  const failing = leadEngineHandler({ authorize: async () => owner, readBody: async () => ({ version: 1, batchId: id }),
    store: () => ({ dryRun: async () => { throw new LeadEngineError(409, 'invalid_state', 'Paused.'); } } as unknown as LeadEngineStore) });
  assert.equal((await failing('dryRun', new Request('http://local/api'), id)).status, 409);
});
