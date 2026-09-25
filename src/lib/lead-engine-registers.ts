import { createHash } from 'node:crypto';
import { zip5 } from './lead-engine-dial-window.ts';
import { normalizeBusinessPhone } from './lead-engine-quality.ts';
import { splitRegisterSource } from './lead-engine-brain.ts';
export { splitRegisterSource };

// Phase 2 task 1: the register ingest framework, pure part. One adapter per public register describes
// how to ask for the next segment (a Socrata page, a byte range of a CSV, a PALS surname page, an NPPES
// slice) and how to turn the answer into snapshot rows and names rows. No network here: the service does
// the HTTP and the writes, so every adapter is testable against a saved sample. The catalog's "known
// traps" are assertions in the parsers, not comments.

export type Recipe = 'B' | 'C' | 'D';
export type RegisterSource =
  | 'wa_lni' | 'or_ccb' | 'cslb' | 'pa_pals' | 'fl_dbpr_construction' | 'irs_ptin' | 'fl_dfs_individual' | 'fmcsa'
  | 'pa_childcare' | 'ny_childcare' | 'tx_childcare' | 'ny_attorneys' | 'tx_tdlr_salons' | 'nola_str' | 'orlando_str'
  | 'mn_dli' | 'austin_permits' | 'nppes'
  // Phase 4 recipe B name sources (no phone; the parcel step and the skip trace follow).
  | 'fl_re' | 'fl_cpa' | 'tx_trec' | 'az_adre' | 'il_idfpr' | 'ny_salons' | 'ny_repair_shops' | 'tx_tdi' | 'tx_tabc' | 'ny_doh_food' | 'fl_dbpr_barbers' | 'co_sos_agents' | 'nppes_medspa';

export interface NameRow {
  sourceRowId: string;
  firstName: string | null; lastName: string | null; company: string | null;
  titleCode: string | null; businessType: string | null;
  licenseIssueDate: string | null; licenseExpiresAt: string | null; issuingState: string | null;
  street: string | null; city: string | null; county: string | null; state: string | null; zip: string | null;
  phone10: string | null; email: string | null;
}
export interface ParsedRow { rowKey: string; payload: Record<string, unknown>; name: NameRow | null; skipReason: string | null }
export type Cursor = Record<string, unknown>;

export interface ChunkRequest { url: string; method: 'GET' | 'POST'; headers: Record<string, string>; body: string | null; kind: 'socrata' | 'file' | 'api' }
export interface ChunkResponse { status: number; text: string; contentRange: string | null; contentType: string | null }
export interface ChunkResult { rows: ParsedRow[]; next: Cursor; done: boolean; note: string | null }

export interface RegisterAdapter {
  source: RegisterSource; state: string; label: string; recipe: Recipe; cadence: string;
  initialCursor(): Cursor;
  request(cursor: Cursor): ChunkRequest | null;
  parse(response: ChunkResponse, cursor: Cursor): ChunkResult;
}

export const USER_AGENT = 'NBCSales-LeadEngine/registers (+https://nbc-sales-nbc-sales.vercel.app; public register ingest)';
export const SOCRATA_URL_MAX = 300;
export const TOLL_FREE = /^(800|888|877|866|855|844|833|822)/;
export const MAX_PHONE_REUSE = 3;

// ---------- normalizers ----------

export function phoneOf(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const phone = normalizeBusinessPhone(text.replace(/\s*(x|ext\.?)\s*\d+$/i, ''));
  return phone && !TOLL_FREE.test(phone) ? phone : null;
}

export function stateOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(text)) return text;
  const names: Record<string, string> = { PENNSYLVANIA: 'PA', FLORIDA: 'FL', TEXAS: 'TX', 'NEW YORK': 'NY', CALIFORNIA: 'CA', WASHINGTON: 'WA', OREGON: 'OR', MINNESOTA: 'MN', LOUISIANA: 'LA' };
  return names[text] ?? null;
}

// ISO (with or without time), MM/DD/YYYY, M/D/YYYY h:mm:ss AM, YYYYMMDD. Anything else is null.
export function dateOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  let year: number, month: number, day: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/.exec(text))) { month = Number(match[1]); day = Number(match[2]); year = Number(match[3]); }
  else if ((match = /^(\d{4})(\d{2})(\d{2})$/.exec(text))) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  else return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

export function inFuture(iso: string | null, today: string): boolean { return iso !== null && iso > today; }

export function emailOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(text) && text.length <= 254 ? text : null;
}

export function text(value: unknown, max = 300): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

export function stripExcelGuard(value: string): string {
  const match = /^="?(.*?)"?$/.exec(value.trim());
  return match ? match[1] : value;
}

// RFC 4180 line: quoted fields, doubled quotes, no embedded newlines (the registers never emit them).
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { fields.push(field); field = ''; }
    else field += ch;
  }
  fields.push(field);
  return fields.map(item => item.trim());
}

export function rowHash(payload: Record<string, unknown>): string {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

// ---------- names ----------

const ENTITY_SUFFIX = /^(LLC|L\.L\.C\.?|INC\.?|INCORPORATED|CORP\.?|CORPORATION|CO\.?|COMPANY|LTD\.?|LIMITED|LLP|L\.L\.P\.?|LP|L\.P\.?|PLLC|P\.L\.L\.C\.?|PA|P\.A\.?|PC|P\.C\.?|PLC|PSC|SC|S\.C\.?|LLLP)$/i;
const CREDENTIAL_SUFFIX = /^(DDS|D\.D\.S\.?|DMD|MD|M\.D\.?|DO|CPA|C\.P\.A\.?|EA|ESQ\.?|RN|NP|DC|DPM|OD|DVM|PHD|PH\.D\.?|MBA|JD|J\.D\.?|PE|P\.E\.?|CFP|CLU|CHFC|LUTCF|AIA|RA)$/i;
const CORPORATE_SUFFIX = new RegExp(`${ENTITY_SUFFIX.source}|${CREDENTIAL_SUFFIX.source}`, 'i');
const GENERATIONAL = /^(JR\.?|SR\.?|II|III|IV|V)$/i;
const COMPANY_WORDS = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LTD|LIMITED|LLP|PLLC|GROUP|SERVICES?|SOLUTIONS?|CONSTRUCTION|CONTRACTORS?|CONTRACTING|ENTERPRISES?|HOLDINGS?|PARTNERS(HIP)?|ASSOCIATES|ASSOCIATION|TRUST|CHURCH|UNIVERSITY|COLLEGE|SCHOOL|ACADEMY|DAYCARE|DAY CARE|CHILD ?CARE|LEARNING|KIDS?|CENTER|CENTRE|CLINIC|DENTAL|MEDICAL|HEALTH|PLUMBING|ELECTRIC(AL)?|ROOFING|HVAC|HEATING|COOLING|AIR|LANDSCAP\w*|LAWN|TREE|BUILDERS?|HOMES?|HOUSE|PROPERTIES|PROPERTY|REALTY|REAL ESTATE|INSURANCE|AGENCY|FINANCIAL|TAX|ACCOUNTING|BOOKKEEPING|CONSULTING|MANAGEMENT|INVESTMENTS?|VENTURES?|INDUSTRIES|INTERNATIONAL|NATIONAL|GLOBAL|AMERICA[N]?|USA|SYSTEMS?|TECHNOLOG\w*|DESIGNS?|STUDIO|SALON|SPA|BEAUTY|NAILS?|BARBER\w*|CUTS|STYLES?|ESTUDIO|MOVING|MOVERS|TRANSPORT\w*|TRUCKING|LOGISTICS|HAULING|JUNK|EXPRESS|FREIGHT|LINES?|RENTALS?|CLEANING|MAINTENANCE|REPAIR|AUTO|MOTORS?|LAW|OFFICES?|FIRM|PARTNERS|TERMINALS?|RAILWAY|MINISTR\w*|FOUNDATION|DEPARTMENT|CITY|COUNTY|STATE|DISTRICT|BOARD|BANK|CREDIT|UNION|HOTEL|MOTEL|RESTAURANT|CAFE|GRILL|PIZZA|MARKET|STORE|SHOP|MART|SUPPLY|SUPPLIES|ELECTRONICS|WIRELESS|COMMUNICATIONS|ENERGY|SOLAR|POWER|WATER|POOLS?|FENCE|FENCING|CONCRETE|MASONRY|PAINTING|PAINTERS|DRYWALL|FLOORING|TILE|CABINETS?|KITCHENS?|WINDOWS?|DOORS?|GLASS|GARAGE|REMODELING|RENOVATIONS?|RESTORATION|HANDYMAN|MECHANICAL|WELDING|STEEL|IRON|WOOD|LUMBER|STONE|GRANITE|MARBLE|ROOF|GUTTERS?|SIDING|INSULATION|SEPTIC|EXCAVATING|EXCAVATION|GRADING|PAVING|ASPHALT|DEMOLITION|DISPOSAL|RECYCLING|WASTE|SECURITY|ALARM|FIRE|SAFETY|PEST|CONTROL|EXTERMINAT\w*|TERMITE|WILDLIFE|SPRINKLERS?|IRRIGATION|NURSERY|GARDEN|OUTDOOR|EXTERIORS?|INTERIORS?|CUSTOM|QUALITY|PREMIER|PRO|PROS|PROFESSIONAL|EXPERT|MASTER|ELITE|FIRST|BEST|ONE|TOTAL|ALL|COMPLETE|GENERAL|UNITED|ADVANCED|AFFORDABLE|RELIABLE|PRECISION|SUPERIOR|PERFECT|BROTHERS|BROS|SONS?|FAMILY|DBA|D\/B\/A|OF|THE|AND|&)\b/i;

export interface SplitName { firstName: string; lastName: string }

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_all, lead: string, letter: string) => lead + letter.toUpperCase());
}

function stripSuffixes(tokens: string[]): string[] {
  const out = [...tokens];
  while (out.length > 1 && (CORPORATE_SUFFIX.test(out[out.length - 1]) || GENERATIONAL.test(out[out.length - 1]))) out.pop();
  return out;
}

