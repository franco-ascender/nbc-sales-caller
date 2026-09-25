import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJobGates, CLEAN_RATE_MIN_SAMPLE, NEVER_MAPS_DELIVERABLE } from '../src/lib/lead-engine-gates.ts';
import type { JobGateRow, JobGateInput } from '../src/lib/lead-engine-gates.ts';

// Anas §7 as the job runner applies them inside deliver(): every failure blocks, one is overridable.

const row: JobGateRow = { phone10: '8135550101', company: 'Acme Roofing', state: 'FL', timeZone: 'America/New_York', lineType: 'Mobile', dnc: false, tcpa: false, reachable: true, flagged: false };
const second: JobGateRow = { ...row, phone10: '8135550102', company: 'Bay Cooling' };
const base: JobGateInput = { rows: [row, second], dncMode: 'strict', verifiedInput: 10, summary: { delivered: 2, flagged: 0 }, recipe: 'A', industryKey: 'hvac' };

test('a clean recipe A batch passes every job gate; a small verified input skips the clean rate band', () => {
  const result = evaluateJobGates(base);
  assert.deepEqual(result.failures, []); assert.equal(result.cleanRate, null); assert.equal(result.note, null);
});

test('each blocking gate fires on the failure it exists to catch', () => {
  const cases: Array<[Partial<JobGateInput>, string]> = [
    [{ rows: [row, { ...row }] }, 'duplicate_phone_in_file'],
    [{ rows: [{ ...row, phone10: '813555010' }, second] }, 'invalid_phone_format'],
    [{ rows: [{ ...row, phone10: '1135550101' }, second] }, 'invalid_phone_format'],
    [{ rows: [{ ...row, company: ' ' }, second] }, 'missing_company_name'],
    [{ rows: [{ ...row, timeZone: null }, second] }, 'time_zone_missing_or_inconsistent'],
    [{ rows: [{ ...row, timeZone: 'America/Los_Angeles' }, second] }, 'time_zone_missing_or_inconsistent'],
    [{ rows: [{ ...row, state: null }, second] }, 'time_zone_missing_or_inconsistent'],
    [{ rows: [{ ...row, lineType: 'Landline' }, second] }, 'landline_or_voip_present'],
    [{ rows: [{ ...row, lineType: 'VoIP' }, second] }, 'landline_or_voip_present'],
    [{ rows: [{ ...row, reachable: false }, second] }, 'landline_or_voip_present'],
    [{ rows: [{ ...row, tcpa: true }, second] }, 'tcpa_litigator_present'],
    [{ rows: [{ ...row, tcpa: null }, second] }, 'tcpa_litigator_present'],
    [{ rows: [{ ...row, dnc: true }, second] }, 'dnc_present'],
    [{ rows: [{ ...row, dnc: true }, second], dncMode: 'flag' }, 'dnc_unmarked_in_flag_mode'],
    [{ summary: { delivered: 3, flagged: 0 } }, 'summary_counts_mismatch'],
    [{ recipe: 'A', industryKey: 'attorney' }, 'maps_deliverable_forbidden'],
    [{ recipe: 'A', industryKey: 'attorney_ny' }, 'maps_deliverable_forbidden'],
    [{ recipe: 'A', industryKey: 'med_spa' }, 'maps_deliverable_forbidden'],
  ];
  for (const [patch, expected] of cases) {
    const failures = evaluateJobGates({ ...base, ...patch }).failures;
    assert.ok(failures.some(item => item === expected || item.startsWith(`${expected}:`)), `expected ${expected}, got ${failures.join(', ')}`);
  }
  assert.deepEqual(NEVER_MAPS_DELIVERABLE, ['attorney', 'attorney_ny', 'cpa', 'med_spa']);
});

test('flag mode: a DNC row marked flagged is allowed and counted in the flagged summary, never in delivered', () => {
  const flagged: JobGateRow = { ...second, dnc: true, flagged: true };
  const ok = evaluateJobGates({ ...base, rows: [row, flagged], dncMode: 'flag', summary: { delivered: 1, flagged: 1 } });
  assert.deepEqual(ok.failures, []);
  assert.ok(evaluateJobGates({ ...base, rows: [row, flagged], dncMode: 'flag', summary: { delivered: 2, flagged: 0 } }).failures.includes('summary_counts_mismatch'));
  // Strict mode never ships a DNC row, flagged or not.
  assert.ok(evaluateJobGates({ ...base, rows: [row, flagged], dncMode: 'strict', summary: { delivered: 1, flagged: 1 } }).failures.includes('dnc_present'));
});

test('clean rate outside 10% to 70% of verified input blocks with the numbers; the operator override records a note instead', () => {
  const many = Array.from({ length: 40 }, (_, index) => ({ ...row, phone10: `81355501${String(index).padStart(2, '0')}`, company: `Shop ${index}` }));
  // 40 clean of 45 verified = 89%: a broken filter.
  const high = evaluateJobGates({ ...base, rows: many, verifiedInput: 45, summary: { delivered: 40, flagged: 0 } });
  assert.equal(high.failures.length, 1); assert.match(high.failures[0], /^clean_rate_out_of_range: clean rate 89% of 45 verified is outside 10% to 70% \(broken_filter\)/);
  assert.equal(high.cleanRate, 40 / 45);
  // 2 clean of 100 verified = 2%.
  const low = evaluateJobGates({ ...base, verifiedInput: 100 });
  assert.match(low.failures[0], /clean rate 2% of 100 verified/);
  // Inside the band passes; below the minimum sample it is not judged at all.
  assert.deepEqual(evaluateJobGates({ ...base, rows: many, verifiedInput: 100, summary: { delivered: 40, flagged: 0 } }).failures, []);
  assert.deepEqual(evaluateJobGates({ ...base, verifiedInput: CLEAN_RATE_MIN_SAMPLE - 1 }).failures, []);
  // Explicit resume: ships, with the reason on the file.
  const override = evaluateJobGates({ ...base, rows: many, verifiedInput: 45, summary: { delivered: 40, flagged: 0 }, brokenFilterOverride: true });
  assert.deepEqual(override.failures, []); assert.match(override.note ?? '', /Delivered under operator override: clean rate 89%/);
  // The override never silences any other gate.
  assert.ok(evaluateJobGates({ ...base, rows: [...many.slice(1), { ...many[0], tcpa: true }], verifiedInput: 45, summary: { delivered: 40, flagged: 0 }, brokenFilterOverride: true }).failures.includes('tcpa_litigator_present'));
});

test('recipes C and D pass the Maps guardrail for the industries recipe A is refused', () => {
  assert.deepEqual(evaluateJobGates({ ...base, recipe: 'C', industryKey: 'cpa' }).failures, []);
  assert.deepEqual(evaluateJobGates({ ...base, recipe: 'D', industryKey: 'contractor_fl' }).failures, []);
});
