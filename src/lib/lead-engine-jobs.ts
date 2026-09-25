import stateCities from '../data/lead-engine-state-cities.json' with { type: 'json' };
import { brain, route, creditsForCells, capCentsForCredits, registerSourceFor, splitRegisterSource, BrainError } from './lead-engine-brain.ts';
import { NEVER_MAPS_DELIVERABLE } from './lead-engine-gates.ts';
import { parcelSourceFor, registerCarriesHomeStreet, PARCEL_HIT_RATE } from './lead-engine-parcel.ts';
import type { BrainRoute, Recipe, LegalStatus } from './lead-engine-brain.ts';
import { LeadEngineError, leadRecord, leadUuid } from './lead-engine-storage.ts';
import type { CellValue, Sheet } from './lead-engine-xlsx.ts';

// Pure job logic (no I/O): input parsing, the quote, the sample gate, city planning, the dial sheet and
// the outcome sheet reader. The service in src/services/lead-engine-jobs.service.ts does the database
// and vendor calls; keeping the rules here makes them testable without either.

export type JobStatus = 'draft' | 'quoted' | 'sample_running' | 'sample_done' | 'running' | 'delivered' | 'needs_attention';
export type DncMode = 'strict' | 'flag';
export const OUTCOMES = ['reached_owner', 'gatekeeper', 'wrong_number', 'voicemail', 'disconnected', 'opt_out', 'no_answer'] as const;
export type Outcome = typeof OUTCOMES[number];

export interface JobInput { id: string; industry: string; state: string; targetCells: number; dncMode: DncMode; useFallback: boolean }

export interface JobQuote {
  route: BrainRoute; recipe: Recipe; legalStatus: LegalStatus; legalNote: string | null;
  credits: number; capCents: number; creditCents: number; expectedClean: number; expectedBusinesses: number;
  estimatedVendorCents: number; cities: string[]; sampleCities: number; blockers: string[]; pathNote: string | null;
  // Recipes B, C and D: the lead_engine_names.source the names step reads (null when nothing is mapped).
  registerSource: string | null;
  // True when the operator may switch this quote to the Google Maps scrape (recipe A) with useFallback.
  fallbackAvailable: boolean;
  // Recipe B: the parcel layer for the state (null when the register carries the home street or none exists),
  // whether the parcel step is skipped, the traces the quote expects to pay for and our cost per clean cell.
  parcelSource: string | null; skipParcel: boolean; traces: number; costPerCleanCellCents: number | null;
}

export interface RunPointer { runId: string; datasetId: string; city: string; offset: number; total: number | null; places: number; sample: boolean }
export type JobPhase = 'names' | 'parcel' | 'trace' | 'scrape' | 'bucket' | 'verify' | 'gate' | 'run' | 'deliver' | 'done';
export interface JobProgress {
  phase: JobPhase;
  cities: string[]; cityIndex: number; run: RunPointer | null;
  scraped: number; filtered: number; verified: number; dropped: number; held: number; delivered: number; flagged: number; cached: number;
  lastMessage: string | null;
  // Recipes C and D: the names step (free) reads the register in pages of NAMES_PAGE rows.
  // namesDone: enough names for now (verify may start). namesExhausted: the register has no more rows.
  registerSource: string | null; names: number; namesOffset: number; namesDone: boolean; namesExhausted: boolean;
  namesDroppedReuse: number; namesDroppedDelivered: number; namesDroppedNoPhone: number;
  // Recipe D: the bucket step runs after every scraped city; counters per bucket and the review band.
  bucketPending: boolean; scrapedCities: string[]; bucket1: number; bucket2: number; bucket3: number; bucket4: number; bucketBand: number;
  // Quality gates evaluated in deliver(): the failures of the last attempt and the recorded override note.
  gateFailures: string[]; gateNote: string | null;
  // Recipe B: the parcel step (free) and the skip trace (paid). addressCheck holds the first three full home
  // addresses, the operator's eyeball before any trace fires (brain guardrail, engine.py show_addresses).
  parcelChecked: number; parcelResolved: number; parcelSkipped: number; parcelDropped: number; parcelFailures: number;
  traced: number; traceMatched: number; traceUnmatched: number; addressCheck: string[];
  // Phase 4 task 5 and Phase 5: owner names found by the website/reviews pass, the reviews run still
  // scraping (re-read on the next advance) and graph edge writes that failed (evidence only, never a gate).
  ownersNamed: number; reviewsRun: { runId: string; datasetId: string; rowIds: string[] } | null; graphEdgeErrors: number;
}