// True when a free-text name field holds a person. Company words, digits, and single tokens are not people.
export function isPersonName(value: unknown): boolean {
  const raw = text(value, 200);
  if (!raw) return false;
  if (/\d|@|#|\*/.test(raw)) return false;
  if (COMPANY_WORDS.test(raw)) return false;
  if (raw.replace(/,/g, ' ').split(/\s+/).some(token => ENTITY_SUFFIX.test(token))) return false;
  const tokens = stripSuffixes(raw.replace(/,/g, ' ').split(/\s+/).filter(Boolean));
  if (tokens.length < 2 || tokens.length > 5) return false;
  return tokens.every(token => /^[A-Za-z][A-Za-z'\-.]*$/.test(token));
}

// "LAST, FIRST MIDDLE" or "FIRST MIDDLE LAST", suffixes (JR, III, CPA, DDS) removed. Null when not a person.
function stripSuffixTail(value: string): string {
  let out = value;
  for (;;) {
    const match = /,\s*([A-Za-z.]+)\s*$/.exec(out);
    if (!match || !(CORPORATE_SUFFIX.test(match[1]) || GENERATIONAL.test(match[1]))) return out;
    out = out.slice(0, match.index).trim();
  }
}

export function splitPersonName(value: unknown): SplitName | null {
  const cleaned = text(value, 200);
  if (!cleaned || !isPersonName(cleaned)) return null;
  const raw = stripSuffixTail(cleaned);
  if (raw.includes(',')) {
    const [lastPart, restPart] = raw.split(',', 2);
    const last = stripSuffixes(lastPart.trim().split(/\s+/));
    const rest = stripSuffixes(restPart.trim().split(/\s+/).filter(Boolean));
    if (last.length === 0 || rest.length === 0 || !rest[0]) return null;
    return { firstName: titleCase(rest[0].replace(/\.$/, '')), lastName: titleCase(last.join(' ')) };
  }
  const tokens = stripSuffixes(raw.split(/\s+/));
  if (tokens.length < 2) return null;
  return { firstName: titleCase(tokens[0].replace(/\.$/, '')), lastName: titleCase(tokens[tokens.length - 1]) };
}

export function personFromParts(first: unknown, last: unknown): SplitName | null {
  const firstName = text(first, 120), lastName = text(last, 120);
  if (!firstName || !lastName || /\d/.test(firstName + lastName)) return null;
  return { firstName: titleCase(stripSuffixes(firstName.split(/\s+/))[0].replace(/\.$/, '')), lastName: titleCase(stripSuffixes(lastName.split(/\s+/)).join(' ')) };
}

export function surnameInCompany(lastName: string | null, company: string | null): boolean {
  if (!lastName || !company) return false;
  return new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(company);
}

function emptyName(sourceRowId: string): NameRow {
  return { sourceRowId, firstName: null, lastName: null, company: null, titleCode: null, businessType: null, licenseIssueDate: null, licenseExpiresAt: null,
    issuingState: null, street: null, city: null, county: null, state: null, zip: null, phone10: null, email: null };
}
export function nameRow(sourceRowId: string, fields: Partial<NameRow>): NameRow { return { ...emptyName(sourceRowId), ...fields }; }

function omit(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) if (!keys.includes(key) && !key.startsWith(':@')) out[key] = value;
  return out;
}
function record(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function skip(rowKey: string, payload: Record<string, unknown>, reason: string): ParsedRow { return { rowKey, payload, name: null, skipReason: reason }; }
function keep(rowKey: string, payload: Record<string, unknown>, name: NameRow): ParsedRow { return { rowKey, payload, name, skipReason: null }; }
function num(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function str(value: unknown, fallback: string): string { return typeof value === 'string' ? value : fallback; }
function today(): string { return new Date().toISOString().slice(0, 10); }

// Split a "CITY, ST  12345" or "KATY TX 77450-2491" tail into its parts.
export function cityStateZip(value: unknown): { city: string | null; state: string | null; zip: string | null } {
  const raw = text(value, 200);
  if (!raw) return { city: null, state: null, zip: null };
  const match = /^(.*?)[,\s]+([A-Z]{2})[-\s]+(\d{5})(?:-?\d{4})?\s*$/i.exec(raw);
  if (!match) return { city: raw, state: null, zip: null };
  return { city: text(match[1].replace(/,$/, '')), state: match[2].toUpperCase(), zip: match[3] };
}

// ---------- Socrata ----------

interface SocrataSegment { where: string; select?: string; order?: string }
interface SocrataSpec {
  source: RegisterSource; state: string; label: string; recipe: Recipe; cadence: string; domain: string; dataset: string; pageSize: number;
  segments: SocrataSegment[];
  parseRow(row: Record<string, unknown>, segmentIndex: number): ParsedRow | null;
}

export function socrataUrl(domain: string, dataset: string, segment: SocrataSegment, limit: number, offset: number): string {
  const params = new URLSearchParams();
  if (segment.select) params.set('$select', segment.select);
  params.set('$where', segment.where);
  params.set('$order', segment.order ?? ':id');
  params.set('$limit', String(limit)); params.set('$offset', String(offset));
  const query = params.toString().replace(/\+/g, '%20').replace(/%24/g, '$').replace(/%2C/g, ',').replace(/%27/g, "'").replace(/%3A/g, ':').replace(/%3D/g, '=').replace(/%3E/g, '>').replace(/%3C/g, '<').replace(/%28/g, '(').replace(/%29/g, ')');
  return `https://${domain}/resource/${dataset}.json?${query}`;
}

function socrataAdapter(spec: SocrataSpec): RegisterAdapter {
  return {
    source: spec.source, state: spec.state, label: spec.label, recipe: spec.recipe, cadence: spec.cadence,
    initialCursor: () => ({ segment: 0, offset: 0 }),
    request(cursor) {
      const segment = num(cursor.segment, 0), offset = num(cursor.offset, 0);
      if (segment >= spec.segments.length) return null;
      const url = socrataUrl(spec.domain, spec.dataset, spec.segments[segment], spec.pageSize, offset);
      return { url, method: 'GET', headers: { Accept: 'application/json' }, body: null, kind: 'socrata' };
    },
    parse(response, cursor) {
      const segment = num(cursor.segment, 0), offset = num(cursor.offset, 0);
      let parsed: unknown;
      try { parsed = JSON.parse(response.text); } catch { throw new RegisterParseError('unexpected_content', 'Socrata returned a non-JSON body.'); }
      if (!Array.isArray(parsed)) throw new RegisterParseError('unexpected_content', 'Socrata returned a non-array body.');
      const rows: ParsedRow[] = [];
      for (const item of parsed) { const row = record(item); if (!row) continue; const out = spec.parseRow(row, segment); if (out) rows.push(out); }
      const exhausted = parsed.length < spec.pageSize;
      const next: Cursor = exhausted ? { segment: segment + 1, offset: 0 } : { segment, offset: offset + parsed.length };
      return { rows, next, done: exhausted && segment + 1 >= spec.segments.length, note: null };
    },
  };
}

export class RegisterParseError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

// ---------- byte-range CSV files ----------

interface CsvFile { url: string; hasHeader: boolean; label: string }
interface CsvSpec {
  source: RegisterSource; state: string; label: string; recipe: Recipe; cadence: string; chunkBytes: number; files: CsvFile[];
  headerStartsWith?: string;
  parseRecord(fields: string[], columns: string[] | null, fileIndex: number): ParsedRow | null;
}
export const CARRY_MAX = 65536;

export function parseContentRange(value: string | null): { start: number; end: number; total: number } | null {
  const match = value ? /bytes\s+(\d+)-(\d+)\/(\d+|\*)/.exec(value) : null;
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: match[3] === '*' ? -1 : Number(match[3]) };
}

function csvAdapter(spec: CsvSpec): RegisterAdapter {
  return {
    source: spec.source, state: spec.state, label: spec.label, recipe: spec.recipe, cadence: spec.cadence,
    initialCursor: () => ({ file: 0, offset: 0, carry: '', total: null, columns: null }),
    request(cursor) {
      const file = num(cursor.file, 0), offset = num(cursor.offset, 0);
      if (file >= spec.files.length) return null;
      return { url: spec.files[file].url, method: 'GET', headers: { Range: `bytes=${offset}-${offset + spec.chunkBytes - 1}`, Accept: 'text/csv,text/plain,*/*' }, body: null, kind: 'file' };
    },
    parse(response, cursor) {
      const file = num(cursor.file, 0), offset = num(cursor.offset, 0), carry = str(cursor.carry, '');
      let columns = Array.isArray(cursor.columns) ? cursor.columns.map(String) : null;
      const advance = (): Cursor => ({ file: file + 1, offset: 0, carry: '', total: null, columns: null });
      if (response.status === 416) return { rows: [], next: advance(), done: file + 1 >= spec.files.length, note: 'range_past_end' };
      if (response.contentType && /text\/html/i.test(response.contentType)) throw new RegisterParseError('unexpected_content', `${spec.files[file].label} answered with an HTML page instead of the CSV.`);
      const range = response.status === 206 ? parseContentRange(response.contentRange) : null;
      const total = range ? range.total : response.text.length;
      const received = range ? range.end - range.start + 1 : response.text.length;
      const finished = response.status !== 206 || total < 0 || offset + received >= total;
      const body = carry + response.text.replace(/^﻿/, '');
      const lines = body.split(/\r?\n/);
      let nextCarry = '';
      if (!finished) { nextCarry = lines.pop() ?? ''; if (nextCarry.length > CARRY_MAX) throw new RegisterParseError('unexpected_content', 'A CSV line exceeded the carry limit.'); }
      const rows: ParsedRow[] = [];
      let first = offset === 0 && carry === '';
      for (const line of lines) {
        if (!line.trim()) continue;
        if (first) {
          first = false;
          if (spec.headerStartsWith && !line.startsWith(spec.headerStartsWith)) throw new RegisterParseError('unexpected_content', `${spec.files[file].label} did not start with the expected header.`);
          if (spec.files[file].hasHeader) { columns = parseCsvLine(line).map(stripExcelGuard); continue; }
        }
        const out = spec.parseRecord(parseCsvLine(line).map(stripExcelGuard), columns, file);
        if (out) rows.push(out);
      }
      const next: Cursor = finished ? advance() : { file, offset: offset + received, carry: nextCarry, total, columns };
      return { rows, next, done: finished && file + 1 >= spec.files.length, note: response.status === 200 && offset === 0 ? 'server_ignored_range' : null };
    },
  };
}

function col(fields: string[], columns: string[] | null, name: string): string | null {
  if (!columns) return null;
  const index = columns.findIndex(column => column.toLowerCase() === name.toLowerCase());
  return index >= 0 ? text(fields[index]) : null;
}

// ---------- 1. WA L&I ----------

export const waLni = socrataAdapter({
  source: 'wa_lni', state: 'WA', label: 'WA L&I contractor licenses', recipe: 'D', cadence: 'daily', domain: 'data.wa.gov', dataset: 'm8qx-ubtq', pageSize: 5000,
  segments: [{ where: "statuscode='A'" }],
  parseRow(row) {
    const id = text(row.contractorlicensenumber, 80);
    if (!id) return null;
    const payload = { ...row };
    const individual = row.businesstypecodedesc === 'Individual';
    const person = individual ? splitPersonName(row.primaryprincipalname) : null;
    const name = nameRow(id, {
      firstName: person?.firstName ?? null, lastName: person?.lastName ?? null,
      company: individual && person ? (text(row.businessname) === text(row.primaryprincipalname) ? null : text(row.businessname)) : text(row.businessname),
      titleCode: individual ? 'Principal' : null, businessType: text(row.businesstypecodedesc, 80),
      licenseIssueDate: dateOf(row.licenseeffectivedate), licenseExpiresAt: dateOf(row.licenseexpirationdate), issuingState: 'WA',
      street: text(row.address1), city: text(row.city, 120), state: stateOf(row.state) ?? 'WA', zip: zip5(row.zip), phone10: phoneOf(row.phonenumber),
    });
    return keep(id, payload, name);
  },
});

// ---------- 2. OR CCB (lic_exp_date is text MM/DD/YYYY, so the future filter is ours) ----------

export const orCcb = socrataAdapter({
  source: 'or_ccb', state: 'OR', label: 'OR CCB active contractor licenses', recipe: 'D', cadence: 'daily', domain: 'data.oregon.gov', dataset: 'g77e-6bhs', pageSize: 5000,
  segments: [{ where: 'license_number IS NOT NULL' }],
  parseRow(row) {
    const id = text(row.license_number, 80);
    if (!id) return null;
    const expires = dateOf(row.lic_exp_date);
    if (!inFuture(expires, today())) return skip(id, { ...row }, 'expired');
    const person = splitPersonName(row.rmi_name);
    const soleProprietor = text(row.full_name)?.toUpperCase() === text(row.rmi_name)?.toUpperCase();
    return keep(id, { ...row }, nameRow(id, {
      firstName: person?.firstName ?? null, lastName: person?.lastName ?? null,
      company: soleProprietor ? null : text(row.full_name), titleCode: 'RMI', businessType: soleProprietor ? 'Sole Proprietor' : text(row.endorsement_text, 80),
      licenseIssueDate: dateOf(row.orig_regis_date), licenseExpiresAt: expires, issuingState: 'OR',
      street: text(row.address), city: text(row.city, 120), county: text(row.county_name, 120), state: stateOf(row.state) ?? 'OR', zip: zip5(row.zip_code), phone10: phoneOf(row.phone_number),
    }));
  },
});

// ---------- 3. CSLB (ASP.NET data portal; the __doPostBack POST was rejected with 503 by the WAF on 2026-09-21) ----------
// Steps: 0 GET the form (viewstate), 1 POST ddlStatus=M for the Master link, 2 stream Master, 3 POST P, 4 stream Personnel.
// Master rows carry the phone; Personnel rows name the people. The join is by LicenseNo through the payload of both
// (Sole Owner rows become person-level names with the Master phone when the Master row was seen in the same run).
export const CSLB_PORTAL = 'https://www.cslb.ca.gov/OnlineServices/DataPortal/ContractorList.aspx';
const CSLB_MASTER_COLUMNS = ['LicenseNo', 'LastUpdate', 'BusinessName', 'BusType', 'MailingAddress', 'City', 'State', 'County', 'ZIPCode', 'Country', 'BusinessPhone', 'IssueDate', 'ReissueDate', 'ExpirationDate', 'InactivationDate', 'ReactivationDate', 'PendingSuspension', 'PendingClassRemoval', 'PendingClassReplace', 'PrimaryStatus', 'SecondaryStatus', 'Classifications'];
const CSLB_PERSONNEL_COLUMNS = ['LicenseNo', 'PersonnelName', 'Title', 'AssocDate', 'DisassocDate', 'Classifications'];
const CSLB_TITLES: Record<string, string> = { 'SOLE OWNER': 'Sole Owner', 'RESPONSIBLE MANAGING OFFICER': 'RMO', RMO: 'RMO', 'RESPONSIBLE MANAGING EMPLOYEE': 'RME', RME: 'RME', PARTNER: 'Partner', 'GENERAL PARTNER': 'Partner', OFFICER: 'Officer', PRESIDENT: 'Officer', SECRETARY: 'Officer', TREASURER: 'Officer', 'VICE PRESIDENT': 'Officer', MEMBER: 'Member', MANAGER: 'Member', 'RESPONSIBLE MANAGING MEMBER': 'Member', 'RESPONSIBLE MANAGING MANAGER': 'Member' };

function cslbTitle(value: unknown): string | null {
  const raw = text(value, 80)?.toUpperCase();
  if (!raw) return null;
  if (CSLB_TITLES[raw]) return CSLB_TITLES[raw];
  for (const [key, code] of Object.entries(CSLB_TITLES)) if (raw.includes(key)) return code;
  return raw.slice(0, 80);
}

function viewstateFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION']) {
    const match = new RegExp(`name="${key}"[^>]*value="([^"]*)"`).exec(html);
    if (match) out[key] = match[1];
  }
  return out;
}

export function cslbMasterRow(fields: string[], columns: string[] | null): ParsedRow | null {
  const names = columns ?? CSLB_MASTER_COLUMNS;
  const id = col(fields, names, 'LicenseNo');
  if (!id) return null;
  const payload: Record<string, unknown> = { file: 'master' };
  names.forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  const status = (col(fields, names, 'PrimaryStatus') ?? '').toUpperCase();
  const expires = dateOf(col(fields, names, 'ExpirationDate'));
  if (status !== 'CLEAR') return skip(`M:${id}`, payload, 'status_not_clear');
  if (!inFuture(expires, today())) return skip(`M:${id}`, payload, 'expired');
  const business = col(fields, names, 'BusinessName');
  const busType = col(fields, names, 'BusType') ?? '';
  const person = /SOLE|INDIVIDUAL/i.test(busType) ? splitPersonName(business) : null;
  return keep(`M:${id}`, payload, nameRow(id, {
    firstName: person?.firstName ?? null, lastName: person?.lastName ?? null, company: person ? null : business,
    titleCode: person ? 'Sole Owner' : null, businessType: busType || null,
    licenseIssueDate: dateOf(col(fields, names, 'IssueDate')), licenseExpiresAt: expires, issuingState: 'CA',
    street: col(fields, names, 'MailingAddress'), city: col(fields, names, 'City'), county: col(fields, names, 'County'), state: stateOf(col(fields, names, 'State')) ?? 'CA',
    zip: zip5(col(fields, names, 'ZIPCode')), phone10: phoneOf(col(fields, names, 'BusinessPhone')),
  }));
}

export function cslbPersonnelRow(fields: string[], columns: string[] | null): ParsedRow | null {
  const names = columns ?? CSLB_PERSONNEL_COLUMNS;
  const id = col(fields, names, 'LicenseNo'), personnel = col(fields, names, 'PersonnelName');
  if (!id || !personnel) return null;
  const payload: Record<string, unknown> = { file: 'personnel' };
  names.forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  const title = cslbTitle(col(fields, names, 'Title'));
  const person = splitPersonName(personnel);
  const rowKey = `P:${id}:${personnel}`;
  if (col(fields, names, 'DisassocDate')) return skip(rowKey, payload, 'disassociated');
  if (!person) return skip(rowKey, payload, 'not_a_person');
  // The phone lives on the Master row; the service fills it from the same run's snapshot by LicenseNo.
  return keep(rowKey, { ...payload, joinLicenseNo: id }, nameRow(`${id}:${person.lastName}:${person.firstName}`.slice(0, 200), {
    firstName: person.firstName, lastName: person.lastName, titleCode: title, issuingState: 'CA', state: 'CA',
    licenseIssueDate: dateOf(col(fields, names, 'AssocDate')),
  }));
}

export const cslb: RegisterAdapter = {
  source: 'cslb', state: 'CA', label: 'CA CSLB license master and personnel', recipe: 'D', cadence: 'daily',
  initialCursor: () => ({ step: 0, offset: 0, carry: '', columns: null, form: null, links: null }),
  request(cursor) {
    const step = num(cursor.step, 0);
    const form = record(cursor.form) ?? {};
    const links = record(cursor.links) ?? {};
    const accept: Record<string, string> = { Accept: 'text/html,text/csv,*/*' };
    if (step === 0) return { url: CSLB_PORTAL, method: 'GET', headers: accept, body: null, kind: 'api' };
    if (step === 1 || step === 3) {
      const body = new URLSearchParams({ __EVENTTARGET: 'ctl00$MainContent$ddlStatus', __EVENTARGUMENT: '', __VIEWSTATE: str(form.__VIEWSTATE, ''), __VIEWSTATEGENERATOR: str(form.__VIEWSTATEGENERATOR, ''), __EVENTVALIDATION: str(form.__EVENTVALIDATION, ''), 'ctl00$MainContent$ddlStatus': step === 1 ? 'M' : 'P' });
      const headers: Record<string, string> = { ...accept, 'Content-Type': 'application/x-www-form-urlencoded', Referer: CSLB_PORTAL };
      return { url: CSLB_PORTAL, method: 'POST', headers, body: body.toString(), kind: 'api' };
    }
    const link = str(step === 2 ? links.master : links.personnel, '');
    if (step > 4 || !link) return null;
    const offset = num(cursor.offset, 0);
    return { url: link, method: 'GET', headers: { Range: `bytes=${offset}-${offset + 4 * 1024 * 1024 - 1}`, Accept: 'text/csv,*/*' }, body: null, kind: 'file' };
  },
  parse(response, cursor) {
    const step = num(cursor.step, 0);
    if (step === 0 || step === 1 || step === 3) {
      if (/Error 503|requested URL was rejected/i.test(response.text)) throw new RegisterParseError('portal_unavailable', 'The CSLB data portal rejected the request (503).');
      const form = viewstateFields(response.text);
      if (!form.__VIEWSTATE) throw new RegisterParseError('portal_unavailable', 'The CSLB data portal did not return its form.');
      const links = record(cursor.links) ?? {};
      if (step > 0) {
        const match = /id="MainContent_uplinks"[\s\S]*?href="([^"]+\.csv[^"]*)"/i.exec(response.text);
        if (!match) throw new RegisterParseError('portal_unavailable', 'The CSLB data portal did not expose the CSV link.');
        links[step === 1 ? 'master' : 'personnel'] = new URL(match[1].replace(/&amp;/g, '&'), CSLB_PORTAL).toString();
      }
      return { rows: [], next: { step: step + 1, offset: 0, carry: '', columns: null, form, links }, done: false, note: null };
    }
    const file = csvAdapter({ source: 'cslb', state: 'CA', label: '', recipe: 'D', cadence: '', chunkBytes: 4 * 1024 * 1024,
      files: [{ url: str((record(cursor.links) ?? {})[step === 2 ? 'master' : 'personnel'], ''), hasHeader: true, label: step === 2 ? 'CSLB Master' : 'CSLB Personnel' }],
      parseRecord: (fields, columns) => step === 2 ? cslbMasterRow(fields, columns) : cslbPersonnelRow(fields, columns) });
    const result = file.parse(response, { file: 0, offset: cursor.offset, carry: cursor.carry, columns: cursor.columns, total: null });
    const fileDone = num(result.next.file, 0) > 0;
    const next: Cursor = fileDone ? { step: step + 1, offset: 0, carry: '', columns: null, form: cursor.form, links: cursor.links } : { ...result.next, step, form: cursor.form, links: cursor.links };
    return { rows: result.rows, next, done: fileDone && step === 4, note: result.note };
  },
};

// ---------- 4. PA PALS (POST search, 50 rows per page, TotalRecords capped at 500 per surname) ----------

export const PALS_URL = 'https://www.pals.pa.gov/api/Search/SearchForPersonOrFacilty';
export const PALS_PROFESSIONS = ['Accountancy', 'Real Estate Commission'];
export const PALS_SURNAMES = ['SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'MILLER', 'DAVIS', 'GARCIA', 'RODRIGUEZ', 'WILSON', 'MARTINEZ', 'ANDERSON', 'TAYLOR', 'THOMAS', 'HERNANDEZ', 'MOORE', 'MARTIN', 'JACKSON', 'THOMPSON', 'WHITE', 'LOPEZ', 'LEE', 'GONZALEZ', 'HARRIS', 'CLARK', 'LEWIS', 'ROBINSON', 'WALKER', 'PEREZ', 'HALL', 'YOUNG', 'ALLEN', 'SANCHEZ', 'WRIGHT', 'KING', 'SCOTT', 'GREEN', 'BAKER', 'ADAMS', 'NELSON', 'HILL', 'RAMIREZ', 'CAMPBELL', 'MITCHELL', 'ROBERTS', 'CARTER', 'PHILLIPS', 'EVANS', 'TURNER', 'TORRES', 'PARKER', 'COLLINS', 'EDWARDS', 'STEWART', 'FLORES', 'MORRIS', 'NGUYEN', 'MURPHY', 'RIVERA', 'COOK', 'ROGERS', 'MORGAN', 'PETERSON', 'COOPER', 'REED', 'BAILEY', 'BELL', 'GOMEZ', 'KELLY', 'HOWARD', 'WARD', 'COX', 'DIAZ', 'RICHARDSON', 'WOOD', 'WATSON', 'BROOKS', 'BENNETT', 'GRAY', 'JAMES', 'REYES', 'CRUZ', 'HUGHES', 'PRICE', 'MYERS', 'LONG', 'FOSTER', 'SANDERS', 'ROSS', 'MORALES', 'POWELL', 'SULLIVAN', 'RUSSELL', 'ORTIZ', 'JENKINS', 'GUTIERREZ', 'PERRY', 'BUTLER', 'BARNES', 'FISHER', 'HENDERSON', 'COLEMAN', 'SIMMONS', 'PATTERSON', 'JORDAN', 'REYNOLDS', 'HAMILTON', 'GRAHAM', 'KIM', 'GONZALES', 'ALEXANDER', 'RAMOS', 'WALLACE', 'GRIFFIN', 'WEST', 'COLE', 'HAYES', 'CHAVEZ', 'GIBSON', 'BRYANT', 'ELLIS', 'STEVENS', 'MURRAY', 'FORD', 'MARSHALL', 'OWENS', 'MCDONALD', 'HARRISON', 'RUIZ', 'KENNEDY', 'WELLS', 'ALVAREZ', 'WOODS', 'MENDOZA', 'CASTILLO', 'OLSON', 'WEBB', 'WASHINGTON', 'TUCKER', 'FREEMAN', 'BURNS', 'HENRY', 'VARGAS', 'SNYDER', 'SIMPSON', 'CRAWFORD', 'JIMENEZ', 'PORTER', 'MASON', 'SHAW', 'GORDON', 'WAGNER', 'HUNTER', 'ROMERO', 'HICKS', 'DIXON', 'HUNT', 'PALMER', 'ROBERTSON', 'BLACK', 'HOLMES', 'STONE', 'MEYER', 'BOYD', 'MILLS', 'WARREN', 'FOX', 'ROSE', 'RICE', 'MORENO', 'SCHMIDT', 'PATEL', 'FERGUSON', 'NICHOLS', 'HERRERA', 'MEDINA', 'RYAN', 'FERNANDEZ', 'WEAVER', 'DANIELS', 'STEPHENS', 'GARDNER', 'PAYNE', 'KELLEY', 'DUNN', 'PIERCE', 'ARNOLD', 'TRAN', 'SPENCER', 'PETERS', 'HAWKINS', 'GRANT', 'HANSEN', 'CASTRO', 'HOFFMAN', 'HART', 'ELLIOTT', 'CUNNINGHAM', 'KNIGHT', 'BRADLEY', 'YODER', 'MILLER', 'STOLTZFUS', 'ZIMMERMAN', 'SNYDER', 'SHAFFER', 'KAUFFMAN', 'KELLER', 'HOOVER', 'WOLF', 'WOLFE', 'KLINE', 'BECK', 'SHUMAN', 'REESE', 'FRY', 'HOFFMAN', 'BAUER', 'BOYER', 'FISHER', 'KEMP', 'BECKER', 'HESS', 'SCHULTZ', 'SCHNEIDER', 'KING', 'BRENNAN', 'GALLAGHER', 'KEARNEY', 'MCCARTHY', 'OBRIEN', "O'BRIEN", 'DOYLE', 'BURKE', 'QUINN', 'MCGUIRE', 'DONNELLY', 'RUSSO', 'ROMANO', 'ESPOSITO', 'MARINO', 'FERRARO', 'RIZZO', 'GRECO', 'BRUNO', 'ROSSI', 'RICCI', 'CHEN', 'WANG', 'LI', 'ZHANG', 'LIU', 'YANG', 'HUANG', 'WU', 'ZHOU', 'XU', 'SUN', 'MA', 'ZHU', 'HU', 'GUO', 'LIN', 'HE', 'GAO', 'LUO', 'ZHENG', 'SINGH', 'KUMAR', 'SHAH', 'SHARMA', 'GUPTA', 'MEHTA', 'DESAI', 'JOSHI', 'REDDY', 'RAO', 'NAIR', 'VERMA', 'KAPOOR', 'MALHOTRA', 'CHOPRA', 'BHATT', 'JAIN', 'AGARWAL', 'IYER', 'MENON'];
const palsSurnames = [...new Set(PALS_SURNAMES)];

export const paPals: RegisterAdapter = {
  source: 'pa_pals', state: 'PA', label: 'PA PALS licensees (Accountancy, Real Estate)', recipe: 'C', cadence: 'weekly',
  initialCursor: () => ({ surname: 0, page: 1 }),
  request(cursor) {
    const surname = num(cursor.surname, 0), page = num(cursor.page, 1);
    if (surname >= palsSurnames.length) return null;
    return { url: PALS_URL, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ optPersonFacility: 'Person', lastName: palsSurnames[surname], professionID: '', pageNo: page }), kind: 'api' };
  },
  parse(response, cursor) {
    const surname = num(cursor.surname, 0), page = num(cursor.page, 1);
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { throw new RegisterParseError('unexpected_content', 'PALS returned a non-JSON body.'); }
    if (!Array.isArray(parsed)) throw new RegisterParseError('unexpected_content', 'PALS returned a non-array body.');
    const rows: ParsedRow[] = [];
    let totalRecords = 0;
    for (const item of parsed) {
      const row = record(item); if (!row) continue;
      totalRecords = Math.max(totalRecords, num(row.TotalRecords, 0));
      const id = text(row.LicenseNumber, 80); if (!id) continue;
      const payload = omit(row, ['RecaptchaResponse']);
      const profession = text(row.ProfessionType, 120) ?? '';
      if (!PALS_PROFESSIONS.includes(profession)) { rows.push(skip(id, payload, 'profession_out_of_scope')); continue; }
      if (row.Status !== 'Active') { rows.push(skip(id, payload, 'status_not_active')); continue; }
      const person = personFromParts(row.FirstName, row.LastName);
      if (!person) { rows.push(skip(id, payload, 'not_a_person')); continue; }
      const phone = phoneOf(row.PhoneNo1);
      rows.push(keep(id, payload, nameRow(id, {
        firstName: person.firstName, lastName: person.lastName, company: text(row.FacilityName) ?? text(row.DoingBusinessAs),
        titleCode: text(row.LicenceType, 80), businessType: profession, issuingState: 'PA',
        street: text(row.AddressLine1), city: text(row.City, 120), county: text(row.County, 120), state: stateOf(row.State) ?? 'PA', zip: zip5(row.zipcode),
        phone10: phone, email: emailOf(row.Emailid1),
      })));
    }
    const lastPage = parsed.length < 50 || page * 50 >= totalRecords;
    const next: Cursor = lastPage ? { surname: surname + 1, page: 1 } : { surname, page: page + 1 };
    return { rows, next, done: lastPage && surname + 1 >= palsSurnames.length, note: totalRecords >= 500 && lastPage ? 'total_records_capped_500' : null };
  },
};

