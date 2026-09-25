import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRelevance, findIndustryProfile, franchiseBrand } from '../src/lib/lead-engine-industries.ts';
import { resolveTimeZone, timeZoneMatchesState, EASTERN, CENTRAL, MOUNTAIN, PACIFIC, ARIZONA } from '../src/lib/lead-engine-timezone.ts';
import { evaluateDeliveryGates } from '../src/lib/lead-engine-gates.ts';
import type { DeliveryRow } from '../src/lib/lead-engine-gates.ts';

test('the positive allowlist keeps the trade and rejects the off-trade rows a blocklist let through', () => {
  assert.equal(classifyRelevance('Example Roofing Roofing contractor', 'Roofing'), 'core');
  assert.equal(classifyRelevance('Queen City Exteriors Gutter installation', 'Roofing'), 'adjacent');
  assert.equal(classifyRelevance('Smith General Contractors Construction company', 'Roofing'), 'general');
  // The two real failures named in the build spec: a restaurant and a schooner charter on a trade list.
  assert.equal(classifyRelevance('Joe Pizza Restaurant', 'Roofing'), null);
  assert.equal(classifyRelevance('Vermont Schooner Charter Services Boat tour agency', 'Roofing'), null);
});

test('industry lookup prefers the most specific trade and still covers industries with no profile', () => {
  assert.equal(findIndustryProfile('garage door repair')?.key, 'garage doors');
  assert.equal(findIndustryProfile('window replacement')?.key, 'windows and doors');
  assert.equal(findIndustryProfile('med spa'), null);
  // No profile: the typed industry itself must appear, and a generic word alone is not enough.
  assert.equal(classifyRelevance('Carolina Alpaca Farm alpaca breeder', 'alpaca'), 'core');
  assert.equal(classifyRelevance('Smith Construction contractor', 'alpaca'), null);
});

test('franchises are tagged with their brand and kept, never dropped', () => {
  assert.equal(franchiseBrand('Roto-Rooter Plumbing of Charlotte'), 'roto rooter');
  assert.equal(franchiseBrand('SERVPRO of South Charlotte'), 'servpro');
  assert.equal(franchiseBrand('Bob Smith Plumbing'), null);
});

test('single-zone states resolve from the state alone, including Arizona without DST', () => {
  assert.equal(resolveTimeZone({ state: 'NC' }), EASTERN);
  assert.equal(resolveTimeZone({ state: 'IL' }), CENTRAL);
  assert.equal(resolveTimeZone({ state: 'CO' }), MOUNTAIN);
  assert.equal(resolveTimeZone({ state: 'CA' }), PACIFIC);
  assert.equal(resolveTimeZone({ state: 'AZ' }), ARIZONA);
});

test('split states resolve by city first, then area code, and El Paso does not get Central', () => {
  assert.equal(resolveTimeZone({ state: 'TX', city: 'El Paso' }), MOUNTAIN);
  assert.equal(resolveTimeZone({ state: 'TX', city: 'Dallas' }), CENTRAL);
  assert.equal(resolveTimeZone({ state: 'TX', city: 'Unknown Town', phone10: '9155551234' }), MOUNTAIN);
  assert.equal(resolveTimeZone({ state: 'FL', city: 'Pensacola' }), CENTRAL);
  assert.equal(resolveTimeZone({ state: 'FL', city: 'Orlando' }), EASTERN);
  assert.equal(resolveTimeZone({ state: 'TN', city: 'Knoxville' }), EASTERN);
  assert.equal(resolveTimeZone({ state: 'TN', city: 'Unknown', phone10: '9015551234' }), CENTRAL);
  assert.equal(resolveTimeZone({ state: 'KY', city: 'Louisville' }), EASTERN);
  assert.equal(resolveTimeZone({ state: 'SD', city: 'Rapid City' }), MOUNTAIN);
  assert.equal(resolveTimeZone({ state: 'SD', city: 'Sioux Falls' }), CENTRAL);
});

test('an unresolvable zone returns null instead of a guess that dials someone at 5am', () => {
  // Idaho is genuinely split under one area code with no dominant side.
  assert.equal(resolveTimeZone({ state: 'ID', city: 'Boise' }), MOUNTAIN);
  assert.equal(resolveTimeZone({ state: 'ID', city: 'Coeur d Alene' }), PACIFIC);
  assert.equal(resolveTimeZone({ state: 'ID', city: 'Some Unlisted Town' }), null);
  assert.equal(resolveTimeZone({ state: 'ZZ', city: 'Nowhere' }), null);
});

