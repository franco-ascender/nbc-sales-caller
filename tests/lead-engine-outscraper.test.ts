import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOutscraperDiscoveryProvider } from '../src/services/lead-engine-outscraper.ts';

const job = { searchTerm: 'Roofing', location: 'Charlotte, NC', maxResults: 50 };

test('paid searches are blocked before any network request even with valid input and credentials', async () => {
  let calls = 0;
  const provider = createOutscraperDiscoveryProvider('synthetic-private-key', async () => {
    calls++; throw new Error('A suspended provider must never be contacted');
  });
  await assert.rejects(provider.start(job), /Outscraper paid searches are disabled/);
  assert.equal(calls, 0);
});

test('poll parses a Success payload into flattened, typed result rows', async () => {
  const provider = createOutscraperDiscoveryProvider('synthetic', async () => Response.json({
    status: 'Success',
    data: [[{ name: 'Acme Roofing', phone: '+17045551234', street: '1 Main St', city: 'Charlotte', state_code: 'NC',
      postal_code: '28202', website: 'https://acme.example', rating: 4.5, reviews: 12, category: 'Roofing contractor',
      business_status: 'OPERATIONAL', place_id: 'ChIJsynthetic1' }]],
  }));
  const result = await provider.poll('https://api.outscraper.cloud/requests/synthetic-1');
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.rows, [{ name: 'Acme Roofing', phone: '+17045551234', street: '1 Main St', city: 'Charlotte', state: 'NC',
    postalCode: '28202', website: 'https://acme.example', rating: 4.5, reviews: 12, category: 'Roofing contractor',
    businessStatus: 'OPERATIONAL', placeId: 'ChIJsynthetic1' }]);
});

test('poll reports pending while the job has not finished, without treating it as failure', async () => {
  const provider = createOutscraperDiscoveryProvider('synthetic', async () => Response.json({ status: 'Pending' }));
  assert.deepEqual(await provider.poll('https://api.outscraper.cloud/requests/synthetic-1'), { status: 'pending', rows: [] });
});

test('poll refuses a results_location outside the provider origin', async () => {
  const provider = createOutscraperDiscoveryProvider('synthetic', async () => Response.json({ status: 'Success', data: [] }));
  await assert.rejects(provider.poll('https://evil.example/steal'));
});

test('poll fails closed with a sanitized error on malformed, oversized or non-OK responses', async () => {
  const bad = [new Response('private', { status: 401 }), new Response('private', { status: 500 }),
    new Response('{'), new Response('x'.repeat(262145)), Response.json({ no_results_location: true })];
  for (const response of bad) {
    let count = 0;
    const provider = createOutscraperDiscoveryProvider('synthetic', async () => { count++; return response; });
    await assert.rejects(provider.poll('https://api.outscraper.cloud/requests/synthetic-1'), error => error instanceof Error && !error.message.includes('private'));
    assert.equal(count, 1);
  }
});

test('checkBalance distinguishes rejected credentials from a verified free read, never a paid call', async () => {
  const calls: string[] = [];
  const rejected = createOutscraperDiscoveryProvider('bad', async input => { calls.push(String(input)); return new Response('private', { status: 401 }); });
  assert.equal(await rejected.checkBalance(), 'rejected');
  const ok = createOutscraperDiscoveryProvider('good', async () => Response.json({ data: { balance: 500 } }));
  assert.equal(await ok.checkBalance(), 'access_verified');
  assert.equal(calls[0], 'https://api.outscraper.cloud/profile/balance');
});

test('input validation rejects control characters, empty terms and out-of-range result counts', async () => {
  const provider = createOutscraperDiscoveryProvider('synthetic', async () => Response.json({ results_location: 'https://api.outscraper.cloud/x' }));
  for (const change of [{ searchTerm: '' }, { searchTerm: 'a\nb' }, { maxResults: 0 }, { maxResults: 301 }]) {
    await assert.rejects(provider.start({ ...job, ...change }));
  }
});

test('poll cannot be used to invoke a paid search or arbitrary provider endpoint', async () => {
  let calls = 0;
  const provider = createOutscraperDiscoveryProvider('synthetic', async () => {
    calls++; return Response.json({});
  });
  for (const location of [
    'https://api.outscraper.cloud/maps/search-v3?query=roofing',
    'https://api.outscraper.cloud/requests/../maps/search-v3',
    'https://api.outscraper.cloud/requests/id?query=roofing',
    'https://api.outscraper.cloud/requests/%2e%2e',
  ]) await assert.rejects(provider.poll(location));
  assert.equal(calls, 0);
});