// ---------- 5. FL DBPR construction and electrical (22 positional fields, no header, no phone in the extract) ----------
// Verified 2026-09-21: the statewide files carry name, DBA, address, status and dates only. The qualifier is the
// person; there is no phone column, so these rows are recipe B names until a phone source is joined.
export const FL_DBPR_FILES: CsvFile[] = [
  { url: 'https://www2.myfloridalicense.com/sto/file_download/extracts/CONSTRUCTIONLICENSE_1.csv', hasHeader: false, label: 'FL DBPR construction licenses' },
  { url: 'https://www2.myfloridalicense.com/sto/file_download/extracts/lic08el.csv', hasHeader: false, label: 'FL DBPR electrical licenses' },
];
export function flDbprRecord(fields: string[]): ParsedRow | null {
  if (fields.length < 21) return null;
  const [board, classCode, licensee, dba, , addr1, addr2, addr3, city, state, zip, countyCode, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, , , fullLicense] = fields;
  const id = text(fullLicense, 80) ?? (licenseNumber ? `${classCode}${licenseNumber}` : null);
  if (!id) return null;
  const payload = { board, classCode, licensee, dba, addr1, addr2, addr3, city, state, zip, countyCode, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, fullLicense };
  if (primaryStatus !== 'C') return skip(id, payload, 'status_not_current');
  if (secondaryStatus && secondaryStatus !== 'A') return skip(id, payload, 'secondary_status_inactive');
  const expires = dateOf(expiration);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const person = splitPersonName(licensee);
  return keep(id, payload, nameRow(id, {
    firstName: person?.firstName ?? null, lastName: person?.lastName ?? null, company: text(dba) ?? (person ? null : text(licensee)),
    titleCode: 'Qualifier', businessType: text(classCode, 80), licenseIssueDate: dateOf(originalDate) ?? dateOf(effectiveDate), licenseExpiresAt: expires, issuingState: 'FL',
    street: text(addr1), city: text(city, 120), county: text(countyCode, 120), state: stateOf(state) ?? 'FL', zip: zip5(zip),
  }));
}
export const flDbprConstruction = csvAdapter({ source: 'fl_dbpr_construction', state: 'FL', label: 'FL DBPR construction and electrical qualifiers', recipe: 'B', cadence: 'weekly', chunkBytes: 4 * 1024 * 1024, files: FL_DBPR_FILES, parseRecord: fields => flDbprRecord(fields) });