export interface JobRecord {
  id: string; operator_id: string; industry: string; industry_key: string; state: string; target_cells: number; dnc_mode: DncMode;
  recipe: Recipe; recipe_version: string; brain_version: string; legal_status: 'ok' | 'restricted'; legal_note: string | null;
  expected_clean: number | string; credits_per_cell: number; credit_cents: number; cap_ratio: number | string;
  credits_quoted: number; credits_held: number; credits_settled: number; cap_cents: number; spent_cents: number;
  status: JobStatus; resume_from: 'sample_running' | 'running' | null; attention_reason: string | null;
  sample: Record<string, unknown>; progress: Partial<JobProgress>; delivered_count: number;
  plan_id: string | null; batch_id: string | null; created_at: string; updated_at: string; quoted_at: string | null; delivered_at: string | null;
}

// Apify (compass/crawler-google-places, free tier) refuses a run capped under $0.50, so a city run is never
// smaller than 125 places at $0.004; and never larger than 500 so one city cannot eat the whole cap.
export const APIFY_CENTS_PER_PLACE = 0.4;
export const MIN_PLACES_PER_RUN = 125;
export const MAX_PLACES_PER_RUN = 500;
export const VERIFY_CENTS_PER_NUMBER = 0.7;
export const VERIFY_CHUNK = 10;
// Recipe C and D names step: one register page per advance call; the sample is the first 50 names (brain §3).
export const NAMES_PAGE = 200;
export const NAMES_SAMPLE = 50;
export const NAMES_MAX = 5000;
// Phone reuse filter: a register phone on more than this many licences is an employer or a front desk.
export const PHONE_REUSE_MAX = 3;
// Recipe D scrapes the register's busiest cities: this many during the run (one during the sample).
export const REGISTER_CITIES_MAX = 8;
// Recipe B: parcel lookups per advance call (one HTTP GET each, 25 s timeout) and BatchData skip trace pricing.
export const PARCEL_CHUNK = 25;
export const TRACE_CHUNK = 50;
export const TRACE_CENTS_PER_PERSON = 7;
export const traceCents = (persons: number) => persons * TRACE_CENTS_PER_PERSON;

function invalid(message: string): never { throw new LeadEngineError(400, 'invalid_input', message); }

export function parseJobInput(body: unknown): JobInput {
  if (!leadRecord(body)) invalid('A job object is required.');
  const keys = Object.keys(body);
  if (keys.some(key => !['id', 'industry', 'state', 'targetCells', 'dncMode', 'useFallback'].includes(key))) invalid('Unexpected fields are not accepted.');
  if (!leadUuid(body.id)) invalid('A valid job id is required.');
  if (typeof body.industry !== 'string' || body.industry.trim().length < 2 || body.industry.length > 80 || /[\x00-\x1f\x7f]/.test(body.industry)) invalid('Industry must be 2 to 80 characters.');
  if (typeof body.state !== 'string' || !/^[A-Za-z]{2}$/.test(body.state)) invalid('State must be a two-letter code.');
  if (typeof body.targetCells !== 'number' || !Number.isSafeInteger(body.targetCells) || body.targetCells < 1 || body.targetCells > 5000) invalid('Target cells must be a whole number from 1 to 5,000.');
  const dncMode = body.dncMode ?? 'strict';
  if (dncMode !== 'strict' && dncMode !== 'flag') invalid('DNC mode must be strict or flag.');
  if (body.useFallback !== undefined && typeof body.useFallback !== 'boolean') invalid('useFallback must be true or false.');
  return { id: body.id.toLowerCase(), industry: body.industry.trim(), state: body.state.toUpperCase(), targetCells: body.targetCells, dncMode, useFallback: body.useFallback === true };
}

