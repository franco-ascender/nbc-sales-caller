import './caller-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';

const plans = await import('../src/app/api/lead-engine/plans/route.ts');
const plan = await import('../src/app/api/lead-engine/plans/[id]/route.ts');
const dryRun = await import('../src/app/api/lead-engine/plans/[id]/dry-run/route.ts');
const folders = await import('../src/app/api/lead-engine/folders/route.ts');
const quotes = await import('../src/app/api/lead-engine/quotes/route.ts');
const approve = await import('../src/app/api/lead-engine/quotes/[id]/approve/route.ts');
const lists = await import('../src/app/api/lead-engine/lists/route.ts');
const list = await import('../src/app/api/lead-engine/lists/[id]/route.ts');
const sync = await import('../src/app/api/lead-engine/lists/[id]/sync/route.ts');
const move = await import('../src/app/api/lead-engine/lists/[id]/move/route.ts');
const connections = await import('../src/app/api/lead-engine/connections/check/route.ts');
const owner = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) };
type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
const routes: [string, string, Handler][] = [
  ['/plans', 'GET', plans.GET], ['/plans', 'POST', plans.POST],
  ['/plans/id', 'GET', plan.GET], ['/plans/id/dry-run', 'POST', dryRun.POST],
  ['/folders', 'GET', folders.GET], ['/folders', 'POST', folders.POST],
  ['/quotes', 'POST', quotes.POST], ['/quotes/id/approve', 'POST', approve.POST],
  ['/lists', 'GET', lists.GET], ['/lists/id', 'GET', list.GET],
  ['/lists/id/sync', 'POST', sync.POST], ['/lists/id/move', 'POST', move.POST],
];

test('Lead routes enforce internal operator AND active admin before research or provider access', async t => {
  const previousFetch = globalThis.fetch;
  const fixtureEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://lead-access.invalid',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public', SUPABASE_SECRET_KEY: 'fixture-secret',
    NBC_OPERATOR_EMAIL: 'operator@example.invalid', APIFY_API_TOKEN: 'fixture-provider',
  };
  const previousEnv = Object.fromEntries(Object.keys(fixtureEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixtureEnv);
  let role = 'admin', status = 'active', email = fixtureEnv.NBC_OPERATOR_EMAIL;
  let confirmed = true, missing = false, membershipError = false;
  let businessReads = 0, membershipReads = 0, externalRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.hostname !== 'lead-access.invalid') { externalRequests++; throw new Error('External access blocked in test'); }
    if (url.pathname === '/auth/v1/user') {
      if (headers.get('authorization') === 'Bearer invalid') return Response.json({ message: 'Invalid token' }, { status: 401 });
      return Response.json({ id: owner, email, email_confirmed_at: confirmed ? '2026-09-16T00:00:00Z' : null });
    }
    if (url.pathname === '/rest/v1/nbc_members') {
      membershipReads++;
      assert.equal(url.searchParams.get('id'), `eq.${owner}`);
      if (membershipError) return Response.json({ code: 'PGRST205', message: 'Missing table' }, { status: 404 });
      return Response.json(missing ? [] : [{ id: owner, role, status, display_name: 'Fixture' }]);
    }
    businessReads++;
    assert.equal(url.pathname, '/rest/v1/lead_engine_plans');
    assert.equal(url.searchParams.get('operator_id'), `eq.${owner}`);
    return Response.json([]);
  };
  const request = (path: string, method: string, token: string | null = 'valid') => new Request(`https://app.invalid/api/lead-engine${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    // Invalid bodies prove that denied requests stop before input processing.
    ...(method === 'POST' ? { body: '{invalid-json' } : {}),
  });
  const denied = async (expected: number, token: string | null = 'valid') => {
    businessReads = 0; externalRequests = 0;
    for (const [path, method, handler] of routes) {
      const response = await handler(request(path, method, token), context);
      assert.equal(response.status, expected, `${method} ${path}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(businessReads, 0); assert.equal(externalRequests, 0);
  };
  try {
    await t.test('anonymous', () => denied(401, null));
    await t.test('invalid token', () => denied(403, 'invalid'));
    await t.test('unconfirmed email', async () => { confirmed = false; await denied(403); confirmed = true; });
    await t.test('other admin cannot gain internal operator scope', async () => { email = 'other@example.invalid'; await denied(403); email = fixtureEnv.NBC_OPERATOR_EMAIL; });
    await t.test('suspended operator', async () => { status = 'suspended'; await denied(403); status = 'active'; });
    await t.test('demoted operator', async () => { for (const nextRole of ['student', 'coach', 'unknown']) { role = nextRole; await denied(403); } role = 'admin'; });
    await t.test('missing membership has no bootstrap fallback', async () => { missing = true; await denied(403); missing = false; });
    await t.test('membership lookup failure fails closed', async () => { membershipError = true; await denied(503); membershipError = false; });
    await t.test('active operator can read only owned plans', async () => {
      businessReads = 0; membershipReads = 0;
      const response = await plans.GET(request('/plans', 'GET'));
      assert.equal(response.status, 200); assert.equal(businessReads, 1); assert.equal(membershipReads, 1);
      assert.equal(externalRequests, 0);
    });
    await t.test('connection diagnosis continues to reject suspended and non-admin members', async () => {
      for (const state of [{ role: 'admin', status: 'suspended' }, { role: 'student', status: 'active' }]) {
        role = state.role; status = state.status;
        assert.equal((await connections.POST(request('/connections/check', 'POST'))).status, 403);
      }
      assert.equal(externalRequests, 0);
    });
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(fixtureEnv)) {
      if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
    }
  }
});
