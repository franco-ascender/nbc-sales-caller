import { deflateRawSync, inflateRawSync } from 'node:zlib';

// Minimal .xlsx writer and reader with no dependency: a workbook is a ZIP of XML parts. The writer deflates
// parts by default (or stores them, for tests); the reader handles both methods. This is what
// the dial sheet round trip needs: write List / Summary / Legal Notes, read back Called and Outcome.

export type CellValue = string | number | boolean | null;
export interface Sheet { name: string; rows: CellValue[][] }

const encoder = new TextEncoder();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function sheetXml(rows: CellValue[][]): string {
  const body = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      if (value === null || value === undefined) return '';
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
      const text = String(value);
      const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
      return `<c r="${ref}" t="inlineStr"><is><t${preserve}>${escapeXml(text)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

// ZIP with the "store" method: local headers, central directory, end record. Dates are fixed so the
// same content always produces the same bytes.
function zip(entries: Array<{ name: string; data: Uint8Array }>, compress: boolean): Uint8Array {
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), crc = crc32(entry.data), size = entry.data.length;
    const payload = compress ? new Uint8Array(deflateRawSync(entry.data)) : entry.data, method = compress ? 8 : 0;
    const local = new Uint8Array(30 + name.length + payload.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, payload.length, true); lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30); local.set(payload, 30 + name.length);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, payload.length, true); cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, cursor); cursor += part.length; }
  return out;
}

export function writeWorkbook(sheets: Sheet[], options: { compress?: boolean } = {}): Uint8Array {
  if (sheets.length === 0) throw new RangeError('A workbook needs at least one sheet');
  const names = sheets.map(sheet => sheet.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const entries = [
    { name: '[Content_Types].xml', data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) },
    { name: '_rels/.rels', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`) },
    ...sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(sheet.rows)) })),
  ];
  return zip(entries, options.compress ?? true);
}

// Reader: central directory -> parts -> XML. Only what the round trip needs; unknown parts are ignored.
function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new RangeError('Not a zip archive');
  const count = view.getUint16(end + 10, true), centralOffset = view.getUint32(end + 16, true);
  const parts = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let n = 0; n < count; n++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new RangeError('Corrupt central directory');
    const method = view.getUint16(cursor + 10, true), compressed = view.getUint32(cursor + 20, true), uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new RangeError('Corrupt local header');
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compressed);
    if (uncompressed > 50 * 1024 * 1024) throw new RangeError('Part too large');
    if (method === 0) parts.set(name, raw);
    else if (method === 8) parts.set(name, new Uint8Array(inflateRawSync(raw)));
    else throw new RangeError(`Unsupported compression ${method}`);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

const decodeXml = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const textOf = (xml: string) => decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match => match[1]).join(''));

export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const parts = unzip(bytes), decoder = new TextDecoder();
  const part = (name: string) => { const data = parts.get(name); return data ? decoder.decode(data) : ''; };
  const shared = [...part('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => textOf(match[1]));
  const rels = new Map([...part('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)].map(match => {
    const id = /Id="([^"]+)"/.exec(match[1])?.[1] ?? '', target = /Target="([^"]+)"/.exec(match[1])?.[1] ?? '';
    return [id, target.startsWith('/') ? target.slice(1) : `xl/${target}`];
  }));
  const sheets: Sheet[] = [];
  for (const match of part('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(/name="([^"]*)"/.exec(match[1])?.[1] ?? ''), rid = /r:id="([^"]+)"/.exec(match[1])?.[1] ?? '';
    const xml = part(rels.get(rid) ?? '');
    const rows: CellValue[][] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: CellValue[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attributes = cell[1], inner = cell[2] ?? '';
        const index = columnIndex(/r="([A-Z]+)\d+"/.exec(attributes)?.[1] ?? columnName(cells.length));
        const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? 'n';
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value: CellValue = null;
        if (type === 's') value = shared[Number(v)] ?? null;
        else if (type === 'inlineStr') value = textOf(inner);
        else if (type === 'str') value = v === undefined ? null : decodeXml(v);
        else if (type === 'b') value = v === '1';
        else if (v !== undefined) value = Number(v);
        while (cells.length < index) cells.push(null);
        cells[index] = value;
      }
      rows.push(cells);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

// Header-keyed rows of one sheet, so callers ask for "Ledger Id" instead of column index 19.
export function sheetRecords(sheet: Sheet): Array<Record<string, CellValue>> {
  const [header, ...rows] = sheet.rows;
  if (!header) return [];
  const keys = header.map(value => String(value ?? '').trim());
  return rows.filter(row => row.some(value => value !== null && value !== '')).map(row => Object.fromEntries(keys.map((key, i) => [key, row[i] ?? null]).filter(([key]) => key)));
}
