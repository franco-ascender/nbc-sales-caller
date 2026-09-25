import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadPlanFingerprint } from '../src/lib/lead-engine-storage.ts';
import type { LeadPlanInput } from '../src/lib/lead-engine-plan.ts';
const input: LeadPlanInput = { industry: 'Roofing', metro: 'Charlotte, NC', target: 50, hardBudgetCents: 1000, exclusions: ['wholesale'] };
test('a saved JSONB snapshot matches the draft despite reordered keys and omitted optional operation', () => {
  const persisted = JSON.parse('{"metro":"Charlotte, NC","target":50,"industry":"Roofing","exclusions":["wholesale"],"hardBudgetCents":1000}');
  assert.equal(leadPlanFingerprint(persisted), leadPlanFingerprint({ ...input, operation: undefined }));
});
test('every meaningful plan edit invalidates the saved snapshot including lane, budget and exclusions', () => {
  for (const changes of [{ industry: 'Plumbing' }, { metro: 'Raleigh, NC' }, { target: 51 }, { hardBudgetCents: 1001 }, { exclusions: [] }, { operation: 'A' as const }]) {
    assert.notEqual(leadPlanFingerprint({ ...input, ...changes }), leadPlanFingerprint(input));
  }
});