export function citiesFor(state: string): string[] {
  const table = (stateCities as { cities: Record<string, string[]> }).cities;
  return (table[state] ?? []).map(city => `${city}, ${state}`);
}

// The quote is a recipe, a credit count and a hard dollar cap. Nothing here charges anything.
export function quoteJob(input: Pick<JobInput, 'industry' | 'state' | 'targetCells' | 'useFallback'>): JobQuote {
  let answer: BrainRoute;
  try { answer = route(input.industry, input.state); }
  catch (error) { throw new LeadEngineError(400, 'unknown_industry', error instanceof BrainError ? `${error.message}. Pick one of the industries the brain knows.` : 'Industry could not be routed.'); }
  const source = brain();
  const blockers: string[] = [];
  let recipe = answer.recipe, legalStatus = answer.legalStatus, legalNote = answer.legalNote, expectedClean = answer.expectedClean;
  const neverMaps = NEVER_MAPS_DELIVERABLE.includes(answer.industry);
  // Guardrail: the Google scrape is never the deliverable for attorneys, CPAs or med spas.
  const fallbackAvailable = answer.recipe !== 'A' && !neverMaps;
  let pathNote: string | null = null;
  const useMaps = (why: string) => { recipe = 'A'; legalStatus = 'ok'; legalNote = null; expectedClean = 0.2; pathNote = why; };
  // Every industry runs in every state (Anas §3): the register path where the state has one and it is
  // legal, otherwise the nationwide path, recipe A (Google Maps scrape + verify). The only exception is
  // the never-list, where Maps phones are 2 to 9% mobile and the register path is the only honest one.
  // Recipe B (Phase 4) needs a mapped register AND a way to the home: the state's parcel layer, or a
  // register whose file already carries the licensee's own street (FL RE, FL CPA).
  const registerMapped = answer.recipe !== 'A' ? registerSourceFor(answer.industry, input.state) : null;
  const parcel = answer.recipe === 'B' ? parcelSourceFor(input.state) : null;
  const skipParcel = answer.recipe === 'B' && registerMapped !== null && registerCarriesHomeStreet(registerMapped);
  const homePath = answer.recipe === 'B' && registerMapped !== null && (parcel !== null || skipParcel);
  const registerPathOpen = answer.recipe !== 'A' && answer.legalStatus !== 'prohibited' && answer.sources.length > 0
    && (answer.recipe === 'B' ? homePath : registerMapped !== null);
  if (answer.recipe !== 'A' && (!registerPathOpen || input.useFallback)) {
    const label = answer.industry.replaceAll('_', ' ');
    const why = answer.legalStatus === 'prohibited' ? `${answer.legalNote ?? `Licensee lists are prohibited in ${input.state}.`} Nationwide path: Google Maps scrape + verify (recipe A).`
      : answer.sources.length === 0 || !registerMapped ? `No register for ${label} in ${input.state}. Nationwide path: Google Maps scrape + verify (recipe A).`
      : answer.recipe === 'B' && !homePath ? `${input.state} has ${registerMapped} names but no parcel layer to turn a name into a home address, and the file carries no home street. Nationwide path: Google Maps scrape + verify (recipe A).`
      : `Operator chose the Google Maps scrape over recipe ${answer.recipe}.`;
    if (fallbackAvailable) useMaps(why);
    else blockers.push(`${label}: Google Maps is never the deliverable (2 to 9% mobile, brain guardrail). Recipe B (register name to home to skip trace) is the only path and ${input.state} ${!registerMapped ? 'has no mapped register' : 'has no parcel layer and the register carries no home street'}. Runs today in: ${recipeBStates(answer.industry, source).join(', ') || 'no state yet'}.`);
  }
  const registerSource = recipe === 'B' || recipe === 'C' || recipe === 'D' ? registerMapped : null;
  const creditsPerCell = source.recipes[recipe].creditsPerCleanCell;
  const credits = creditsForCells(input.targetCells, creditsPerCell);
  const capCents = capCentsForCredits(credits, source);
  // Recipe B scale rule (brain): names x parcel hit rate = traces; traces x clean rate = cells. A register that
  // carries the home street has a hit rate of 1.
  const parcelHit = recipe === 'B' ? (skipParcel ? 1 : PARCEL_HIT_RATE) : 1;
  const expectedBusinesses = recipe === 'B' ? Math.ceil(input.targetCells / Math.max(expectedClean * parcelHit, 0.01)) : Math.ceil(input.targetCells / Math.max(expectedClean, 0.01));
  const traces = recipe === 'B' ? Math.ceil(expectedBusinesses * parcelHit) : 0;
  // Vendor estimate for the operator's eyes. A: scrape every business, verify the ~70% that publish a
  // phone. B: skip trace every resolved home ($0.07 each; names and parcels are free). C: verify only (the
  // register is free). D: C plus one Maps scrape over the register's cities.
  const estimatedVendorCents = recipe === 'B' ? traceCents(traces)
    : recipe === 'C' ? Math.ceil(expectedBusinesses * VERIFY_CENTS_PER_NUMBER)
    : recipe === 'D' ? Math.ceil(expectedBusinesses * VERIFY_CENTS_PER_NUMBER + expectedBusinesses * APIFY_CENTS_PER_PLACE)
    : Math.ceil(expectedBusinesses * APIFY_CENTS_PER_PLACE + expectedBusinesses * 0.7 * VERIFY_CENTS_PER_NUMBER);
  const costPerCleanCellCents = recipe === 'B' ? Math.round(estimatedVendorCents / Math.max(input.targetCells, 1) * 10) / 10 : null;
  const cities = citiesFor(input.state);
  if (cities.length === 0 && recipe !== 'C' && recipe !== 'B') blockers.push(`No city list for ${input.state}.`);
  return { route: answer, recipe, legalStatus, legalNote, credits, capCents, creditCents: Math.round(source.creditValueUsd * 100), expectedClean, expectedBusinesses, estimatedVendorCents, cities, sampleCities: 1, blockers, registerSource, fallbackAvailable, pathNote,
    parcelSource: recipe === 'B' && !skipParcel ? parcel?.label ?? null : null, skipParcel: recipe === 'B' && skipParcel, traces, costPerCleanCellCents };
}

