import './academy-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMY_TEMPLATE } from '../src/lib/academy-manifest.ts';
import type { AcademyDocument } from '../src/lib/academy-storage-types.ts';
const collection = await import('../src/app/api/academy/inventories/route.ts');
const item = await import('../src/app/api/academy/inventories/[id]/route.ts');
const history = await import('../src/app/api/academy/inventories/[id]/revisions/route.ts');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const context = { params: Promise.resolve({ id }) };
const save = (expectedRevision = 0) => ({ expectedRevision, name: 'K01 DEMO inventory', manifest: ACADEMY_TEMPLATE, origin: { label: 'K01 DEMO fixture' } });
const request = (body?: object, token: string | null = 'allowed', query = '') => new Request(`http://local.test/api/academy/inventories/${id}${query}`, { method: body ? 'PUT' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
test('Academy actual route/auth/SDK boundary against isolated HTTP fixtures (not a real DB)', async t => {
  const previousFetch = globalThis.fetch;
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'NBC_OPERATOR_EMAIL'];
  const previous = names.map(name => process.env[name]);
  ['https://academy-fixture.supabase.co', 'fixture-public', 'fixture-service', 'operator@example.test'].forEach((value, i) => { process.env[names[i]] = value; });
  let role = 'admin'; let memberStatus = 'active';
  let document: AcademyDocument | null = null; let storedOwner = owner; const revisions: AcademyDocument[] = []; let reads = 0; let writes = 0; let missing = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert.equal(url.hostname, 'academy-fixture.supabase.co');
    const headers = new Headers(init?.headers);
    if (url.pathname === '/auth/v1/user') {
      const token = headers.get('authorization');
      role = token === 'Bearer wrong' ? 'student' : token === 'Bearer coach' ? 'coach' : 'admin';
      memberStatus = token === 'Bearer suspended' ? 'suspended' : 'active';
      if (token === 'Bearer invalid') return Response.json({ message: 'invalid' }, { status: 401 });
      return Response.json({ id: owner, email: token === 'Bearer wrong' ? 'other@example.test' : 'operator@example.test', email_confirmed_at: token === 'Bearer unconfirmed' ? null : '2026-09-14T00:00:00Z' });
    }
    if (url.pathname.endsWith('/nbc_members')) return Response.json([{ id: owner, display_name: 'K01 test user', role, status: memberStatus }]);
    if (missing) return Response.json({ code: 'PGRST205', message: 'private schema details' }, { status: 404 });
    if (url.pathname.endsWith('/rpc/academy_save_inventory')) {
      writes++; const args = JSON.parse(String(init?.body)); assert.equal(args.p_owner, owner);
      if (document && storedOwner !== owner || !document && args.p_expected > 0) return Response.json({ code: 'PT404' }, { status: 404 });
      if (document && document.revision !== args.p_expected) return Response.json({ code: 'PT409' }, { status: 409 });
      document = { id, name: args.p_name, revision: args.p_expected + 1, createdAt: '2026-09-14T12:00:00Z', updatedAt: '2026-09-14T12:00:00Z', manifest: args.p_manifest, origin: args.p_origin };
      revisions.push(structuredClone(document)); return Response.json(document);
    }
    reads++; assert.equal(url.searchParams.get('owner_id'), `eq.${owner}`, 'every read must filter verified owner');
    assert.ok(url.searchParams.has('select')); assert.ok(!url.searchParams.get('select')?.includes('*'));
    if (url.pathname.endsWith('/academy_inventories')) {
      const rows = document && storedOwner === owner ? [{ id, name: document.name, revision: document.revision, created_at: document.createdAt, updated_at: document.updatedAt }] : [];
      if (!url.searchParams.has('id')) { assert.equal(url.searchParams.get('limit'), '21'); assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc'); }
      return Response.json(rows);
    }
    assert.ok(url.pathname.endsWith('/academy_revisions')); assert.equal(url.searchParams.get('inventory_id'), `eq.${id}`);
    const revision = url.searchParams.get('revision');
    return Response.json(revisions.filter(r => storedOwner === owner && (!revision || revision === `eq.${r.revision}`)).map(r => ({ name: r.name, revision: r.revision, manifest: r.manifest, origin: r.origin, created_at: r.updatedAt })));
  };
  try {
    await t.test('anonymous/invalid/student/coach/suspended/unconfirmed rejected by verified admin guard before inventory storage', async () => {
      for (const token of [null, 'invalid', 'wrong', 'coach', 'suspended', 'unconfirmed']) {
        for (const response of [await collection.GET(request(undefined, token)), await item.GET(request(undefined, token), context), await item.PUT(request(save(), token), context), await history.GET(request(undefined, token), context)]) {
          assert.equal(response.status, token === null || token === 'invalid' || token === 'unconfirmed' ? 401 : 403); assert.equal(response.headers.get('cache-control'), 'no-store');
        }
      }
      assert.equal(reads, 0); assert.equal(writes, 0);
    });
    await t.test('server rejects client owner, bad ID, bad revision and unsafe URL', async () => {
      assert.equal((await item.PUT(request({ ...save(), owner_id: other }), context)).status, 400);
      assert.equal((await item.GET(request(), { params: Promise.resolve({ id: 'bad' }) })).status, 400);
      assert.equal((await item.GET(request(undefined, 'allowed', '?revision=0'), context)).status, 400);
      assert.equal((await collection.GET(request(undefined, 'allowed', '?offset=-1'))).status, 400);
      assert.equal((await item.PUT(request({ ...save(), origin: { label: 'Fixture', url: 'data:text/html,bad' } }), context)).status, 400);
      assert.equal(writes, 0);
    });
    await t.test('save/read/history roundtrip retains v1; optimistic precondition passes to RPC and surfaces conflicts', async () => {
      const created = await item.PUT(request(save()), context); assert.equal(created.status, 201);
      assert.equal((await created.json()).inventory.revision, 1);
      assert.equal((await item.PUT(request(save()), context)).status, 409);
      const attempts = await Promise.all([item.PUT(request(save(1)), context), item.PUT(request(save(1)), context)]);
      assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
      const latest = await (await item.GET(request(), context)).json(); assert.equal(latest.inventory.revision, 2); assert.deepEqual(latest.inventory.manifest, ACADEMY_TEMPLATE);
      const first = await (await item.GET(request(undefined, 'allowed', '?revision=1'), context)).json(); assert.equal(first.inventory.revision, 1);
      assert.equal((await (await history.GET(request(), context)).json()).revisions.length, 2);
      const list = await (await collection.GET(request())).json(); assert.equal(list.inventories.length, 1); assert.ok(!('manifest' in list.inventories[0])); assert.ok(!('owner_id' in list.inventories[0]));
    });
    await t.test('wrong owner cannot list, read, read history or write existing UUID', async () => {
      storedOwner = other;
      assert.equal((await (await collection.GET(request())).json()).inventories.length, 0);
      assert.equal((await item.GET(request(), context)).status, 404);
      assert.equal((await history.GET(request(), context)).status, 404);
      assert.equal((await item.PUT(request(save(2)), context)).status, 404);
      assert.equal((await item.PUT(request(save()), context)).status, 404);
    });
    await t.test('schema absent safely reports pending storage', async () => {
      missing = true;
      const response = await collection.GET(request()); assert.equal(response.status, 503);
      const payload = await response.json(); assert.equal(payload.code, 'storage_pending'); assert.ok(!JSON.stringify(payload).includes('private schema'));
    });
  } finally { globalThis.fetch = previousFetch; names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
