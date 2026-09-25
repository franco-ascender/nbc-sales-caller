import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueSources, cadenceDays } from '../src/lib/lead-engine-cron.ts';

const today = new Date('2026-09-21T09:00:00Z');
const row = (source: string, cadence: string, lastSnapshotDate: string | null, runStatus: string | null = null) => ({ source, cadence, lastSnapshotDate, runStatus, attentionReason: null });

test('cadence words map to days, unknown cadences default to weekly', () => {
  assert.equal(cadenceDays('daily'), 1); assert.equal(cadenceDays('Weekly'), 7); assert.equal(cadenceDays('monthly'), 30); assert.equal(cadenceDays('twice yearly'), 182); assert.equal(cadenceDays('whenever'), 7);
});

test('due today: never ingested, stale for its cadence, or parked; fresh ones wait; running ones go first', () => {
  const due = dueSources([
    row('wa_lni', 'daily', '2026-09-21'),          // fresh today: not due
    row('or_ccb', 'daily', '2026-09-20'),          // one day old: due
    row('irs_ptin', 'twice yearly', '2026-09-01'), // 20 days old on a 182 day cadence: not due
    row('mn_dli', 'weekly', '2026-09-10'),         // 11 days old: due
    row('cslb', 'daily', null, 'needs_attention'), // parked: retried
    row('nppes', 'monthly', null),                 // never: due
    row('fmcsa', 'daily', '2026-09-20', 'running'),// mid-run: continued first
  ], today);
  assert.deepEqual(due.map(item => item.source), ['fmcsa', 'cslb', 'nppes', 'mn_dli', 'or_ccb']);
});