// The states where recipe B runs for an industry today: a mapped register plus a parcel layer or a home-street file.
export function recipeBStates(industryKey: string, source = brain()): string[] {
  const industry = source.industries.find(item => item.key === industryKey);
  if (!industry) return [];
  const states = new Set<string>();
  for (const [state, id] of Object.entries(industry.registerSource)) {
    if (state === '*') { for (const code of Object.keys(source.states)) if (/^[A-Z]{2}$/.test(code) && parcelSourceFor(code)) states.add(code); continue; }
    if (parcelSourceFor(state) || registerCarriesHomeStreet(id)) states.add(state);
  }
  return [...states].sort();
}
export { splitRegisterSource };

export function initialProgress(cities: string[], recipe: Recipe = 'A', registerSource: string | null = null): JobProgress {
  return {
    phase: recipe === 'B' || recipe === 'C' || recipe === 'D' ? 'names' : 'scrape', cities, cityIndex: 0, run: null,
    scraped: 0, filtered: 0, verified: 0, dropped: 0, held: 0, delivered: 0, flagged: 0, cached: 0, lastMessage: null,
    registerSource, names: 0, namesOffset: 0, namesDone: false, namesExhausted: false, namesDroppedReuse: 0, namesDroppedDelivered: 0, namesDroppedNoPhone: 0,
    bucketPending: false, scrapedCities: [], bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0, bucketBand: 0, gateFailures: [], gateNote: null,
    parcelChecked: 0, parcelResolved: 0, parcelSkipped: 0, parcelDropped: 0, parcelFailures: 0, traced: 0, traceMatched: 0, traceUnmatched: 0, addressCheck: [],
    ownersNamed: 0, reviewsRun: null, graphEdgeErrors: 0,
  };
}
export function readProgress(job: Pick<JobRecord, 'progress' | 'state'> & Partial<Pick<JobRecord, 'recipe'>>): JobProgress {
  const stored = job.progress ?? {};
  return { ...initialProgress(stored.cities ?? citiesFor(job.state), job.recipe ?? 'A', stored.registerSource ?? null), ...stored };
}

