import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessOwnerEvidence, prepareVerificationBatches } from '../src/lib/lead-engine-research.ts';
import type { OwnerEvidence } from '../src/lib/lead-engine-research.ts';
import type { PublishedBusiness, GlobalLeadLedger } from '../src/lib/lead-engine-quality.ts';
import { checkLeadConnections } from '../src/services/lead-engine-connections.ts';
const now = Date.parse('2026-09-14T12:00:00Z');
const site: OwnerEvidence = { url: 'https://example.com/team', publisher: 'Example business', kind: 'business_website', businessName: 'Example Roofing', personName: 'Test Person', role: 'owner', phone: '2025550101', explicitlyDirectBusinessContact: true, reviewedAt: '2026-09-14T00:00:00Z' };
const registry: OwnerEvidence = { ...site, url: 'https://registry.example/business', publisher: 'Independent registry', kind: 'registry', phone: null, explicitlyDirectBusinessContact: false };
test('mobile/listing alone, repeated directories and stale evidence cannot establish owner relationship', () => {
  for (const evidence of [[], [site], [{ ...site, kind: 'directory' as const }, registry], [site, { ...registry, publisher: site.publisher }], [site, { ...registry, reviewedAt: '2020-01-01' }], [site, { ...registry, reviewedAt: '2027-01-01' }], [{ ...site, explicitlyDirectBusinessContact: false }, registry]]) {
    assert.equal(assessOwnerEvidence('Example Roofing', '2025550101', evidence, now).status, 'needs_review');
  }
  assert.equal(assessOwnerEvidence('Example Roofing', '2025550101', [site, registry], now).status, 'supported');
});
test('wrong company/phone/person and conflicting front-desk evidence stay blocked', () => {
  assert.equal(assessOwnerEvidence('Other Company', '2025550101', [site, registry], now).status, 'needs_review');
  assert.equal(assessOwnerEvidence('Example Roofing', '2025550102', [site, registry], now).status, 'needs_review');
  assert.equal(assessOwnerEvidence('Example Roofing', '2025550101', [site, { ...registry, personName: 'Other Person' }], now).status, 'needs_review');
  assert.equal(assessOwnerEvidence('Example Roofing', '2025550101', [{ ...site, role: 'front_desk' }], now).status, 'front_desk');
  assert.equal(assessOwnerEvidence('Example Roofing', '2025550101', [site, { ...site, role: 'front_desk', url: 'https://example.com/contact' }], now).status, 'conflicting');
});
const ledger: GlobalLeadLedger = { loaded: true, deliveredPhones: new Set(), suppressedPhones: new Set(['2025550101']), processedPhones: new Set(), processedBusinessKeys: new Set(), processedPlaceIds: new Set() };
const row: PublishedBusiness = { name: 'Example Roofing', phone: '2025550102', city: 'Charlotte', state: 'NC', category: 'Roofing', subtypes: [], status: 'OPERATIONAL', sourceUrl: 'https://example.com/contact', contactPurpose: 'published_business_contact' };
test('1000 business candidates become ten verification batches, with filters and suppression before payment', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ ...row, name: `Example Roofing ${index}`, phone: `202555${String(1000 + index)}` }));
  const result = prepareVerificationBatches(rows, ['roofing'], [], ledger, 100);
  assert.equal(result.batches.length, 10); assert.equal(result.eligible, 1000); assert.equal(result.executionEnabled, false);
  const filtered = prepareVerificationBatches([row, row, { ...row, phone: '2025550101' }, { ...row, name: 'Cafe', category: 'Restaurant' }], ['roofing'], [], ledger, 100);
  assert.equal(filtered.eligible, 1); assert.deepEqual(filtered.rejected.map(item => item.reason), ['duplicate_in_batch', 'suppressed', 'no_positive_relevance']);
  assert.equal(prepareVerificationBatches(rows, ['roofing'], [], { ...ledger, loaded: false }, 100).eligible, 0);
  assert.throws(() => prepareVerificationBatches(rows, ['roofing'], [], ledger, 0));
});
test('provider checks are read-only and never expose account data or execute paid verification', async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++; assert.equal(String(url), 'https://api.apify.com/v2/users/me'); assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error');
    return Response.json({ data: { id: 'synthetic-id', email: 'private@example.test', token: 'never-return-this' } });
  };
  assert.equal((await checkLeadConnections({}, transport)).apify, 'missing'); assert.equal(calls, 0);
  const result = await checkLeadConnections({ apifyToken: 'synthetic-token', phoneVerifierKey: 'synthetic-key' }, transport);
  assert.equal(calls, 1); assert.equal(result.apify, 'access_verified'); assert.equal(result.phoneVerifier, 'configured_unverified');
  assert.equal(result.executionEnabled, false); assert.doesNotMatch(JSON.stringify(result), /synthetic|private|never-return/);
});
test('bad provider responses, auth failures and outages never report a verified account', async () => {
  for (const [response, expected] of [[Response.json({}, { status: 401 }), 'rejected'], [Response.json({}, { status: 503 }), 'unavailable'], [Response.json({ data: {} }), 'unavailable']] as const) {
    assert.equal((await checkLeadConnections({ apifyToken: 'test' }, async () => response)).apify, expected);
  }
  assert.equal((await checkLeadConnections({ apifyToken: 'test' }, async () => { throw Error('private error'); })).apify, 'unavailable');
});
