import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeWorkbook, readWorkbook, sheetRecords, columnName, columnIndex } from '../src/lib/lead-engine-xlsx.ts';

const rows = [
  ['#', 'Cell Phone', 'Company', 'Called', 'Outcome', 'Ledger Id'],
  [1, '7045551234', 'Acme HVAC & Sons <Tampa>', null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'],
  [2, '8135551234', 'Bob "The Roofer"', true, 'reached_owner', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'],
  [3, '9415551234', '  spaced  ', 12.5, 'opt_out', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'],
];

test('column names and indexes round trip past Z', () => {
  assert.equal(columnName(0), 'A'); assert.equal(columnName(25), 'Z'); assert.equal(columnName(26), 'AA'); assert.equal(columnName(19), 'T');
  assert.equal(columnIndex('AA7'), 26); assert.equal(columnIndex('T2'), 19); assert.equal(columnIndex('A1'), 0);
});

test('a workbook written deflated or stored reads back with the same three sheets and cell values', () => {
  for (const compress of [true, false]) {
    const bytes = writeWorkbook([{ name: 'List', rows }, { name: 'Summary', rows: [['Delivered', 3]] }, { name: 'Legal Notes', rows: [['Dial window 8:00am to 8:00pm recipient local time.']] }], { compress });
    assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
    const sheets = readWorkbook(bytes);
    assert.deepEqual(sheets.map(sheet => sheet.name), ['List', 'Summary', 'Legal Notes']);
    assert.deepEqual(sheets[0].rows[0], rows[0]);
    assert.deepEqual(sheets[0].rows[1], [1, '7045551234', 'Acme HVAC & Sons <Tampa>', null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001']);
    assert.deepEqual(sheets[0].rows[2], [2, '8135551234', 'Bob "The Roofer"', true, 'reached_owner', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002']);
    assert.deepEqual(sheets[0].rows[3], [3, '9415551234', '  spaced  ', 12.5, 'opt_out', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003']);
    assert.deepEqual(sheets[1].rows, [['Delivered', 3]]);
    assert.match(String(sheets[2].rows[0][0]), /8:00pm/);
  }
});

test('records are keyed by header, blank rows are skipped, and a shared-strings workbook (Excel style) reads too', () => {
  const records = sheetRecords(readWorkbook(writeWorkbook([{ name: 'List', rows: [...rows, [null, null, null]] }]))[0]);
  assert.equal(records.length, 3);
  assert.equal(records[1]['Outcome'], 'reached_owner'); assert.equal(records[1]['Ledger Id'], 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'); assert.equal(records[0]['Called'], null);
  // Hand-built minimal Excel-style workbook with sharedStrings and a rels file pointing at a custom path.
  const encoder = new TextEncoder();
  const parts = new Map<string, string>([
    ['xl/workbook.xml', '<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId9"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId9" Type="x" Target="worksheets/sheet7.xml"/></Relationships>'],
    ['xl/sharedStrings.xml', '<sst><si><t>Ledger Id</t></si><si><r><t>reach</t></r><r><t>ed_owner</t></r></si></sst>'],
    ['xl/worksheets/sheet7.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="str"><v>Outcome</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c><c r="B2" t="s"><v>1</v></c></row></sheetData></worksheet>'],
  ]);
  // Reuse the writer's zip through writeWorkbook is not possible for arbitrary parts, so build a stored zip inline.
  const entries = [...parts].map(([name, xml]) => ({ name, data: encoder.encode(xml) }));
  const bytes = storedZip(entries);
  const [sheet] = readWorkbook(bytes);
  assert.equal(sheet.name, 'Data');
  assert.deepEqual(sheetRecords(sheet), [{ 'Ledger Id': 'x', Outcome: 'reached_owner' }]);
});

test('garbage is refused instead of returning empty sheets silently', () => {
  assert.throws(() => readWorkbook(new Uint8Array([1, 2, 3, 4, 5])), RangeError);
  assert.throws(() => writeWorkbook([]), RangeError);
});

function storedZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder(); const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (bytes: Uint8Array) => { let crc = 0xffffffff; for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  for (const entry of entries) {
    const name = encoder.encode(entry.name), crc = crc32(entry.data), size = entry.data.length;
    const local = new Uint8Array(30 + name.length + size), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(entry.data, 30 + name.length);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.set(name, 46); locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((s, p) => s + p.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22); let cursor = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, cursor); cursor += part.length; }
  return out;
}
