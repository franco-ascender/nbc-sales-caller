import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateScrapeCost, nbcCreditsPrice, NBC_CREDITS_MARKUP_PERCENT } from '../src/lib/lead-engine-cost.ts';

// A 300-business pilot on the live Apify FREE rate read on 2026-09-17: USD 0.004/business.
const pilot = { businesses: 300, discoveryTool: 'Apify', discoveryMinCents: 120, discoveryMaxCents: 121 };

test('the approved figure is the server quote itself, never a number recomputed in the client', () => {
  const cost = estimateScrapeCost(pilot);
  assert.equal(cost.approvedMinCents, 120);
  assert.equal(cost.approvedMaxCents, 121);
  const discovery = cost.lines.find(line => line.stage === 'Business discovery')!;
  assert.equal(discovery.minCents, 120);
  assert.equal(discovery.maxCents, 121);
  assert.equal(discovery.includedInApproval, true);
  assert.equal(discovery.basis, 'verified_rate');
});

test('phone verification is projected and priced per surviving number, but never folded into the approval', () => {
  const cost = estimateScrapeCost(pilot);
  const verification = cost.lines.find(line => line.stage === 'Phone verification')!;
  assert.equal(verification.tool, 'BatchData');
  assert.equal(verification.includedInApproval, false);
  assert.equal(verification.basis, 'documented_rate');
  // 300 scraped → 691/1000 unique survivors → 207 numbers at USD 0.007 = USD 1.45
  assert.equal(cost.verifiableNumbers, 207);
  assert.equal(verification.units, 207);
  assert.equal(verification.minCents, 145);
  assert.equal(cost.projectedMaxCents, 121 + 145);
  assert.ok(cost.approvedMaxCents < cost.projectedMaxCents);
});

test('expected cells and cost per cell follow the measured benchmark and stay inside the brief target', () => {
  const cost = estimateScrapeCost(pilot);
  assert.equal(cost.expectedCells, 56); // 300 × 187/1000
  assert.ok(cost.costPerCellMaxCents !== null && cost.costPerCellMaxCents < 15, 'must sit under the $0.15 stop-loss');
});

test('a zero or invalid business count never invents a cost per cell', () => {
  for (const businesses of [0, -5, 1.5, Number.NaN]) {
    const cost = estimateScrapeCost({ ...pilot, businesses });
    assert.equal(cost.expectedCells, 0);
    assert.equal(cost.costPerCellMaxCents, null);
  }
});

test('client NBC Credits pricing is a separate, explicitly unconfirmed calculation that charges nothing', () => {
  assert.equal(NBC_CREDITS_MARKUP_PERCENT, 20);
  const price = nbcCreditsPrice(100);
  assert.equal(price.cents, 120);
  assert.equal(price.confirmed, false);
  // The operator-facing estimate must stay NBC's own provider cost, with no markup applied.
  assert.equal(estimateScrapeCost(pilot).approvedMaxCents, 121);
});

test('an undersized run is refused before dispatch, because the cap may never exceed what was approved', async () => {
  const { belowProviderMinimum, PROVIDER_MIN_CHARGE_CENTS } = await import('../src/lib/lead-engine-cost.ts');
  assert.equal(PROVIDER_MIN_CHARGE_CENTS, 50);
  assert.equal(belowProviderMinimum(21), true);   // a 50-business run at USD 0.004
  assert.equal(belowProviderMinimum(50), false);  // ~121 businesses, the smallest the provider accepts
  assert.equal(belowProviderMinimum(121), false); // the full 300-business pilot
  const { createApifyDiscoveryProvider } = await import('../src/services/lead-engine-apify.ts');
  let calls = 0;
  const provider = createApifyDiscoveryProvider('synthetic', async () => { calls++; return Response.json({}); });
  const job = { batchId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', planId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
    operatorId: '11111111-1111-4111-8111-111111111111', actorId: 'ActorSynthetic123', build: '1.2.3',
    searchTerm: 'Roofing', location: 'Charlotte, NC', maxResults: 50, maxCostCents: 21,
    status: 'dispatching' as const, runId: null, datasetId: null };
  await assert.rejects(provider.start(job));
  assert.equal(calls, 0, 'must not reach the provider at all');
});