// ---------- 6. IRS PTIN per state ----------

export const PTIN_STATES = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'washington dc', 'west virginia', 'wisconsin', 'wyoming'];
export function ptinUrl(state: string): string { return `https://www.irs.gov/pub/foia/foia-${encodeURIComponent(state)}-extract.csv`; }
export function ptinRecord(fields: string[], columns: string[] | null, fileIndex: number): ParsedRow | null {
  const last = col(fields, columns, 'LAST_NAME'), first = col(fields, columns, 'First_NAME');
  if (!last || !first) return null;
  const zip = zip5(col(fields, columns, 'BUS_ADDR_ZIP'));
  const dba = col(fields, columns, 'DBA');
  const id = `${PTIN_STATES[fileIndex] ?? fileIndex}:${last}:${first}:${col(fields, columns, 'MIDDLE_NAME') ?? ''}:${zip ?? ''}`.toUpperCase().slice(0, 200);
  const payload: Record<string, unknown> = {};
  (columns ?? []).forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  const person = personFromParts(first, last);
  if (!person) return skip(id, payload, 'not_a_person');
  payload.dbaHasSurname = surnameInCompany(person.lastName, dba);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: dba, titleCode: col(fields, columns, 'PROFESSION') ?? 'Preparer', businessType: dba ? (payload.dbaHasSurname ? 'DBA (surname)' : 'DBA') : 'Individual',
    issuingState: null, street: col(fields, columns, 'BUS_ADDR_LINE1'), city: col(fields, columns, 'BUS_ADDR_CITY'), state: stateOf(col(fields, columns, 'BUS_ST_CODE')), zip,
    phone10: phoneOf(col(fields, columns, 'BUS_PHNE_NBR')),
  }));
}
export const irsPtin = csvAdapter({ source: 'irs_ptin', state: 'US', label: 'IRS PTIN holders (state extracts)', recipe: 'D', cadence: 'twice yearly', chunkBytes: 4 * 1024 * 1024, headerStartsWith: '"LAST_NAME"',
  files: PTIN_STATES.map(state => ({ url: ptinUrl(state), hasHeader: true, label: `IRS PTIN ${state}` })), parseRecord: ptinRecord });

// ---------- 7. FL DFS individual licensees (323 MB, Excel ="..." guards) ----------

export const FL_DFS_URL = 'https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesIndividual.csv';
export function flDfsRecord(fields: string[], columns: string[] | null): ParsedRow | null {
  const license = col(fields, columns, 'License Number');
  if (!license) return null;
  const payload: Record<string, unknown> = {};
  (columns ?? []).forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  const rowKey = `${license}:${col(fields, columns, 'License TYCL') ?? ''}`;
  if ((col(fields, columns, 'License Status') ?? '').toUpperCase() !== 'VALID') return skip(rowKey, payload, 'status_not_valid');
  const person = personFromParts(col(fields, columns, 'First Name'), col(fields, columns, 'Last Name'));
  if (!person) return skip(rowKey, payload, 'not_a_person');
  return keep(rowKey, payload, nameRow(license, {
    firstName: person.firstName, lastName: person.lastName, company: text(col(fields, columns, 'Business Address1')) && !/\d/.test(col(fields, columns, 'Business Address1') ?? '') ? col(fields, columns, 'Business Address1') : null,
    titleCode: col(fields, columns, 'License TYCL Desc'), businessType: col(fields, columns, 'Residency Type'), licenseIssueDate: dateOf(col(fields, columns, 'License Issue Date')), issuingState: 'FL',
    street: col(fields, columns, 'Business Address2') ?? col(fields, columns, 'Business Address1'), city: col(fields, columns, 'Business City')?.replace(/,$/, '') ?? null, county: col(fields, columns, 'Business County'),
    state: stateOf(col(fields, columns, 'Business State')) ?? 'FL', zip: zip5(col(fields, columns, 'Business Zip')), phone10: phoneOf(col(fields, columns, 'Business Phone')), email: emailOf(col(fields, columns, 'Email Address')),
  }));
}
export const flDfsIndividual = csvAdapter({ source: 'fl_dfs_individual', state: 'FL', label: 'FL DFS insurance licensees (individual)', recipe: 'D', cadence: 'nightly', chunkBytes: 4 * 1024 * 1024, headerStartsWith: '"License Number"',
  files: [{ url: FL_DFS_URL, hasHeader: true, label: 'FL DFS AllValidLicensesIndividual' }], parseRecord: flDfsRecord });

// ---------- 8. FMCSA census (per state x per filter segments keep every URL short and free of OR lists) ----------

export const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const FMCSA_FILTERS = ["crgo_household='X'", "upper(dba_name) like '%TREE%'", "upper(dba_name) like '%LANDSCAP%'", "upper(dba_name) like '%JUNK%'", "upper(dba_name) like '%HAUL%'"];
// Full rows (no $select): a $select list pushes the URL past the 300 character limit the catalog warns about.
export function fmcsaRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.dot_number, 80);
  if (!id) return null;
  const legal = text(row.legal_name)?.toUpperCase() ?? '', officer = text(row.company_officer_1)?.toUpperCase() ?? '';
  const soleProprietor = legal !== '' && legal === officer && text(row.business_org_desc)?.toUpperCase() === 'INDIVIDUAL';
  const person = splitPersonName(row.company_officer_1);
  const payload = { ...row, soleProprietor };
  if (!person) return skip(id, payload, 'officer_not_a_person');
  const phone = phoneOf(row.cell_phone) ?? phoneOf(row.phone);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: soleProprietor ? (text(row.dba_name) ?? null) : (text(row.dba_name) ?? text(row.legal_name)),
    titleCode: 'Company Officer 1', businessType: soleProprietor ? 'Sole Proprietor' : (text(row.business_org_desc, 80) ?? null),
    licenseIssueDate: dateOf(row.add_date), issuingState: null, street: text(row.phy_street), city: text(row.phy_city, 120), state: stateOf(row.phy_state), zip: zip5(row.phy_zip),
    phone10: phone, email: emailOf(row.email_address),
  }));
}
export const fmcsa = socrataAdapter({ source: 'fmcsa', state: 'US', label: 'FMCSA motor carrier census (movers, tree, junk, haul)', recipe: 'D', cadence: 'monthly', domain: 'data.transportation.gov', dataset: 'az4n-8mr2', pageSize: 5000,
  segments: US_STATES.flatMap(state => FMCSA_FILTERS.map(filter => ({ where: `status_code='A' AND phy_state='${state}' AND ${filter}` }))), parseRow: fmcsaRow });

// ---------- 9. Childcare homes: PA, NY (phone_number_omitted='Y' is an opt-out), TX ----------

export function paChildcareRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.master_provider_index, 80) ?? (row.mpi_id && row.mpi_location_id ? `${row.mpi_id}-${row.mpi_location_id}` : null);
  if (!id) return null;
  const payload = omit(row, ['geocoded_column', 'geocoded_column_1']);
  const person = personFromParts(row.responsible_person_first, row.responsible_person_last_name) ?? splitPersonName(row.legal_entity_name) ?? splitPersonName(row.facility_name);
  if (!person) return skip(id, payload, 'not_a_person');
  const legal = text(row.legal_entity_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: legal && !isPersonName(legal) ? legal : null,
    titleCode: text(row.responsible_person_title, 80) ?? 'Provider', businessType: text(row.provider_type, 80), licenseIssueDate: dateOf(row.license_issue_date), licenseExpiresAt: dateOf(row.license_exp_date), issuingState: 'PA',
    street: text(row.facility_address), city: text(row.facility_city, 120), county: text(row.facility_county, 120), state: stateOf(row.facility_state) ?? 'PA', zip: zip5(row.facility_zip_code),
    phone10: phoneOf(row.facility_phone), email: emailOf(row.facility_email),
  }));
}
export const paChildcare = socrataAdapter({ source: 'pa_childcare', state: 'PA', label: 'PA OCDEL child care homes', recipe: 'C', cadence: 'monthly', domain: 'data.pa.gov', dataset: 'ajn5-kaxt', pageSize: 5000,
  segments: [{ where: "provider_type='Family Child Care Home'" }, { where: "provider_type='Group Child Care Home'" }], parseRow: paChildcareRow });

export function nyChildcareRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.facility_id, 80);
  if (!id) return null;
  const payload = omit(row, ['georeference', 'additional_information']);
  if (row.phone_number_omitted === 'Y') return skip(id, payload, 'phone_omitted_opt_out');
  if (!['License', 'Registration'].includes(String(row.facility_status))) return skip(id, payload, 'status_not_active');
  const person = splitPersonName(row.provider_name);
  if (!person) return skip(id, payload, 'not_a_person');
  const facility = text(row.facility_name);
  const addressOmitted = row.address_omitted === 'Y';
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: facility && !isPersonName(facility.replace(',', ' ')) ? facility : null,
    titleCode: 'Provider', businessType: text(row.program_type, 80), licenseIssueDate: dateOf(row.license_issue_date), licenseExpiresAt: dateOf(row.license_expiration_date), issuingState: 'NY',
    street: addressOmitted ? null : text([row.street_number, row.street_name].filter(Boolean).join(' ')), city: text(row.city, 120), county: text(row.county, 120), state: stateOf(row.state) ?? 'NY', zip: zip5(row.zip_code),
    phone10: phoneOf(row.phone_number),
  }));
}
export const nyChildcare = socrataAdapter({ source: 'ny_childcare', state: 'NY', label: 'NY OCFS family day care (GFDC, FDC)', recipe: 'C', cadence: 'daily', domain: 'data.ny.gov', dataset: 'cb42-qumz', pageSize: 5000,
  segments: [{ where: "program_type='GFDC'" }, { where: "program_type='FDC'" }], parseRow: nyChildcareRow });

export function txChildcareRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.operation_id, 80) ?? text(row.operation_number, 80);
  if (!id) return null;
  const payload = omit(row, ['location_address_geo']);
  if (row.temporarily_closed === 'YES' || row.operation_status === 'N') return skip(id, payload, 'closed');
  const operation = text(row.operation_name);
  // A center's administrator may be an employee. Do not promote that role into
  // the owner-candidate inventory when the registered provider is an organization.
  const person = splitPersonName(operation);
  if (!person) return skip(id, payload, 'owner_identity_unresolved');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: operation && !isPersonName(operation) ? operation : null,
    titleCode: 'Provider', businessType: text(row.operation_type, 80), licenseIssueDate: dateOf(row.issuance_date), issuingState: 'TX',
    street: text(row.address_line), city: text(row.city, 120), county: text(row.county, 120), state: stateOf(row.state) ?? 'TX', zip: zip5(String(row.zipcode ?? '').split(' ')[0]),
    phone10: phoneOf(row.phone_number), email: emailOf(row.email_address),
  }));
}
export const txChildcare = socrataAdapter({ source: 'tx_childcare', state: 'TX', label: 'TX HHSC child care homes', recipe: 'C', cadence: 'daily', domain: 'data.texas.gov', dataset: 'bc5r-88dy', pageSize: 5000,
  segments: [{ where: "operation_type='Licensed Child-Care Home'" }, { where: "operation_type='Registered Child-Care Home'" }, { where: "operation_type='Listed Family Home'" }], parseRow: txChildcareRow });

// ---------- 10. NY attorneys ----------