test('the gate rejects a zone that does not belong to the row state', () => {
  assert.equal(timeZoneMatchesState('NC', EASTERN), true);
  assert.equal(timeZoneMatchesState('NC', PACIFIC), false);
  assert.equal(timeZoneMatchesState('TX', MOUNTAIN), true);
  assert.equal(timeZoneMatchesState('NC', null), false);
});

const row: DeliveryRow = {
  company: 'Acme Roofing', phone10: '7045551234', city: 'Charlotte', state: 'NC', timeZone: EASTERN,
  lineType: 'Mobile', dnc: false, tcpa: false, reachable: true, verifiedAt: '2026-09-17T10:00:00Z',
};
const now = Date.parse('2026-09-17T12:00:00Z');
const base = {
  rows: [row], topRows: [row], summaryCount: 1, mobilesFound: 100, dncExcluded: 44,
  deliveredPhones: new Set<string>(), suppressedPhones: new Set<string>(), exclusions: [] as string[], now,
};

test('a clean batch passes every gate', () => {
  assert.deepEqual(evaluateDeliveryGates(base), []);
});

test('each blocking gate fires on the failure it exists to catch', () => {
  const second: DeliveryRow = { ...row, phone10: '7045555678' };
  const cases: Array<[Partial<typeof base>, string]> = [
    [{ summaryCount: 2 }, 'row_count_mismatch'],
    [{ rows: [row, { ...row }], summaryCount: 2 }, 'duplicate_phone_in_file'],
    [{ rows: [{ ...row, phone10: '123' }] }, 'invalid_phone_format'],
    [{ rows: [{ ...row, company: '  ' }] }, 'missing_company_name'],
    [{ deliveredPhones: new Set(['7045551234']) }, 'already_delivered_intersection'],
    [{ suppressedPhones: new Set(['7045551234']) }, 'suppression_intersection'],
    [{ rows: [{ ...row, timeZone: PACIFIC }] }, 'time_zone_missing_or_inconsistent'],
    [{ rows: [{ ...row, timeZone: null }] }, 'time_zone_missing_or_inconsistent'],
    [{ rows: [{ ...row, lineType: 'Land Line' }] }, 'unverified_or_excluded_number_present'],
    [{ rows: [{ ...row, dnc: true }] }, 'unverified_or_excluded_number_present'],
    [{ rows: [{ ...row, tcpa: true }] }, 'unverified_or_excluded_number_present'],
    [{ rows: [{ ...row, reachable: null }] }, 'unverified_or_excluded_number_present'],
    [{ dncExcluded: 0 }, 'dnc_exclusion_rate_out_of_range'],
    [{ dncExcluded: 100 }, 'dnc_exclusion_rate_out_of_range'],
    [{ topRows: [second] }, 'top_rows_not_subset'],
    [{ exclusions: ['acme'] }, 'operator_exclusion_present'],
    [{ rows: [{ ...row, verifiedAt: '2026-08-01T10:00:00Z' }] }, 'stale_dnc_scrub'],
    [{ rows: [{ ...row, verifiedAt: null }] }, 'stale_dnc_scrub'],
  ];
  for (const [patch, expected] of cases) {
    assert.ok(evaluateDeliveryGates({ ...base, ...patch }).includes(expected), `expected ${expected}`);
  }
});

test('the DNC band is not applied to a sample too small to mean anything, but zero mobiles still blocks', () => {
  assert.deepEqual(evaluateDeliveryGates({ ...base, mobilesFound: 10, dncExcluded: 0 }), []);
  assert.ok(evaluateDeliveryGates({ ...base, mobilesFound: 0, dncExcluded: 0 }).includes('mobile_count_inconsistent'));
});

test('a stale scrub can only ship under an explicit override, never silently', () => {
  const stale = { ...base, rows: [{ ...row, verifiedAt: '2026-08-01T10:00:00Z' }], topRows: [] };
  assert.ok(evaluateDeliveryGates(stale).includes('stale_dnc_scrub'));
  assert.equal(evaluateDeliveryGates({ ...stale, staleScrubOverride: true }).includes('stale_dnc_scrub'), false);
});