// Recipe D scrape keyword: the brain keyword when the industry has one, else the trade behind the
// register (contractor registers scrape "contractor"; "chiropractor direct line" scrapes "chiropractor").
export function scrapeKeyword(industryKey: string, industryText: string): string {
  const keyword = brain().industries.find(item => item.key === industryKey)?.keyword;
  if (keyword) return keyword;
  if (/^contractor/.test(industryKey)) return 'contractor';
  if (industryKey === 'salon_suite_tx') return 'salon';
  return industryText.toLowerCase().replace(/\b(direct line|florida|texas|minnesota|new york|nyc|austin|pennsylvania|contrast)\b/g, ' ').replace(/\s+/g, ' ').trim() || industryKey.replace(/_/g, ' ');
}

// Recipe B, C and D names step, the pure part. `rows` is one register page as stored by the ingest
// (lead_engine_names); the runner has already filtered source and state. Rules (brain recipe D
// guardrail, architecture §3): drop phones on more than PHONE_REUSE_MAX licences, drop phones already
// delivered or suppressed, one row per phone (newest licence wins), newest licence first, nulls last.
export interface RegisterNameRow {
  id: string; source: string; source_row_id: string; first_name: string | null; last_name: string | null; company: string | null;
  title_code: string | null; business_type: string | null; license_issue_date: string | null; street: string | null; city: string | null; state: string | null; zip: string | null;
  phone10: string | null; email: string | null; reuse_count: number;
}
export interface NameSelection { kept: RegisterNameRow[]; droppedReuse: number; droppedDelivered: number; droppedNoPhone: number; droppedDuplicate: number }
export function selectRegisterNames(rows: readonly RegisterNameRow[], excluded: ReadonlySet<string>, options: { requirePhone: boolean; seenPhones?: Set<string> }): NameSelection {
  const seen = options.seenPhones ?? new Set<string>();
  const result: NameSelection = { kept: [], droppedReuse: 0, droppedDelivered: 0, droppedNoPhone: 0, droppedDuplicate: 0 };
  const sorted = [...rows].sort((a, b) => {
    if (a.license_issue_date === b.license_issue_date) return 0;
    if (a.license_issue_date === null) return 1;
    if (b.license_issue_date === null) return -1;
    return a.license_issue_date < b.license_issue_date ? 1 : -1;
  });
  for (const row of sorted) {
    if (!row.phone10) { if (options.requirePhone) { result.droppedNoPhone++; continue; } result.kept.push(row); continue; }
    if (row.reuse_count > PHONE_REUSE_MAX) { result.droppedReuse++; continue; }
    if (excluded.has(row.phone10)) { result.droppedDelivered++; continue; }
    if (seen.has(row.phone10)) { result.droppedDuplicate++; continue; }
    seen.add(row.phone10); result.kept.push(row);
  }
  return result;
}
export function registerRowName(row: Pick<RegisterNameRow, 'company' | 'first_name' | 'last_name'>): string {
  const person = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return (row.company?.trim() || person || 'Unnamed licensee').slice(0, 200);
}
// How many register names the job still wants: enough to reach the target at the expected clean rate
// with a 30% margin, never more than NAMES_MAX.
export function namesWanted(targetCells: number, delivered: number, expectedClean: number): number {
  return Math.min(NAMES_MAX, Math.ceil(Math.max(targetCells - delivered, 1) / Math.max(expectedClean, 0.02) * 1.3));
}
// Recipe D cities: the register's busiest cities, most rows first, formatted like the state city list.
export function topRegisterCities(cities: ReadonlyArray<string | null>, state: string, limit: number): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const city of cities) {
    const label = (city ?? '').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = counts.get(key) ?? { label: label.replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase()), count: 0 };
    entry.count++; counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit).map(entry => `${entry.label}, ${state}`);
}