export function nyAttorneyRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.registration_number, 80);
  if (!id) return null;
  const payload = { ...row };
  if (row.status !== 'Currently registered') return skip(id, payload, 'status_not_registered');
  if (stateOf(row.state) !== 'NY') return skip(id, payload, 'state_out_of_scope');
  const person = personFromParts(row.first_name, row.last_name);
  if (!person) return skip(id, payload, 'not_a_person');
  const firm = text(row.company_name);
  payload.surnameInFirm = surnameInCompany(person.lastName, firm);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: firm, titleCode: payload.surnameInFirm ? 'Named Partner' : 'Attorney', businessType: firm ? 'Firm' : 'Solo',
    licenseIssueDate: /^\d{4}$/.test(String(row.year_admitted)) ? `${row.year_admitted}-01-01` : null, issuingState: 'NY',
    street: text(row.street_1), city: text(row.city, 120), county: text(row.county, 120), state: stateOf(row.state), zip: zip5(row.zip), phone10: phoneOf(row.phone_number),
  }));
}
export const nyAttorneys = socrataAdapter({ source: 'ny_attorneys', state: 'NY', label: 'NY attorney registrations (currently registered, NY address)', recipe: 'D', cadence: 'quarterly', domain: 'data.ny.gov', dataset: 'eqw2-r5nb', pageSize: 5000,
  segments: [{ where: "status='Currently registered' AND state='NY'" }], parseRow: nyAttorneyRow });

// ---------- 11. TX TDLR mini establishments (owner_telephone mirrors business_telephone; owner_name is the licensee label) ----------

export function txTdlrSalonRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_number, 80);
  if (!id) return null;
  const payload: Record<string, unknown> = omit(row, ['business_mailing']);
  const business = text(row.business_telephone), owner = text(row.owner_telephone);
  // Trap assertion: the register captured one number per licensee. A differing owner_telephone is recorded as a flag, never as a second phone.
  payload.ownerTelephoneMirrorsBusiness = !owner || owner === business;
  payload.ownerNameMirrorsBusiness = text(row.owner_name) === text(row.business_name);
  const expires = dateOf(row.license_expiration_date_mmddccyy);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const businessName = text(row.business_name);
  const person = splitPersonName(businessName);
  const location = cityStateZip(row.business_city_state_zip);
  const mailing = cityStateZip(row.mailing_address_city_state_zip);
  return keep(id, payload, nameRow(id, {
    firstName: person?.firstName ?? null, lastName: person?.lastName ?? null, company: person ? null : businessName,
    titleCode: person ? 'Licensee' : null, businessType: text(row.license_type, 80), licenseExpiresAt: expires, issuingState: 'TX',
    street: text(row.business_address_line1), city: location.city, county: text(row.business_county, 120), state: location.state ?? 'TX', zip: location.zip ?? mailing.zip,
    phone10: phoneOf(business),
  }));
}
export const txTdlrSalons = socrataAdapter({ source: 'tx_tdlr_salons', state: 'TX', label: 'TX TDLR mini establishments (salon suites)', recipe: 'D', cadence: 'daily', domain: 'data.texas.gov', dataset: '7358-krk7', pageSize: 5000,
  segments: [{ where: "license_type='Mini Establishment'" }], parseRow: txTdlrSalonRow });

// ---------- 12. Short term rentals: New Orleans, Orlando ----------

export function nolaStrRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_number, 80) ?? text(row.reference_code, 80);
  if (!id) return null;
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) if (!key.startsWith(':@') && key !== 'location') payload[key] = value;
  if (!['Issued', 'Pending'].includes(String(row.current_status))) return skip(id, payload, 'status_not_active');
  const person = splitPersonName(row.contact_name) ?? splitPersonName(row.license_holder_name);
  if (!person) return skip(id, payload, 'not_a_person');
  const holder = text(row.license_holder_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: holder && !isPersonName(holder) ? holder : null,
    titleCode: isPersonName(row.contact_name) ? 'Contact' : 'License Holder', businessType: text(row.license_type, 80),
    licenseIssueDate: dateOf(row.issue_date), licenseExpiresAt: dateOf(row.expiration_date), issuingState: 'LA', street: text(row.address), city: 'New Orleans', state: 'LA',
    phone10: phoneOf(row.contact_phone), email: emailOf(row.contact_email),
  }));
}
export const nolaStr = socrataAdapter({ source: 'nola_str', state: 'LA', label: 'New Orleans short term rental permits', recipe: 'C', cadence: 'daily', domain: 'data.nola.gov', dataset: 'en36-xvxg', pageSize: 5000,
  segments: [{ where: "current_status='Issued'" }, { where: "current_status='Pending'" }], parseRow: nolaStrRow });

export function orlandoStrRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_number, 80);
  if (!id) return null;
  const payload = { ...row };
  if (row.license_status !== 'Active') return skip(id, payload, 'status_not_active');
  const person = splitPersonName(row.license_holder_name);
  if (!person) return skip(id, payload, 'not_a_person');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, titleCode: 'License Holder', businessType: 'Short Term Rental',
    licenseIssueDate: dateOf(row.issued_date) ?? dateOf(row.license_date), licenseExpiresAt: dateOf(row.expire_date), issuingState: 'FL',
    street: text(row.property_owner_address1) ?? text(row.property_address), city: text(row.property_owner_city, 120) ?? 'Orlando', state: stateOf(row.property_owner_state) ?? 'FL', zip: zip5(row.property_owner_zip),
    phone10: phoneOf(row.license_holder_phone), email: emailOf(row.license_holder_email),
  }));
}
export const orlandoStr = socrataAdapter({ source: 'orlando_str', state: 'FL', label: 'Orlando short term rental licenses', recipe: 'C', cadence: 'weekly', domain: 'data.cityoforlando.net', dataset: 'ssrj-rbua', pageSize: 5000,
  segments: [{ where: "license_status='Active'" }], parseRow: orlandoStrRow });

// ---------- 13. MN DLI CSVs (Master level only; an unknown category answers 200 with an HTML error page) ----------

export const MN_DLI_CATEGORIES = ['Electrical', 'Plumbing'];
export function mnDliUrl(category: string): string { return `https://secure.doli.state.mn.us/ccld/data/MNDLILicRegCertExport_${category}.csv`; }
export function mnDliRecord(fields: string[], columns: string[] | null): ParsedRow | null {
  const id = col(fields, columns, 'Lic_Number');
  if (!id) return null;
  const payload: Record<string, unknown> = {};
  (columns ?? []).forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  const subtype = col(fields, columns, 'License_Subtype') ?? '';
  if (!/master/i.test(subtype)) return skip(id, payload, 'not_master_level');
  if ((col(fields, columns, 'Status') ?? '').toLowerCase() !== 'issued') return skip(id, payload, 'status_not_issued');
  const expires = dateOf(col(fields, columns, 'Exp_Date'));
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const name = col(fields, columns, 'Name');
  const person = col(fields, columns, 'Bus_Pers') === 'Personal' ? (splitPersonName(name) ?? null) : null;
  return keep(id, payload, nameRow(id, {
    firstName: person?.firstName ?? null, lastName: person?.lastName ?? null, company: person ? col(fields, columns, 'DBA_Name') : (col(fields, columns, 'DBA_Name') ?? name),
    titleCode: subtype.slice(0, 80), businessType: col(fields, columns, 'Bus_Pers'), licenseIssueDate: dateOf(col(fields, columns, 'Orig_Date')), licenseExpiresAt: expires, issuingState: 'MN',
    street: col(fields, columns, 'Addr1'), city: col(fields, columns, 'City'), state: stateOf(col(fields, columns, 'St')) ?? 'MN', zip: zip5(col(fields, columns, 'Zip')),
    phone10: phoneOf(col(fields, columns, 'Phone_No')), email: emailOf(col(fields, columns, 'Email_Address')),
  }));
}
export const mnDli = csvAdapter({ source: 'mn_dli', state: 'MN', label: 'MN DLI licenses (Master level)', recipe: 'D', cadence: 'weekly', chunkBytes: 2 * 1024 * 1024, headerStartsWith: 'Bus_Pers,',
  files: MN_DLI_CATEGORIES.map(category => ({ url: mnDliUrl(category), hasHeader: true, label: `MN DLI ${category}` })), parseRecord: mnDliRecord });

// ---------- Austin permits, last 12 months with a contractor phone ----------

export function austinSince(now: Date = new Date()): string { const d = new Date(now); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); }
export function austinPermitRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.permit_number, 80);
  if (!id) return null;
  const payload = omit(row, ['link']);
  const person = splitPersonName(row.contractor_full_name);
  if (!person) return skip(id, payload, 'not_a_person');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: text(row.contractor_company_name), titleCode: 'Permit Contractor', businessType: text(row.contractor_trade, 80),
    licenseIssueDate: dateOf(row.issue_date), issuingState: 'TX', street: text(row.contractor_address1), city: text(row.contractor_city, 120), state: 'TX', zip: zip5(row.contractor_zip) ?? zip5(row.original_zip),
    phone10: phoneOf(row.contractor_phone),
  }));
}
export const austinPermits = socrataAdapter({ source: 'austin_permits', state: 'TX', label: 'Austin construction permits (last 12 months, contractor phone)', recipe: 'D', cadence: 'daily', domain: 'data.austintexas.gov', dataset: '3syk-w9eu', pageSize: 5000,
  // The $select is the minimum the names row needs so the page URL stays under 300 characters.
  segments: [{ where: `issue_date>'${austinSince()}' AND contractor_phone IS NOT NULL`, select: 'permit_number,contractor_trade,contractor_company_name,contractor_full_name,contractor_phone,contractor_zip,issue_date' }],
  parseRow: austinPermitRow });

// ---------- NPPES NPI-2 authorized officials (API; skip ceiling 1,000, limit 200, state alone refused, primary taxonomy client side) ----------

export const NPPES_API = 'https://npiregistry.cms.hhs.gov/api/';
export const NPPES_TAXONOMIES = ['Chiropractor', 'Podiatrist', 'Optometrist', 'Dentist', 'Physical Therapist', 'Mental Health'];
export const NPPES_LIMIT = 200, NPPES_SKIP_MAX = 1000;
export const NPPES_EXCLUDED_TITLE = /credential|billing|office manager|practice manager|administrator|coordinator/i;
const ZIP3_RANGES: Record<string, Array<[number, number]>> = {
  AL: [[350, 369]], AK: [[995, 999]], AZ: [[850, 865]], AR: [[716, 729]], CA: [[900, 961]], CO: [[800, 816]], CT: [[60, 69]], DE: [[197, 199]], DC: [[200, 205]], FL: [[320, 349]],
  GA: [[300, 319], [398, 399]], HI: [[967, 968]], ID: [[832, 838]], IL: [[600, 629]], IN: [[460, 479]], IA: [[500, 528]], KS: [[660, 679]], KY: [[400, 427]], LA: [[700, 714]], ME: [[39, 49]],
  MD: [[206, 219]], MA: [[10, 27], [55, 55]], MI: [[480, 499]], MN: [[550, 567]], MS: [[386, 397]], MO: [[630, 658]], MT: [[590, 599]], NE: [[680, 693]], NV: [[889, 898]], NH: [[30, 38]],
  NJ: [[70, 89]], NM: [[870, 884]], NY: [[5, 5], [100, 149]], NC: [[270, 289]], ND: [[580, 588]], OH: [[430, 459]], OK: [[730, 749]], OR: [[970, 979]], PA: [[150, 196]], RI: [[28, 29]],
  SC: [[290, 299]], SD: [[570, 577]], TN: [[370, 385]], TX: [[750, 799], [885, 885]], UT: [[840, 847]], VT: [[50, 59]], VA: [[201, 201], [220, 246]], WA: [[980, 994]], WV: [[247, 268]], WI: [[530, 549]], WY: [[820, 831]],
};
export function zip3Prefixes(state: string): string[] {
  const out: string[] = [];
  for (const [lo, hi] of ZIP3_RANGES[state] ?? []) for (let value = lo; value <= hi; value++) out.push(String(value).padStart(3, '0'));
  return out;
}
export const NPPES_STATES = Object.keys(ZIP3_RANGES);

export function nppesUrl(state: string, prefix: string, taxonomy: string, skip: number): string {
  const params = new URLSearchParams({ version: '2.1', enumeration_type: 'NPI-2', address_purpose: 'LOCATION', state, postal_code: `${prefix}*`, taxonomy_description: taxonomy, limit: String(NPPES_LIMIT), skip: String(skip) });
  return `${NPPES_API}?${params.toString().replace(/\+/g, '%20')}`;
}

export function nppesOrganization(item: Record<string, unknown>, taxonomy: string | null): ParsedRow | null {
  const npi = text(item.number, 80);
  const basic = record(item.basic);
  if (!npi || !basic) return null;
  const taxonomies = Array.isArray(item.taxonomies) ? item.taxonomies.map(record).filter((entry): entry is Record<string, unknown> => entry !== null) : [];
  const primary = taxonomies.find(entry => entry.primary === true) ?? null;
  const addresses = Array.isArray(item.addresses) ? item.addresses.map(record).filter((entry): entry is Record<string, unknown> => entry !== null) : [];
  const location = addresses.find(entry => entry.address_purpose === 'LOCATION') ?? addresses[0] ?? null;
  const payload = {
    number: npi, organization_name: basic.organization_name, status: basic.status, enumeration_date: basic.enumeration_date, last_updated: basic.last_updated,
    authorized_official_first_name: basic.authorized_official_first_name, authorized_official_last_name: basic.authorized_official_last_name,
    authorized_official_title_or_position: basic.authorized_official_title_or_position, authorized_official_telephone_number: basic.authorized_official_telephone_number,
    authorized_official_credential: basic.authorized_official_credential, primary_taxonomy: primary?.desc ?? null, primary_taxonomy_code: primary?.code ?? null,
    location_phone: location?.telephone_number ?? null, location: location ? { address_1: location.address_1, city: location.city, state: location.state, postal_code: location.postal_code } : null,
    taxonomy_query: taxonomy,
  };
  if (basic.status !== 'A') return skip(npi, payload, 'status_not_active');
  if (taxonomy !== null && (!primary || !String(primary.desc ?? '').toLowerCase().includes(taxonomy.toLowerCase()))) return skip(npi, payload, 'primary_taxonomy_mismatch');
  const title = text(basic.authorized_official_title_or_position, 80);
  if (title && NPPES_EXCLUDED_TITLE.test(title)) return skip(npi, payload, 'staff_title_excluded');
  const person = personFromParts(basic.authorized_official_first_name, basic.authorized_official_last_name);
  if (!person) return skip(npi, payload, 'not_a_person');
  return keep(npi, payload, nameRow(npi, {
    firstName: person.firstName, lastName: person.lastName, company: text(basic.organization_name), titleCode: title ?? 'Authorized Official', businessType: taxonomy ? `Organization (NPI-2): ${taxonomy}`.slice(0, 80) : 'Organization (NPI-2)',
    licenseIssueDate: dateOf(basic.enumeration_date), issuingState: null, street: text(location?.address_1), city: text(location?.city, 120), state: stateOf(location?.state),
    zip: zip5(String(location?.postal_code ?? '').slice(0, 5)), phone10: phoneOf(basic.authorized_official_telephone_number),
  }));
}

