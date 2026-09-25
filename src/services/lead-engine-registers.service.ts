import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { adapterFor, maskPhone, rowHash, runIngestLoop, txTdiIndividualsUrl, REGISTER_ADAPTERS, USER_AGENT, MAX_PHONE_REUSE } from '../lib/lead-engine-registers';
import { zip5 } from '../lib/lead-engine-dial-window';
import type { ChunkRequest, ChunkResponse, Cursor, IngestCounts, IngestLoopResult, IngestStore, NameRow, ParsedRow, RegisterAdapter } from '../lib/lead-engine-registers';

// Phase 2 task 1, the impure half: one ingest call fetches segments of one register while its time budget
// lasts, writes each segment (snapshots append-only, names upserted) and saves the cursor before asking for
// the next. Nothing dies: an HTTP error, a parse surprise or a portal refusal parks the run with a sanitized
// reason and the cursor it had; resume puts it back to running. The browser or a cron loops on `done`.

export interface RegisterRun {
  id: string; source: string; operator_id: string; status: 'draft' | 'running' | 'done' | 'needs_attention'; cursor: Cursor;
  rows_seen: number; rows_named: number; rows_skipped: number; snapshot_date: string; started_at: string; updated_at: string; finished_at: string | null; attention_reason: string | null;
}
export interface IngestResult { done: boolean; frozen: boolean; rowsSeen: number; rowsNamed: number; rowsSkipped: number; cursor: Cursor; segments: number; run: RegisterRun; notes: string[] }
export type Fetcher = (request: ChunkRequest) => Promise<ChunkResponse>;
export interface IngestOptions { fetcher?: Fetcher; budgetMs?: number; now?: () => number; writeBatch?: number }

export const INGEST_BUDGET_MS = 20000;
export const FETCH_TIMEOUT_MS = 25000;
export const WRITE_BATCH = 1000;

interface RpcError { code?: string; message?: string; details?: string }
function storageError(error: RpcError, fallback = 'The register run could not be updated.'): LeadEngineError {
  const message = `${error.message ?? ''} ${error.details ?? ''}`;
  const known: Array<[RegExp, number, string, string]> = [
    [/run_not_found/, 404, 'run_not_found', 'That register run was not found.'],
    [/not_resumable/, 409, 'not_resumable', 'Only a run that needs attention can be resumed.'],
    [/run_needs_attention/, 409, 'run_needs_attention', 'The run needs attention. Resume it first.'],
    [/run_finished/, 409, 'run_finished', 'That run is finished. Start a new ingest.'],
    [/invalid_source/, 400, 'invalid_source', 'Unknown register source.'],
    [/operator_not_found/, 403, 'access_pending', 'The operator account is not provisioned in this database.'],
  ];
  for (const [pattern, status, code, text] of known) if (pattern.test(message)) return new LeadEngineError(status, code, text);
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new LeadEngineError(503, 'storage_pending', 'The register tables are not applied to this database yet.');
  return new LeadEngineError(503, 'storage_pending', fallback);
}
async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw storageError(error);
  return data as T;
}

export function requireAdapter(source: string | undefined): RegisterAdapter {
  const adapter = source ? adapterFor(source) : null;
  if (!adapter) throw new LeadEngineError(404, 'unknown_source', 'Unknown register source.');
  return adapter;
}