// How many places to ask for in the next city: enough to reach the target at the expected clean rate,
// with a 30% margin for filters, clamped to the provider's minimum and our per-run maximum.
export function placesForNextCity(targetCells: number, delivered: number, expectedClean: number): number {
  const remaining = Math.max(targetCells - delivered, 1);
  const wanted = Math.ceil(remaining / Math.max(expectedClean, 0.02) * 1.3);
  return Math.min(MAX_PLACES_PER_RUN, Math.max(MIN_PLACES_PER_RUN, wanted));
}
export const scrapeCents = (places: number) => Math.ceil(places * APIFY_CENTS_PER_PLACE);
export const verifyCents = (numbers: number) => Math.ceil(numbers * VERIFY_CENTS_PER_NUMBER);

export interface SampleGate { pass: boolean; cleanRate: number; expected: number; threshold: number; verified: number; clean: number; reason: string | null }
// Brain rule: abort when the sample's clean rate is under half the expected rate. Too few verified
// numbers to judge is not a failure: the sample simply continues into the next city.
export function sampleGate(verified: number, clean: number, expectedClean: number, fraction: number): SampleGate {
  const cleanRate = verified > 0 ? clean / verified : 0, threshold = expectedClean * fraction;
  const pass = cleanRate >= threshold;
  return { pass, cleanRate, expected: expectedClean, threshold, verified, clean,
    reason: pass ? null : `sample_below_expected: ${(cleanRate * 100).toFixed(0)}% clean on ${verified} verified vs ${(expectedClean * 100).toFixed(0)}% expected (stop under ${(threshold * 100).toFixed(0)}%)` };
}

