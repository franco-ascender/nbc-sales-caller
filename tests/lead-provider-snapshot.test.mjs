import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshProviderSnapshot } from '../scripts/lib/lead-provider-snapshot.mjs';

const snapshot = { provider: 'apify', balance_cents: 329, verified_at: '2026-09-25T18:00:00Z',
  valid_until: '2026-10-02T18:00:00Z', evidence_ref: 'Synthetic metadata' };
const idle = { reserved_cents: 0, consumed_cents: 0, verified_at: '2026-09-17T18:00:00Z' };

test('pending reservations and consumption block snapshot writes', async () => {
  for (const account of [{ ...idle, reserved_cents: 174 }, { ...idle, consumed_cents: 10 }]) {
    let calls = 0;
    await assert.rejects(refreshProviderSnapshot('https://example.test', {}, snapshot, async (_, init) => {
      calls++; assert.equal(init.method, undefined); return Response.json([account]);
    }), /Reconcile/);
    assert.equal(calls, 1);
  }
});

test('idle refresh uses conditional update and never includes ledger counters', async () => {
  let calls = 0;
  await refreshProviderSnapshot('https://example.test', {}, { ...snapshot, reserved_cents: 0, consumed_cents: 0 }, async (url, init) => {
    if (++calls === 1) return Response.json([idle]);
    assert.equal(init.method, 'PATCH');
    assert.equal(url.searchParams.get('reserved_cents'), 'eq.0');
    assert.equal(url.searchParams.get('consumed_cents'), 'eq.0');
    assert.equal(url.searchParams.get('verified_at'), `eq.${idle.verified_at}`);
    const body = JSON.parse(init.body);
    assert.equal('reserved_cents' in body, false); assert.equal('consumed_cents' in body, false);
    return Response.json([snapshot]);
  });
  assert.equal(calls, 2);
});

test('a concurrent reservation or account creation is not overwritten or reported as success', async () => {
  for (const rows of [[idle], []]) {
    let calls = 0;
    await assert.rejects(refreshProviderSnapshot('https://example.test', {}, snapshot, async (_, init) => {
      if (++calls === 1) return Response.json(rows);
      if (!rows.length) assert.match(init.headers.Prefer, /resolution=ignore-duplicates/);
      return Response.json([]);
    }), /changed concurrently/);
    assert.equal(calls, 2);
  }
});

test('account read failures never produce a write', async () => {
  let calls = 0;
  await assert.rejects(refreshProviderSnapshot('https://example.test', {}, snapshot, async () => {
    calls++; return new Response(null, { status: 503 });
  }), /could not be read/);
  assert.equal(calls, 1);
});