export const nppes: RegisterAdapter = {
  source: 'nppes', state: 'US', label: 'NPPES NPI-2 authorized officials (healthcare contrast)', recipe: 'D', cadence: 'weekly',
  initialCursor: () => ({ state: 0, prefix: 0, taxonomy: 0, skip: 0, ceilingHits: 0 }),
  request(cursor) {
    const stateIndex = num(cursor.state, 0), prefixIndex = num(cursor.prefix, 0), taxonomyIndex = num(cursor.taxonomy, 0), skip = num(cursor.skip, 0);
    if (stateIndex >= NPPES_STATES.length) return null;
    const state = NPPES_STATES[stateIndex], prefixes = zip3Prefixes(state);
    if (prefixIndex >= prefixes.length || taxonomyIndex >= NPPES_TAXONOMIES.length || skip > NPPES_SKIP_MAX) return null;
    return { url: nppesUrl(state, prefixes[prefixIndex], NPPES_TAXONOMIES[taxonomyIndex], skip), method: 'GET', headers: { Accept: 'application/json' }, body: null, kind: 'api' };
  },
  parse(response, cursor) {
    const stateIndex = num(cursor.state, 0), prefixIndex = num(cursor.prefix, 0), taxonomyIndex = num(cursor.taxonomy, 0), skip = num(cursor.skip, 0);
    let ceilingHits = num(cursor.ceilingHits, 0);
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { throw new RegisterParseError('unexpected_content', 'NPPES returned a non-JSON body.'); }
    const body = record(parsed);
    if (!body) throw new RegisterParseError('unexpected_content', 'NPPES returned a non-object body.');
    if (Array.isArray(body.Errors) && body.Errors.length > 0) throw new RegisterParseError('nppes_refused', String((record(body.Errors[0]) ?? {}).description ?? 'NPPES refused the query.'));
    const results = Array.isArray(body.results) ? body.results : [];
    const taxonomy = NPPES_TAXONOMIES[taxonomyIndex];
    const rows: ParsedRow[] = [];
    for (const item of results) { const row = record(item); if (!row) continue; const out = nppesOrganization(row, taxonomy); if (out) rows.push(out); }
    const prefixes = zip3Prefixes(NPPES_STATES[stateIndex]);
    let note: string | null = null;
    let next: Cursor;
    if (results.length >= NPPES_LIMIT && skip + NPPES_LIMIT <= NPPES_SKIP_MAX) next = { state: stateIndex, prefix: prefixIndex, taxonomy: taxonomyIndex, skip: skip + NPPES_LIMIT, ceilingHits };
    else {
      if (results.length >= NPPES_LIMIT) { ceilingHits += 1; note = 'skip_ceiling_reached'; }
      const nextTaxonomy = taxonomyIndex + 1;
      if (nextTaxonomy < NPPES_TAXONOMIES.length) next = { state: stateIndex, prefix: prefixIndex, taxonomy: nextTaxonomy, skip: 0, ceilingHits };
      else if (prefixIndex + 1 < prefixes.length) next = { state: stateIndex, prefix: prefixIndex + 1, taxonomy: 0, skip: 0, ceilingHits };
      else next = { state: stateIndex + 1, prefix: 0, taxonomy: 0, skip: 0, ceilingHits };
    }
    return { rows, next, done: num(next.state, 0) >= NPPES_STATES.length, note };
  },
};


// ---------- Phase 4 recipe B name sources ----------
// These registers name the owner but print no phone. The runner's parcel step turns the name into a home
// address (or the file already carries one), and the skip trace turns the address into a cell. Owner vs
// employee (01_MERGED_ARCHITECTURE §2) is decided here, at parse time, in title_code / business_type.

// "LAST FIRST MIDDLE" without a comma (NY DOS holders): first token is the surname. With a comma or a
// company word the general splitter decides.
export function splitLastFirstName(value: unknown): SplitName | null {
  const cleaned = text(value, 200);
  if (!cleaned || !isPersonName(cleaned)) return null;
  if (cleaned.includes(',')) return splitPersonName(cleaned);
  const tokens = stripSuffixes(cleaned.split(/\s+/));
  if (tokens.length < 2) return null;
  return { firstName: titleCase(tokens[1].replace(/\.$/, '')), lastName: titleCase(tokens[0]) };
}
const addressKey = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Recipe B never traces a surname with an initial for a first name (do-not-build list: "skip tracing a surname without a first name").
export function traceablePerson(person: SplitName | null): SplitName | null {
  return person && person.firstName.replace(/\W/g, '').length >= 2 ? person : null;
}

// 19. FL DBPR real estate brokers (RE_rgn1..7, 23 positional fields, no header). Anas: BK Broker, Current, Active,
// Florida address; the file street is the broker's own address, so the parcel step is skipped (brain skip_if).
export const FL_DBPR_EXTRACTS = 'https://www2.myfloridalicense.com/sto/file_download/extracts/';
export const FL_RE_FILES: CsvFile[] = [1, 2, 3, 4, 5, 6, 7].map(region => ({ url: `${FL_DBPR_EXTRACTS}RE_rgn${region}.csv`, hasHeader: false, label: `FL DBPR real estate region ${region}` }));
export const FL_PM_PATTERN = /property m|rental|leasing|mgmt|management/i;
export function flReRecord(fields: string[]): ParsedRow | null {
  if (fields.length < 22) return null;
  const [, , licensee, dba, licenseType, addr1, , , city, state, zip, , county, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, fullLicense, , employer, employerLicense] = fields;
  // Sales associates and corporations are not recipe B names; only brokers are read (keeps the snapshot to the rows in scope).
  if (licenseType !== 'BK Broker') return null;
  const id = text(fullLicense, 80) ?? `BK${licenseNumber}`;
  const payload = { licensee, dba, licenseType, addr1, city, state, zip, county, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, employer, employerLicense, noEmployer: !text(employer) };
  if (primaryStatus !== 'Current') return skip(id, payload, 'status_not_current');
  if (secondaryStatus !== 'Active') return skip(id, payload, 'status_not_active');
  if (state !== 'FL') return skip(id, payload, 'out_of_state');
  const person = traceablePerson(licensee.includes(',') ? splitPersonName(licensee) : null);
  if (!person) return skip(id, payload, 'not_a_person');
  const propertyManagement = FL_PM_PATTERN.test(employer ?? '');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: text(employer) ?? text(dba),
    // A broker with no employer works for herself; one with an employer may be a hired broker of record.
    titleCode: text(employer) ? 'Broker' : 'Sole Broker', businessType: propertyManagement ? 'Broker: Property Management' : 'Broker',
    licenseIssueDate: dateOf(originalDate) ?? dateOf(effectiveDate), licenseExpiresAt: dateOf(expiration), issuingState: 'FL',
    street: text(addr1), city: text(city, 120), county: text(county, 120), state: 'FL', zip: zip5(zip),
  }));
}
export const flRe = csvAdapter({ source: 'fl_re', state: 'FL', label: 'FL DBPR real estate brokers (home street in file)', recipe: 'B', cadence: 'weekly', chunkBytes: 4 * 1024 * 1024, files: FL_RE_FILES, parseRecord: fields => flReRecord(fields) });

// 20. FL DBPR CPAs (lic01ac.csv, 22 positional fields: board 01, class AC = individual CPA, AD = firm). Verified 2026-09-21:
// same layout as the barbers file, 9.4 MB, byte ranges honoured; the street is the licensee's own, so parcel is skipped.
export function flDbprLicensee(fields: string[]): { classCode: string; licensee: string; addr1: string; addr2: string; city: string; state: string; zip: string; countyCode: string; licenseNumber: string; primaryStatus: string; secondaryStatus: string; originalDate: string; effectiveDate: string; expiration: string; fullLicense: string } | null {
  if (fields.length < 21) return null;
  const [, classCode, licensee, , , addr1, addr2, , city, state, zip, countyCode, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, , , fullLicense] = fields;
  return { classCode, licensee, addr1, addr2, city, state, zip, countyCode, licenseNumber, primaryStatus, secondaryStatus, originalDate, effectiveDate, expiration, fullLicense };
}
export function flCpaRecord(fields: string[]): ParsedRow | null {
  const row = flDbprLicensee(fields);
  if (!row || row.classCode !== 'AC') return null;
  const id = text(row.fullLicense, 80) ?? `AC${row.licenseNumber}`;
  const payload: Record<string, unknown> = { ...row };
  if (row.primaryStatus !== 'C') return skip(id, payload, 'status_not_current');
  if (row.secondaryStatus && row.secondaryStatus !== 'A') return skip(id, payload, 'secondary_status_inactive');
  const expires = dateOf(row.expiration);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  if (row.state !== 'FL') return skip(id, payload, 'out_of_state');
  const person = traceablePerson(row.licensee.includes(',') ? splitPersonName(row.licensee) : null);
  if (!person) return skip(id, payload, 'not_a_person');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, titleCode: 'CPA', businessType: 'CPA',
    licenseIssueDate: dateOf(row.originalDate) ?? dateOf(row.effectiveDate), licenseExpiresAt: expires, issuingState: 'FL',
    street: text(row.addr1), city: text(row.city, 120), county: text(row.countyCode, 120), state: 'FL', zip: zip5(row.zip),
  }));
}
export const flCpa = csvAdapter({ source: 'fl_cpa', state: 'FL', label: 'FL DBPR certified public accountants (home street in file)', recipe: 'B', cadence: 'weekly', chunkBytes: 4 * 1024 * 1024,
  files: [{ url: `${FL_DBPR_EXTRACTS}lic01ac.csv`, hasHeader: false, label: 'FL DBPR accountancy AC' }], parseRecord: fields => flCpaRecord(fields) });

// 21. FL DBPR barbers (lic03bb.csv). BS = barbershop: the owner's name sits in address line 1 on most rows and the
// shop street in line 2 (parcel needed). BB / BR = the barber: the file street is the practitioner's own (parcel skipped).
export function flBarberRecord(fields: string[]): ParsedRow | null {
  const row = flDbprLicensee(fields);
  if (!row) return null;
  const id = text(row.fullLicense, 80) ?? `${row.classCode}${row.licenseNumber}`;
  const payload: Record<string, unknown> = { ...row };
  if (!['BS', 'BB', 'BR'].includes(row.classCode)) return skip(id, payload, 'class_out_of_scope');
  if (row.primaryStatus !== 'C') return skip(id, payload, 'status_not_current');
  if (row.secondaryStatus && row.secondaryStatus !== 'A') return skip(id, payload, 'secondary_status_inactive');
  const expires = dateOf(row.expiration);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  if (row.state !== 'FL') return skip(id, payload, 'out_of_state');
  if (row.classCode === 'BS') {
    const owner = traceablePerson(row.addr1.includes(',') ? splitPersonName(row.addr1) : null);
    payload.ownerInAddressLine1 = owner !== null;
    if (!owner) return skip(id, payload, 'owner_not_named');
    return keep(id, payload, nameRow(id, {
      firstName: owner.firstName, lastName: owner.lastName, company: text(row.licensee), titleCode: 'Owner', businessType: 'Barbershop',
      licenseIssueDate: dateOf(row.originalDate) ?? dateOf(row.effectiveDate), licenseExpiresAt: expires, issuingState: 'FL',
      // The shop street is not a home: it stays in the payload; the parcel step finds the owner's address.
      street: null, city: text(row.city, 120), county: text(row.countyCode, 120), state: 'FL', zip: zip5(row.zip),
    }));
  }
  const person = traceablePerson(row.licensee.includes(',') ? splitPersonName(row.licensee) : null);
  if (!person) return skip(id, payload, 'not_a_person');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, titleCode: 'Barber', businessType: row.classCode === 'BR' ? 'Restricted Barber' : 'Barber',
    licenseIssueDate: dateOf(row.originalDate) ?? dateOf(row.effectiveDate), licenseExpiresAt: expires, issuingState: 'FL',
    street: text(row.addr1), city: text(row.city, 120), county: text(row.countyCode, 120), state: 'FL', zip: zip5(row.zip),
  }));
}
export const flDbprBarbers = csvAdapter({ source: 'fl_dbpr_barbers', state: 'FL', label: 'FL DBPR barbershops (owner in address block) and barbers (home street)', recipe: 'B', cadence: 'weekly', chunkBytes: 4 * 1024 * 1024,
  files: [{ url: `${FL_DBPR_EXTRACTS}lic03bb.csv`, hasHeader: false, label: 'FL DBPR barbers' }], parseRecord: fields => flBarberRecord(fields) });