export interface DialRow {
  position: number; phone10: string; company: string; mapsUrl: string | null; rating: number | null; reviews: number | null; city: string | null; state: string | null;
  timeZone: string | null; ownerName: string | null; email: string | null; status: string; bucket: number | null; source: string; sourceRowId: string | null; licenseIssueDate: string | null; ledgerId: string | null;
}
const formatPhone = (value: string) => `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;

export function contactEvidenceStatus(stage: string, bucket: number | null, verification: Record<string, unknown>): string {
  if (stage !== 'delivered') return 'DNC flagged · do not call';
  const provenance = bucket === 2 ? 'register differs from Maps' : bucket === 1 ? 'not matched on Maps' : verification.trace_status === 'matched' ? 'identity match recorded' : 'business-contact candidate';
  return `Callable mobile · ${provenance} · ownership unconfirmed`;
}

// The deliverable: the 20 brain output columns in order, then Summary and Legal Notes. Called and
// Outcome start empty and come back through the outcome importer keyed by Ledger Id.
export function dialSheet(job: JobRecord, rows: DialRow[], summary: Record<string, CellValue>): Sheet[] {
  const columns = brain().outputColumns;
  const cell = (row: DialRow, column: string): CellValue => ({
    '#': row.position, 'Cell Phone': formatPhone(row.phone10), 'Company': row.company, 'Google Maps Link': row.mapsUrl, 'Rating': row.rating, 'Reviews': row.reviews,
    'City': row.city, 'State': row.state, 'Time Zone': row.timeZone, 'Owner Name': row.ownerName, 'Email': row.email, 'Status': row.status,
    'Called': null, 'Outcome': null, 'Notes': null, 'Bucket': row.bucket, 'Source': row.source, 'Source Row Id': row.sourceRowId,
    'License Issue Date': row.licenseIssueDate, 'Ledger Id': row.ledgerId,
  } as Record<string, CellValue>)[column] ?? null;
  return [
    { name: 'List', rows: [columns, ...rows.map(row => columns.map(column => cell(row, column)))] },
    { name: 'Summary', rows: [['Job', job.id], ['Industry', job.industry], ['State', job.state], ['Recipe', job.recipe], ['Brain version', job.brain_version],
      ...Object.entries(summary), ['Generated', new Date().toISOString()]] },
    { name: 'Legal Notes', rows: [
      ['Manual dialing only. No autodialer, no SMS, no voicemail drops.'],
      ['Dial window: 8:00am to 8:00pm in the recipient\'s local time zone (the Time Zone column). Florida caps at 8pm; the stricter window applies everywhere.'],
      ['Maximum 3 calls per 24 hours to the same recipient on the same subject (Florida Telemarketing Act).'],
      ['Every row was checked against the National Do Not Call registry and a TCPA litigator list on the verification date. Rows marked DNC in flag mode are for email or retargeting only: never cold call them.'],
      ['A scrub is valid for 31 days. Re-verify before dialing a list older than that.'],
      ['If someone asks not to be called again, record Outcome = opt_out. The number is suppressed globally and permanently the moment it is saved.'],
      ['Record every call in Called (yes) and Outcome (reached_owner, gatekeeper, wrong_number, voicemail, disconnected, opt_out, no_answer), then upload this file back. That data trains the owner score.'],
    ] },
  ];
}

export interface OutcomeRow { ledgerId: string; outcome: Outcome; notes: string | null; row: number }
export interface OutcomeParse { rows: OutcomeRow[]; skipped: number; errors: string[] }

// Reads Called / Outcome / Notes back from a sheet. Rows without an outcome are skipped (not yet called);
// an unknown outcome word is an error with its row number so the caller can fix the sheet, not guess.
export function parseOutcomeRecords(records: Array<Record<string, CellValue>>): OutcomeParse {
  const rows: OutcomeRow[] = [], errors: string[] = [];
  let skipped = 0;
  records.forEach((record, index) => {
    const line = index + 2;
    const outcomeRaw = String(record['Outcome'] ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!outcomeRaw) { skipped++; return; }
    const ledgerId = String(record['Ledger Id'] ?? '').trim().toLowerCase();
    if (!leadUuid(ledgerId)) { errors.push(`Row ${line}: Ledger Id missing or not a valid id.`); return; }
    if (!(OUTCOMES as readonly string[]).includes(outcomeRaw)) { errors.push(`Row ${line}: outcome "${String(record['Outcome'])}" is not one of ${OUTCOMES.join(', ')}.`); return; }
    const notesRaw = record['Notes'];
    const notes = notesRaw === null || notesRaw === undefined ? null : String(notesRaw).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 600) || null;
    rows.push({ ledgerId, outcome: outcomeRaw as Outcome, notes, row: line });
  });
  return { rows, skipped, errors };
}

export function parseOutcomeBody(body: unknown): { ledgerId: string; outcome: Outcome; dialedAt: string | null; notes: string | null } {
  if (!leadRecord(body)) invalid('An outcome object is required.');
  if (Object.keys(body).some(key => !['ledgerId', 'outcome', 'dialedAt', 'notes'].includes(key))) invalid('Unexpected fields are not accepted.');
  if (!leadUuid(body.ledgerId)) invalid('A valid ledger id is required.');
  if (typeof body.outcome !== 'string' || !(OUTCOMES as readonly string[]).includes(body.outcome)) invalid(`Outcome must be one of ${OUTCOMES.join(', ')}.`);
  let dialedAt: string | null = null;
  if (body.dialedAt !== undefined && body.dialedAt !== null) {
    if (typeof body.dialedAt !== 'string' || Number.isNaN(Date.parse(body.dialedAt))) invalid('dialedAt must be an ISO timestamp.');
    dialedAt = new Date(body.dialedAt).toISOString();
  }
  let notes: string | null = null;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 600) invalid('Notes must be 600 characters or fewer.');
    notes = body.notes.replace(/[\x00-\x1f\x7f]/g, ' ').trim() || null;
  }
  return { ledgerId: body.ledgerId.toLowerCase(), outcome: body.outcome as Outcome, dialedAt, notes };
}
