import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFresh, workbookListToCsv } from '../src/services/lead-engine-export.service.ts';
import { writeWorkbook } from '../src/lib/lead-engine-xlsx.ts';
import { LeadEngineError } from '../src/lib/lead-engine-storage.ts';

test('a list with rows verified over 31 days ago is refused unless the operator overrides for email use', () => {
  assert.doesNotThrow(() => assertFresh({ oldestVerifiedAt: '2026-09-20T00:00:00Z', staleRows: 0, rows: 40 }, false));
  assert.throws(() => assertFresh({ oldestVerifiedAt: '2026-07-01T00:00:00Z', staleRows: 3, rows: 40 }, false), (error: unknown) => error instanceof LeadEngineError && error.code === 'export_stale' && error.status === 409);
  assert.doesNotThrow(() => assertFresh({ oldestVerifiedAt: '2026-07-01T00:00:00Z', staleRows: 3, rows: 40 }, true));
});

test('the CSV is the List sheet, quoted where needed, with a BOM for Excel', () => {
  const bytes = writeWorkbook([{ name: 'List', rows: [['#', 'Company', 'Notes'], [1, 'Acme, Inc.', 'said "call back"'], [2, 'Plain', null]] }, { name: 'Summary', rows: [['x', 1]] }]);
  const csv = workbookListToCsv(bytes);
  assert.equal(csv, '﻿#,Company,Notes\r\n1,"Acme, Inc.","said ""call back"""\r\n2,Plain,\r\n');
});