// 22. TX TREC brokers (Socrata s7ft-44qi). Verified 2026-09-21: the rows.csv export exceeds 28 s; the JSON API pages in
// under a second and holds 33,442 active individual brokers. County only (no city, no street): parcel is Travis County.
export function txTrecRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_number, 80);
  if (!id) return null;
  const payload = { ...row };
  if (row.license_type !== 'Broker Individual') return skip(id, payload, 'license_type_out_of_scope');
  if (row.status !== 'Active') return skip(id, payload, 'status_not_active');
  const person = traceablePerson(personFromParts(row.first_name, row.last_name));
  if (!person) return skip(id, payload, 'not_a_person');
  const sponsor = text(row.related_license_full_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: sponsor, titleCode: row.designated_supervisor_flag === '1' ? 'Designated Broker' : 'Broker', businessType: 'Broker Individual',
    licenseIssueDate: dateOf(row.original_license_date), licenseExpiresAt: dateOf(row.license_expiration_date), issuingState: 'TX', county: text(row.county, 120), state: 'TX',
  }));
}
export const txTrec = socrataAdapter({ source: 'tx_trec', state: 'TX', label: 'TX TREC individual brokers (active)', recipe: 'B', cadence: 'daily', domain: 'data.texas.gov', dataset: 's7ft-44qi', pageSize: 5000,
  segments: [{ where: "license_type='Broker Individual' AND status='Active'" }], parseRow: txTrecRow });

// 23. AZ ADRE licensees (services.azre.gov DownloadList/1). Verified 2026-09-21: 50 MB, header row, the server ignores
// Range (one pass, note server_ignored_range). Brokers only; the mailing address is the employer's, so parcel is Maricopa.
export const AZ_ADRE_URL = 'https://services.azre.gov/PdbWeb/List/DownloadList/1';
export function azAdreRecord(fields: string[], columns: string[] | null): ParsedRow | null {
  const id = col(fields, columns, 'LicNumber');
  if (!id || col(fields, columns, 'LicType') !== 'Broker') return null;
  const payload: Record<string, unknown> = {};
  (columns ?? []).forEach((name, index) => { payload[name] = fields[index] ?? ''; });
  if (col(fields, columns, 'LicStatus') !== 'Active') return skip(id, payload, 'status_not_active');
  const person = traceablePerson(personFromParts(col(fields, columns, 'FirstName'), col(fields, columns, 'LastName')));
  if (!person) return skip(id, payload, 'not_a_person');
  const expires = dateOf(col(fields, columns, 'ExpireDate'));
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: col(fields, columns, 'EmployerLegalName'), titleCode: col(fields, columns, 'EmploymentType') ?? 'Broker', businessType: 'Broker',
    licenseIssueDate: dateOf(col(fields, columns, 'OriginalDate')), licenseExpiresAt: expires, issuingState: 'AZ',
    city: col(fields, columns, 'MailingCity'), county: col(fields, columns, 'MailingCounty'), state: stateOf(col(fields, columns, 'MailingState')) ?? 'AZ', zip: zip5(col(fields, columns, 'MailingZip')),
  }));
}
export const azAdre = csvAdapter({ source: 'az_adre', state: 'AZ', label: 'AZ ADRE brokers (active)', recipe: 'B', cadence: 'weekly', chunkBytes: 4 * 1024 * 1024, headerStartsWith: '"LastName"',
  files: [{ url: AZ_ADRE_URL, hasHeader: true, label: 'AZ ADRE licensee list' }], parseRecord: azAdreRecord });

// 24. IL IDFPR (Socrata pzzh-kp68): individual CPAs and real estate managing brokers, active. business='N' keeps people.
export const IL_IDFPR_PROFESSIONS = [{ description: 'LICENSED CERTIFIED PUBLIC ACCOUNTANT', businessType: 'CPA' }, { description: 'LICENSED REAL ESTATE MANAGING BROKER', businessType: 'Real Estate Managing Broker' }];
export function ilIdfprRow(row: Record<string, unknown>, segment: number): ParsedRow | null {
  const id = text(row.license_number, 80);
  if (!id) return null;
  const payload = { ...row };
  if (row.license_status !== 'ACTIVE') return skip(id, payload, 'status_not_active');
  if (row.business !== 'N') return skip(id, payload, 'business_row');
  const person = traceablePerson(personFromParts(row.first_name, row.last_name));
  if (!person) return skip(id, payload, 'not_a_person');
  const business = text(row.businessdba) ?? text(row.business_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: business && !isPersonName(business) ? business : null, titleCode: 'Licensee', businessType: IL_IDFPR_PROFESSIONS[segment]?.businessType ?? text(row.description, 80),
    licenseIssueDate: dateOf(row.original_issue_date) ?? dateOf(row.effective_date), licenseExpiresAt: dateOf(row.expiration_date), issuingState: 'IL',
    city: text(row.city, 120), county: text(row.county, 120), state: stateOf(row.state), zip: zip5(row.zip),
  }));
}
export const ilIdfpr = socrataAdapter({ source: 'il_idfpr', state: 'IL', label: 'IL IDFPR CPAs and managing brokers (individuals)', recipe: 'B', cadence: 'daily', domain: 'illinois-edp.data.socrata.com', dataset: 'pzzh-kp68', pageSize: 5000,
  segments: IL_IDFPR_PROFESSIONS.map(profession => ({ where: `license_status='ACTIVE' AND business='N' AND description='${profession.description}'` })), parseRow: ilIdfprRow });

// 25. NY DOS appearance enhancement and barber businesses (Socrata y3u4-jbgh): the holder is a person on 99.6% of rows,
// written LAST FIRST. Business and shop-owner licences name the owner; renter licences name a suite renter (her own business).
export const NY_SALON_TYPES: Record<string, { title: string; businessType: string }> = {
  DOSAEBUSINESS: { title: 'Owner', businessType: 'Appearance Enhancement Business' }, DOSBARSHOPOWNER: { title: 'Owner', businessType: 'Barbershop' },
  DOSAERENTER: { title: 'Suite Renter', businessType: 'Appearance Enhancement Renter' }, DOSBARRENTER: { title: 'Suite Renter', businessType: 'Barber Renter' },
};
export function nySalonRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_number, 80);
  if (!id) return null;
  const payload = omit(row, ['georeference']);
  const type = NY_SALON_TYPES[String(row.license_type)];
  if (!type) return skip(id, payload, 'license_type_out_of_scope');
  const expires = dateOf(row.license_expiration_date);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const person = traceablePerson(splitLastFirstName(row.license_holder_name));
  if (!person) return skip(id, payload, 'not_a_person');
  const business = text(row.business_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: business && !isPersonName(business) ? business : null, titleCode: type.title, businessType: type.businessType,
    licenseIssueDate: dateOf(row.license_issue_date), licenseExpiresAt: expires, issuingState: 'NY',
    street: text(row.business_address_1), city: text(row.business_city, 120), state: stateOf(row.business_state) ?? 'NY', zip: zip5(row.business_zip),
  }));
}
export const nySalons = socrataAdapter({ source: 'ny_salons', state: 'NY', label: 'NY DOS salons and barbershops (owner named)', recipe: 'B', cadence: 'daily', domain: 'data.ny.gov', dataset: 'y3u4-jbgh', pageSize: 5000,
  segments: [{ where: "license_type in('DOSAEBUSINESS','DOSBARSHOPOWNER','DOSAERENTER','DOSBARRENTER')" }], parseRow: nySalonRow });

// 26. NY DMV repair shops (Socrata nhjr-rpi2): expiration_date is text MM/DD/YYYY and lapsed shops stay in the file, so
// the active gate is the year in the text (catalog trap) plus a future check here.
export function nyRepairShopRow(row: Record<string, unknown>): ParsedRow | null {
  const facility = text(row.facility, 80), type = text(row.business_type, 10);
  if (!facility || !type) return null;
  const id = `${facility}:${type}`;
  const payload = omit(row, ['georeference']);
  if (!['RS', 'RSB'].includes(type)) return skip(id, payload, 'business_type_out_of_scope');
  const expires = dateOf(row.expiration_date);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const person = traceablePerson(splitPersonName(row.owner_name));
  if (!person) return skip(id, payload, 'not_a_person');
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: text([row.facility_name, row.facility_name_overflow].filter(Boolean).join(' ')), titleCode: 'Owner', businessType: type === 'RSB' ? 'Repair Shop (body)' : 'Repair Shop',
    licenseIssueDate: dateOf(row.origional_issuance_date), licenseExpiresAt: expires, issuingState: 'NY',
    street: text(row.facility_street), city: text(row.facility_city, 120), county: text(row.facility_county, 120), state: stateOf(row.facility_state) ?? 'NY', zip: zip5(row.facility_zip_code),
  }));
}
export const nyRepairShops = socrataAdapter({ source: 'ny_repair_shops', state: 'NY', label: 'NY DMV repair shops (owner named)', recipe: 'B', cadence: 'monthly', domain: 'data.ny.gov', dataset: 'nhjr-rpi2', pageSize: 5000,
  segments: ["'%2026'", "'%2027'", "'%2028'"].map(year => ({ where: `business_type in('RS','RSB') AND expiration_date like ${year}` })), parseRow: nyRepairShopRow });

// 27. TX TDI business relationships (Socrata kvqi-vsrr): the only register with explicit Owner / DRLP / Employee labels.
// Owner and designated responsible licensed person rows where the associated licensee is a person. No street; the
// individuals dataset (kxv3-diwf) adds city, state and ZIP in the ingest service, so the parcel step is Travis County.
export const TX_TDI_TYPES: Record<string, string> = { Owner: 'Owner', 'Desig-Resp-Lic-Person': 'DRLP' };
export function txTdiRow(row: Record<string, unknown>): ParsedRow | null {
  const npn = text(row.associated_licensee_npn, 40), agencyNpn = text(row.licensee_npn, 40);
  if (!npn || !agencyNpn) return null;
  const id = `${npn}:${agencyNpn}`;
  const payload = { ...row };
  const title = TX_TDI_TYPES[String(row.association_type)];
  if (!title) return skip(id, payload, 'association_type_out_of_scope');
  const person = traceablePerson(splitPersonName(row.associated_licensee_name));
  if (!person) return skip(id, payload, 'owner_is_entity');
  const agency = text(row.licensee_name);
  return keep(id, { ...payload, joinNpn: npn }, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: agency && agency.toUpperCase() !== String(row.associated_licensee_name).toUpperCase() ? agency : null,
    titleCode: title, businessType: 'Insurance Agency', licenseIssueDate: dateOf(row.association_begin_date), issuingState: 'TX', state: 'TX',
  }));
}
export const TX_TDI_INDIVIDUALS = 'kxv3-diwf';
export function txTdiIndividualsUrl(npns: readonly string[]): string {
  return `https://data.texas.gov/resource/${TX_TDI_INDIVIDUALS}.json?$select=npn,city,state,pstl_cd&$where=npn in(${npns.map(npn => `'${npn.replace(/[^0-9]/g, '')}'`).join(',')})&$limit=${npns.length * 4}`;
}
export const txTdi = socrataAdapter({ source: 'tx_tdi', state: 'TX', label: 'TX TDI agency owners and DRLPs (explicit owner label)', recipe: 'B', cadence: 'daily', domain: 'data.texas.gov', dataset: 'kvqi-vsrr', pageSize: 200,
  segments: [{ where: "association_type='Owner'" }, { where: "association_type='Desig-Resp-Lic-Person'" }], parseRow: txTdiRow });

// 28. TX TABC licences (Socrata 7hf9-qc9f): owner is a person on about two thirds of beer and wine rows; the phone column is
// empty across the file. A mailing address that differs from the premises is the research's home-address candidate.
export const TX_TABC_TYPES: Record<string, string> = { BG: 'Wine and Beer Retailer', BQ: 'Wine and Beer Retailer (off-premise)', NT: 'Nonprofit Temporary', MB: 'Mixed Beverage' };
export function txTabcRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.license_id, 80);
  if (!id) return null;
  const payload: Record<string, unknown> = { ...row };
  if (row.license_status !== 'Active') return skip(id, payload, 'status_not_active');
  const businessType = TX_TABC_TYPES[String(row.license_type)];
  if (!businessType) return skip(id, payload, 'license_type_out_of_scope');
  const person = traceablePerson(splitPersonName(row.owner));
  if (!person) return skip(id, payload, 'owner_is_entity');
  const mailDiffers = Boolean(text(row.mail_address)) && addressKey(row.mail_address) !== addressKey(row.address);
  payload.mailDiffersFromPremises = mailDiffers;
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: text(row.trade_name), titleCode: 'License Holder', businessType,
    licenseIssueDate: dateOf(row.original_issue_date), licenseExpiresAt: dateOf(row.expiration_date), issuingState: 'TX',
    // Only a mailing address away from the premises can be the owner's home; the premises street stays in the payload.
    street: mailDiffers ? text(row.mail_address) : null, city: text(mailDiffers ? row.mail_city : row.city, 120), county: text(row.county, 120),
    state: stateOf(mailDiffers ? row.mail_state : row.state) ?? 'TX', zip: zip5(String(mailDiffers ? row.mail_zip ?? '' : row.zip ?? '').slice(0, 5)),
  }));
}
export const txTabc = socrataAdapter({ source: 'tx_tabc', state: 'TX', label: 'TX TABC beer, wine and mixed beverage licences (owner named)', recipe: 'B', cadence: 'daily', domain: 'data.texas.gov', dataset: '7hf9-qc9f', pageSize: 5000,
  segments: Object.keys(TX_TABC_TYPES).map(type => ({ where: `license_status='Active' AND license_type='${type}'` })), parseRow: txTabcRow });