// The only place a register is asked anything. Descriptive User-Agent, Socrata app token when configured, a hard timeout.
export function defaultFetcher(env: NodeJS.ProcessEnv = process.env): Fetcher {
  return async request => {
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, ...request.headers };
    if (request.kind === 'socrata' && env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = env.SOCRATA_APP_TOKEN;
    const response = await fetch(request.url, { method: request.method, headers, body: request.body ?? undefined, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
    return { status: response.status, text: await response.text(), contentRange: response.headers.get('content-range'), contentType: response.headers.get('content-type') };
  };
}

function nameToRecord(name: NameRow): Record<string, unknown> {
  return {
    source_row_id: name.sourceRowId, first_name: name.firstName, last_name: name.lastName, company: name.company, title_code: name.titleCode, business_type: name.businessType,
    license_issue_date: name.licenseIssueDate, license_expires_at: name.licenseExpiresAt, issuing_state: name.issuingState, street: name.street, city: name.city, county: name.county,
    state: name.state, zip: name.zip, phone10: name.phone10, email: name.email,
  };
}

async function writeRows(db: SupabaseClient, operator: string, run: RegisterRun, rows: ParsedRow[], batch: number): Promise<void> {
  for (let start = 0; start < rows.length; start += batch) {
    const slice = rows.slice(start, start + batch).map(row => ({ row_key: row.rowKey.slice(0, 300), row_hash: rowHash(row.payload), payload: row.payload, name: row.name ? nameToRecord(row.name) : null }));
    await rpc(db, 'lead_engine_register_write', { p_operator: operator, p_run: run.id, p_rows: slice });
  }
}

async function progress(db: SupabaseClient, operator: string, run: RegisterRun, cursor: Cursor, counts: IngestCounts, done: boolean, reason: string | null): Promise<RegisterRun> {
  return rpc<RegisterRun>(db, 'lead_engine_register_progress', { p_operator: operator, p_run: run.id, p_cursor: cursor, p_seen: counts.seen, p_named: counts.named, p_skipped: counts.skipped, p_done: done, p_reason: reason });
}

// CSLB personnel rows are person-level only with the Master phone. Within one run the Master file streams first,
// so the phone is looked up in this run's snapshot by LicenseNo before the personnel names are written.
async function fillCslbPhones(db: SupabaseClient, run: RegisterRun, rows: ParsedRow[]): Promise<void> {
  const licences = [...new Set(rows.filter(row => row.name && typeof row.payload.joinLicenseNo === 'string').map(row => String(row.payload.joinLicenseNo)))];
  if (licences.length === 0) return;
  const { data, error } = await db.from('lead_engine_register_snapshots').select('row_key,payload').eq('source', run.source).eq('snapshot_date', run.snapshot_date).in('row_key', licences.map(id => `M:${id}`));
  if (error) throw storageError(error, 'The CSLB master rows could not be read.');
  const phones = new Map<string, Record<string, unknown>>();
  for (const item of (data ?? []) as Array<{ row_key: string; payload: Record<string, unknown> }>) phones.set(item.row_key.slice(2), item.payload);
  for (const row of rows) {
    if (!row.name || typeof row.payload.joinLicenseNo !== 'string') continue;
    const master = phones.get(row.payload.joinLicenseNo);
    if (!master) { row.skipReason = 'master_row_not_clear'; row.name = null; continue; }
    const phone = typeof master.BusinessPhone === 'string' ? master.BusinessPhone.replace(/\D/g, '') : '';
    row.name.phone10 = /^[2-9]\d{2}[2-9]\d{6}$/.test(phone) && !/^(800|888|877|866|855|844|833|822)/.test(phone) ? phone : null;
    row.name.company = row.name.titleCode === 'Sole Owner' ? null : (typeof master.BusinessName === 'string' ? master.BusinessName : null);
    row.name.licenseExpiresAt = typeof master.ExpirationDate === 'string' ? (/^(\d{2})\/(\d{2})\/(\d{4})/.exec(master.ExpirationDate) ? master.ExpirationDate.replace(/^(\d{2})\/(\d{2})\/(\d{4}).*$/, '$3-$1-$2') : null) : null;
    row.name.city = typeof master.City === 'string' ? master.City : null;
    row.name.zip = typeof master.ZIPCode === 'string' && /^\d{5}/.test(master.ZIPCode) ? master.ZIPCode.slice(0, 5) : null;
    row.name.street = typeof master.MailingAddress === 'string' ? master.MailingAddress : null;
  }
}

// TX TDI relationship rows name the owner but carry no address. The individuals dataset (kxv3-diwf) has city, state and
// ZIP per NPN (no street, verified 2026-09-21), fetched here 15 NPNs per request so every URL stays under the Socrata
// length the catalog warns about. A failed lookup leaves the row without a city; it is never dropped for that.
export const TDI_JOIN_BATCH = 15;
export async function fillTdiAddresses(fetcher: Fetcher, rows: ParsedRow[]): Promise<void> {
  const pending = rows.filter(row => row.name && typeof row.payload.joinNpn === 'string');
  const npns = [...new Set(pending.map(row => String(row.payload.joinNpn)))];
  const found = new Map<string, { city: string | null; state: string | null; zip: string | null }>();
  for (let start = 0; start < npns.length; start += TDI_JOIN_BATCH) {
    const batch = npns.slice(start, start + TDI_JOIN_BATCH);
    let response: ChunkResponse;
    try { response = await fetcher({ url: txTdiIndividualsUrl(batch), method: 'GET', headers: { Accept: 'application/json' }, body: null, kind: 'socrata' }); }
    catch { continue; }
    if (response.status >= 400) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      const npn = typeof record.npn === 'string' ? record.npn : null;
      if (!npn || found.has(npn)) continue;
      const state = typeof record.state === 'string' && /^[A-Z]{2}$/.test(record.state.trim().toUpperCase()) ? record.state.trim().toUpperCase() : null;
      found.set(npn, { city: typeof record.city === 'string' && record.city.trim() ? record.city.trim().slice(0, 120) : null, state, zip: zip5(String(record.pstl_cd ?? '').slice(0, 5)) });
    }
  }
  for (const row of pending) {
    const address = found.get(String(row.payload.joinNpn));
    if (!address || !row.name) continue;
    row.name.city = address.city; row.name.zip = address.zip; row.name.state = address.state ?? row.name.state;
  }
}

// One call: as many segments as the budget allows, each written and checkpointed before the next.
export async function ingestChunk(db: SupabaseClient, operator: string, source: string, options: IngestOptions = {}): Promise<IngestResult> {
  const adapter = requireAdapter(source);
  const fetcher = options.fetcher ?? defaultFetcher();
  const batch = options.writeBatch ?? WRITE_BATCH;
  let run = await rpc<RegisterRun>(db, 'lead_engine_register_start', { p_operator: operator, p_source: adapter.source });
  const view = (loop: IngestLoopResult | null): IngestResult => ({
    done: loop ? loop.done : run.status === 'done', frozen: loop ? loop.frozen : run.status === 'needs_attention',
    rowsSeen: loop ? loop.counts.seen : run.rows_seen, rowsNamed: loop ? loop.counts.named : run.rows_named, rowsSkipped: loop ? loop.counts.skipped : run.rows_skipped,
    cursor: loop ? loop.cursor : run.cursor, segments: loop ? loop.segments : 0, run, notes: loop ? loop.notes : [],
  });
  if (run.status === 'needs_attention' || run.status === 'done') return view(null);
  const store: IngestStore = {
    write: rows => writeRows(db, operator, run, rows, batch),
    progress: async (cursor, counts, done, reason) => { run = await progress(db, operator, run, cursor, counts, done, reason); },
    reuse: async () => { await rpc(db, 'lead_engine_names_reuse', { p_source: adapter.source }); },
    beforeWrite: adapter.source === 'cslb' ? rows => fillCslbPhones(db, run, rows) : adapter.source === 'tx_tdi' ? rows => fillTdiAddresses(fetcher, rows) : undefined,
  };
  const loop = await runIngestLoop(adapter, run.cursor ?? {}, { seen: run.rows_seen, named: run.rows_named, skipped: run.rows_skipped }, store, fetcher, { budgetMs: options.budgetMs ?? INGEST_BUDGET_MS, now: options.now });
  return view(loop);
}

export async function resumeRun(db: SupabaseClient, operator: string, source: string): Promise<RegisterRun> {
  const adapter = requireAdapter(source);
  const { data, error } = await db.from('lead_engine_register_ingests').select('id,status').eq('source', adapter.source).eq('status', 'needs_attention').maybeSingle();
  if (error) throw storageError(error, 'The register run could not be loaded.');
  if (!data) throw new LeadEngineError(409, 'not_resumable', 'No run of that register needs attention.');
  return rpc<RegisterRun>(db, 'lead_engine_register_resume', { p_operator: operator, p_run: (data as { id: string }).id });
}

export interface RegisterSummaryRow {
  source: string; label: string; state: string; recipe: string; cadence: string; implemented: boolean;
  names: number; withPhone: number; dialable: number; lastSnapshotDate: string | null; snapshotRows: number;
  run: { id: string; status: string; rowsSeen: number; rowsNamed: number; rowsSkipped: number; attentionReason: string | null; updatedAt: string | null } | null;
}
interface SummaryRpcRow { source: string; names: number; with_phone: number; dialable: number; last_snapshot_date: string | null; snapshot_rows: number; run_id: string | null; run_status: string | null; rows_seen: number | null; rows_named: number | null; rows_skipped: number | null; attention_reason: string | null; run_updated_at: string | null }

export async function registerSummary(db: SupabaseClient): Promise<{ sources: RegisterSummaryRow[]; maxPhoneReuse: number }> {
  const rows = await rpc<SummaryRpcRow[] | null>(db, 'lead_engine_register_summary', {});
  const bySource = new Map((rows ?? []).map(row => [row.source, row]));
  const sources: RegisterSummaryRow[] = REGISTER_ADAPTERS.map(adapter => {
    const row = bySource.get(adapter.source);
    return {
      source: adapter.source, label: adapter.label, state: adapter.state, recipe: adapter.recipe, cadence: adapter.cadence, implemented: true,
      names: Number(row?.names ?? 0), withPhone: Number(row?.with_phone ?? 0), dialable: Number(row?.dialable ?? 0), lastSnapshotDate: row?.last_snapshot_date ?? null, snapshotRows: Number(row?.snapshot_rows ?? 0),
      run: row?.run_id ? { id: row.run_id, status: row.run_status ?? 'draft', rowsSeen: row.rows_seen ?? 0, rowsNamed: row.rows_named ?? 0, rowsSkipped: row.rows_skipped ?? 0, attentionReason: row.attention_reason, updatedAt: row.run_updated_at } : null,
    };
  });
  return { sources, maxPhoneReuse: MAX_PHONE_REUSE };
}

export interface MaskedName { sourceRowId: string; firstName: string | null; lastName: string | null; company: string | null; titleCode: string | null; businessType: string | null; licenseIssueDate: string | null; licenseExpiresAt: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null; hasEmail: boolean; reuseCount: number; ingestedAt: string }
type NamesRow = { source_row_id: string; first_name: string | null; last_name: string | null; company: string | null; title_code: string | null; business_type: string | null; license_issue_date: string | null; license_expires_at: string | null; city: string | null; state: string | null; zip: string | null; phone10: string | null; email: string | null; reuse_count: number; ingested_at: string };
function masked(row: NamesRow): MaskedName {
  return { sourceRowId: row.source_row_id, firstName: row.first_name, lastName: row.last_name, company: row.company, titleCode: row.title_code, businessType: row.business_type, licenseIssueDate: row.license_issue_date, licenseExpiresAt: row.license_expires_at,
    city: row.city, state: row.state, zip: row.zip, phone: maskPhone(row.phone10), hasEmail: row.email !== null, reuseCount: row.reuse_count, ingestedAt: row.ingested_at };
}
export function parseLimit(value: string | null, fallback: number, max: number): number {
  const parsed = value === null ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new LeadEngineError(400, 'invalid_input', `limit must be a whole number from 1 to ${max}.`);
  return parsed;
}

export async function sampleNames(db: SupabaseClient, source: string, limit: number): Promise<{ source: string; rows: MaskedName[] }> {
  const adapter = requireAdapter(source);
  const { data, error } = await db.from('lead_engine_names').select('source_row_id,first_name,last_name,company,title_code,business_type,license_issue_date,license_expires_at,city,state,zip,phone10,email,reuse_count,ingested_at')
    .eq('source', adapter.source).order('ingested_at', { ascending: false }).limit(limit);
  if (error) throw storageError(error, 'The names could not be loaded.');
  return { source: adapter.source, rows: ((data ?? []) as NamesRow[]).map(masked) };
}

export async function newLicensees(db: SupabaseClient, source: string, days: number, limit: number): Promise<{ source: string; days: number; rows: MaskedName[] }> {
  const adapter = requireAdapter(source);
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new LeadEngineError(400, 'invalid_input', 'days must be a whole number from 1 to 3650.');
  const rows = await rpc<NamesRow[] | null>(db, 'lead_engine_new_licensees', { p_source: adapter.source, p_days: days });
  return { source: adapter.source, days, rows: (rows ?? []).slice(0, limit).map(masked) };
}