// 29. NY DOH food service establishments (Socrata cnih-y5dw, outside NYC): the permit operator is a person on 15,581 rows.
// Restaurants only; institutions and corporate operators are skipped.
export function nyDohFoodRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.nys_health_operation_id, 80);
  if (!id) return null;
  const payload = omit(row, ['location1', 'violations']);
  if (!/restaurant/i.test(String(row.description ?? ''))) return skip(id, payload, 'not_a_restaurant');
  const expires = dateOf(row.permit_expiration_date);
  if (!inFuture(expires, today())) return skip(id, payload, 'expired');
  const person = traceablePerson(personFromParts(row.perm_operator_first_name, row.perm_operator_last_name));
  if (!person || !isPersonName(`${row.perm_operator_first_name} ${row.perm_operator_last_name}`)) return skip(id, payload, 'operator_is_entity');
  const corp = text(row.permitted_corp_name);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: corp && !isPersonName(corp) ? corp : text(row.operation_name), titleCode: 'Operator', businessType: 'Restaurant',
    licenseExpiresAt: expires, issuingState: 'NY', street: text(row.facility_address), city: text(row.city, 120), county: text(row.county, 120), state: stateOf(row.food_service_facility_state) ?? 'NY', zip: zip5(row.zip_code),
  }));
}
export const nyDohFood = socrataAdapter({ source: 'ny_doh_food', state: 'NY', label: 'NY DOH restaurant permits (operator named, outside NYC)', recipe: 'B', cadence: 'monthly', domain: 'health.data.ny.gov', dataset: 'cnih-y5dw', pageSize: 5000,
  segments: [{ where: "perm_operator_last_name IS NOT NULL AND description like '%Restaurant%'" }], parseRow: nyDohFoodRow });

// 30. CO SOS business entities (Socrata 4ykn-tg5h): no officer table, but for micro LLCs the registered agent is the owner
// (5 of 5 in the lawn care sample) when the agent is a person and lives at the principal address. Agent services are
// excluded by agentorganizationname IS NULL; the surname-in-entity-name signal is recorded, not required.
export const CO_SOS_PATTERNS = ['MED SPA', 'MEDSPA', 'AESTHETIC', 'LASER', 'LANDSCAP', 'LAWN', 'CLEANING', 'TREE', 'JUNK', 'MOVING', 'PAINTING', 'PRESSURE'];
export function coSosAgentRow(row: Record<string, unknown>): ParsedRow | null {
  const id = text(row.entityid, 80);
  if (!id) return null;
  const payload: Record<string, unknown> = { ...row };
  if (row.entitystatus !== 'Good Standing') return skip(id, payload, 'status_not_good_standing');
  if (text(row.agentorganizationname)) return skip(id, payload, 'agent_is_organization');
  const person = traceablePerson(personFromParts(row.agentfirstname, row.agentlastname));
  if (!person) return skip(id, payload, 'not_a_person');
  if (!text(row.principaladdress1) || addressKey(row.agentprincipaladdress1) !== addressKey(row.principaladdress1)) return skip(id, payload, 'agent_address_differs');
  const entity = text(row.entityname);
  payload.surnameInEntity = surnameInCompany(person.lastName, entity);
  return keep(id, payload, nameRow(id, {
    firstName: person.firstName, lastName: person.lastName, company: entity, titleCode: payload.surnameInEntity ? 'Agent-Owner' : 'Registered Agent', businessType: text(row.entitytype, 80),
    licenseIssueDate: dateOf(row.entityformdate), issuingState: 'CO', street: text(row.principaladdress1), city: text(row.principalcity, 120), state: stateOf(row.principalstate) ?? 'CO', zip: zip5(row.principalzipcode),
  }));
}
export const coSosAgents = socrataAdapter({ source: 'co_sos_agents', state: 'CO', label: 'CO SOS entities with a person as registered agent at the principal address', recipe: 'B', cadence: 'daily', domain: 'data.colorado.gov', dataset: '4ykn-tg5h', pageSize: 5000,
  segments: CO_SOS_PATTERNS.map(pattern => ({ where: `entitystatus='Good Standing' AND agentorganizationname IS NULL AND upper(entityname) like '%${pattern}%'` })), parseRow: coSosAgentRow });

// 31. NPPES NPI-2 med spas by organisation name (engine.py names --source nppes --industry medspa): the same patterns,
// the same owner-title filter. Only 17% of med spas hold an NPI-2 (brain note), so this is one name path among several.
export const NPPES_MEDSPA_PATTERNS = ['*med spa*', '*medspa*', '*aesthetic*', '*laser*', '*rejuven*', '*glow*', '*botox*', '*skin*'];
// Clinical credentials and medical supervision alone do not establish ownership.
// Even explicit leadership titles are candidates requiring independent corroboration.
export const NPPES_OWNER_TITLE = /\b(owner|president|partner|principal|ceo|founder)\b/i;
export const NPPES_STAFF_TITLE = /office manager|practice manager|business manager|credential|billing|administrator|coordinator|bookkeep|consultant|accountant/i;
export function nppesMedspaUrl(state: string, pattern: string, skip: number): string {
  const params = new URLSearchParams({ version: '2.1', enumeration_type: 'NPI-2', state, organization_name: pattern, limit: String(NPPES_LIMIT), skip: String(skip) });
  return `${NPPES_API}?${params.toString().replace(/\+/g, '%20')}`;
}
export function nppesMedspaOrganization(item: Record<string, unknown>): ParsedRow | null {
  const row = nppesOrganization(item, null);
  if (!row || !row.name) return row;
  const title = row.name.titleCode ?? '';
  if (!NPPES_OWNER_TITLE.test(title) || NPPES_STAFF_TITLE.test(title)) return skip(row.rowKey, row.payload, 'title_not_owner');
  return { ...row, name: { ...row.name, businessType: 'Organization (NPI-2): Med Spa' } };
}
export const nppesMedspa: RegisterAdapter = {
  source: 'nppes_medspa', state: 'US', label: 'NPPES NPI-2 med spas by organization name (owner titles)', recipe: 'B', cadence: 'weekly',
  initialCursor: () => ({ state: 0, pattern: 0, skip: 0 }),
  request(cursor) {
    const stateIndex = num(cursor.state, 0), patternIndex = num(cursor.pattern, 0), skip = num(cursor.skip, 0);
    if (stateIndex >= NPPES_STATES.length || patternIndex >= NPPES_MEDSPA_PATTERNS.length || skip > NPPES_SKIP_MAX) return null;
    return { url: nppesMedspaUrl(NPPES_STATES[stateIndex], NPPES_MEDSPA_PATTERNS[patternIndex], skip), method: 'GET', headers: { Accept: 'application/json' }, body: null, kind: 'api' };
  },
  parse(response, cursor) {
    const stateIndex = num(cursor.state, 0), patternIndex = num(cursor.pattern, 0), skip = num(cursor.skip, 0);
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { throw new RegisterParseError('unexpected_content', 'NPPES returned a non-JSON body.'); }
    const body = record(parsed);
    if (!body) throw new RegisterParseError('unexpected_content', 'NPPES returned a non-object body.');
    if (Array.isArray(body.Errors) && body.Errors.length > 0) throw new RegisterParseError('nppes_refused', String((record(body.Errors[0]) ?? {}).description ?? 'NPPES refused the query.'));
    const results = Array.isArray(body.results) ? body.results : [];
    const rows: ParsedRow[] = [];
    for (const item of results) { const row = record(item); if (!row) continue; const out = nppesMedspaOrganization(row); if (out) rows.push(out); }
    let note: string | null = null, next: Cursor;
    if (results.length >= NPPES_LIMIT && skip + NPPES_LIMIT <= NPPES_SKIP_MAX) next = { state: stateIndex, pattern: patternIndex, skip: skip + NPPES_LIMIT };
    else {
      if (results.length >= NPPES_LIMIT) note = 'skip_ceiling_reached';
      next = patternIndex + 1 < NPPES_MEDSPA_PATTERNS.length ? { state: stateIndex, pattern: patternIndex + 1, skip: 0 } : { state: stateIndex + 1, pattern: 0, skip: 0 };
    }
    return { rows, next, done: num(next.state, 0) >= NPPES_STATES.length, note };
  },
};


// ---------- registry ----------

export const REGISTER_ADAPTERS: readonly RegisterAdapter[] = [waLni, orCcb, cslb, paPals, flDbprConstruction, irsPtin, flDfsIndividual, fmcsa, paChildcare, nyChildcare, txChildcare, nyAttorneys, txTdlrSalons, nolaStr, orlandoStr, mnDli, austinPermits, nppes,
  flRe, flCpa, flDbprBarbers, txTrec, azAdre, ilIdfpr, nySalons, nyRepairShops, txTdi, txTabc, nyDohFood, coSosAgents, nppesMedspa];
export function adapterFor(source: string): RegisterAdapter | null { const base = splitRegisterSource(source).source; return REGISTER_ADAPTERS.find(adapter => adapter.source === base) ?? null; }
export function isRegisterSource(value: unknown): value is RegisterSource { return typeof value === 'string' && REGISTER_ADAPTERS.some(adapter => adapter.source === value); }

// Rows in one chunk can repeat a source_row_id (FL DFS lists one line per license class). Keep the last, count the rest.
export function dedupeNames(rows: ParsedRow[]): { unique: ParsedRow[]; duplicates: number } {
  const seen = new Map<string, number>();
  const unique: ParsedRow[] = [];
  let duplicates = 0;
  for (const row of rows) {
    if (!row.name) { unique.push(row); continue; }
    const index = seen.get(row.name.sourceRowId);
    if (index === undefined) { seen.set(row.name.sourceRowId, unique.length); unique.push(row); }
    else { unique[index] = row; duplicates += 1; }
  }
  return { unique, duplicates };
}

// (305) 555-**34: enough to recognise a number in a support conversation, not enough to dial it.
export function maskPhone(phone10: string | null): string | null {
  if (!phone10 || !/^\d{10}$/.test(phone10)) return null;
  return `(${phone10.slice(0, 3)}) ${phone10.slice(3, 6)}-**${phone10.slice(8)}`;
}

// The freeze reason a run keeps: status and host only, never the URL query or a header.
export function sanitizeReason(kind: string, url: string, detail?: string): string {
  let host = 'unknown-host';
  try { host = new URL(url).host; } catch { /* keep placeholder */ }
  return `${kind} ${host}${detail ? `: ${detail.replace(/[?#].*$/s, '').slice(0, 200)}` : ''}`.slice(0, 600);
}

// ---------- the ingest loop (pure: storage and HTTP are injected so it runs against fakes in tests) ----------

export interface IngestCounts { seen: number; named: number; skipped: number }
export interface IngestStore {
  write(rows: ParsedRow[]): Promise<void>;
  progress(cursor: Cursor, counts: IngestCounts, done: boolean, reason: string | null): Promise<void>;
  reuse(): Promise<void>;
  beforeWrite?(rows: ParsedRow[]): Promise<void>;
}
export type ChunkFetcher = (request: ChunkRequest) => Promise<ChunkResponse>;
export interface IngestLoopOptions { budgetMs: number; now?: () => number }
export interface IngestLoopResult { done: boolean; frozen: boolean; reason: string | null; cursor: Cursor; counts: IngestCounts; segments: number; notes: string[] }

// As many segments as the budget allows. Each segment is written and checkpointed before the next is asked
// for, so a timeout loses at most one in-flight segment and never a saved one. Any failure parks the run with
// a sanitized reason and the cursor it had when the failing request was built.
export async function runIngestLoop(adapter: RegisterAdapter, startCursor: Cursor, startCounts: IngestCounts, store: IngestStore, fetcher: ChunkFetcher, options: IngestLoopOptions): Promise<IngestLoopResult> {
  const now = options.now ?? Date.now;
  const started = now();
  let cursor: Cursor = Object.keys(startCursor).length > 0 ? startCursor : adapter.initialCursor();
  const counts: IngestCounts = { ...startCounts };
  const notes: string[] = [];
  let segments = 0;
  const freeze = async (reason: string): Promise<IngestLoopResult> => { await store.progress(cursor, counts, false, reason); return { done: false, frozen: true, reason, cursor, counts, segments, notes }; };
  const finish = async (): Promise<IngestLoopResult> => { await store.reuse(); return { done: true, frozen: false, reason: null, cursor, counts, segments, notes }; };
  for (;;) {
    const request = adapter.request(cursor);
    if (!request) { await store.progress(cursor, counts, true, null); return finish(); }
    let response: ChunkResponse;
    try { response = await fetcher(request); }
    catch (error) { return freeze(sanitizeReason('network_error', request.url, error instanceof Error ? error.name : 'fetch_failed')); }
    if (response.status >= 400 && response.status !== 416) return freeze(sanitizeReason(`http_${response.status}`, request.url));
    let chunk: ChunkResult;
    try { chunk = adapter.parse(response, cursor); }
    catch (error) {
      if (error instanceof RegisterParseError) return freeze(sanitizeReason(error.code, request.url, error.message));
      return freeze(sanitizeReason('parse_error', request.url, error instanceof Error ? error.message : 'unknown'));
    }
    if (chunk.note) notes.push(chunk.note);
    if (store.beforeWrite) await store.beforeWrite(chunk.rows);
    const { unique, duplicates } = dedupeNames(chunk.rows);
    await store.write(unique);
    counts.seen += chunk.rows.length;
    counts.named += unique.filter(row => row.name !== null).length;
    counts.skipped += chunk.rows.filter(row => row.skipReason !== null).length + duplicates;
    cursor = chunk.next;
    segments += 1;
    await store.progress(cursor, counts, chunk.done, null);
    if (chunk.done) return finish();
    if (now() - started >= options.budgetMs) return { done: false, frozen: false, reason: null, cursor, counts, segments, notes };
  }
}
