import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { brain, registerSourceFor } from '../lib/lead-engine-brain';
import { parseDiscoveryCandidate } from '../lib/lead-engine-scrape';
import { isChain } from '../lib/lead-engine-brands';
import { contactEvidenceStatus } from '../lib/lead-engine-jobs';
import { assignBuckets, bucketLabel } from '../lib/lead-engine-buckets';
import type { RegisterRow, MapsRow } from '../lib/lead-engine-buckets';
import { evaluateJobGates } from '../lib/lead-engine-gates';
import type { JobGateRow } from '../lib/lead-engine-gates';
import { resolveZone, zip5 } from '../lib/lead-engine-dial-window';
import { writeWorkbook } from '../lib/lead-engine-xlsx';
import type { CellValue } from '../lib/lead-engine-xlsx';
import { quoteJob, readProgress, initialProgress, placesForNextCity, scrapeCents, verifyCents, traceCents, sampleGate, dialSheet, scrapeKeyword, selectRegisterNames, registerRowName, namesWanted, topRegisterCities, citiesFor, splitRegisterSource, VERIFY_CHUNK, NAMES_PAGE, NAMES_SAMPLE, NAMES_MAX, PHONE_REUSE_MAX, REGISTER_CITIES_MAX, PARCEL_CHUNK, TRACE_CHUNK } from '../lib/lead-engine-jobs';
import type { JobInput, JobRecord, JobProgress, JobQuote, DialRow, RegisterNameRow } from '../lib/lead-engine-jobs';
import { parcelSourceFor, resolveHome, streetOk, homeStreetSource, addressLine, PARCEL_MAX_FAILURES } from '../lib/lead-engine-parcel';
import { createParcelLookup } from './lead-engine-parcel.service';
import type { ParcelLookup } from './lead-engine-parcel.service';
import { createApifyRuns, VendorError } from './lead-engine-apify-runs';
import type { ApifyRuns } from './lead-engine-apify-runs';
import { createBatchDataVerificationProvider } from './lead-engine-batchdata';
import type { BatchDataVerificationProvider } from './lead-engine-batchdata';
import type { LeadVerification } from '../lib/lead-engine-quality';
import { extractOwnersForRows, reviewVendorsFromEnv } from './lead-engine-reviews.service';
import { writeEdges } from './lead-engine-graph.service';
import { edgesFromDelivery, edgesFromMapsRow, edgesFromRegisterRow, edgesFromVerification } from '../lib/lead-engine-graph';
import type { GraphEdge } from '../lib/lead-engine-graph';
import { featuresFromLedger, scoreDialRows } from '../lib/lead-engine-score';

// Phase 1 Lane A behind the Phase 0 meter, plus the register recipes. A job advances one bounded step
// per call (read a register page, start a city run, poll it, page its dataset, bucket, verify ten numbers)
// so a serverless timeout never loses paid work, and the browser keeps calling advance until the job is
// delivered or parked. Every paid call asks the meter first. Every vendor failure freezes the job with a
// reason instead of throwing it away.
//   A: scrape -> verify -> deliver                      C: names (free) -> verify -> deliver
//   D: names -> scrape the register's cities -> bucket -> verify -> deliver
//   B: names (free) -> parcel (free, name to home) -> trace (BatchData skip trace, $0.07 a person) -> deliver
// deliver() runs the §7 quality gates and refuses (freeze) on any failure.

export interface JobVendors { apify: ApifyRuns | null; batchdata: BatchDataVerificationProvider | null; parcel?: ParcelLookup | null }
export function vendorsFromEnv(): JobVendors {
  return {
    apify: process.env.APIFY_API_TOKEN ? createApifyRuns(process.env.APIFY_API_TOKEN) : null,
    batchdata: process.env.BATCHDATA_API_KEY ? createBatchDataVerificationProvider(process.env.BATCHDATA_API_KEY) : null,
    // The parcel layers are public and free: no key, always available.
    parcel: createParcelLookup(),
  };
}

interface RpcError { code?: string; message?: string; details?: string }
function storageError(error: RpcError, fallback = 'The job could not be updated. Nothing was charged.'): LeadEngineError {
  const message = `${error.message ?? ''} ${error.details ?? ''}`;
  const known: Array<[RegExp, number, string, string]> = [
    [/insufficient_credits/, 402, 'insufficient_credits', 'Not enough credits available to hold this quote. Add credits and try again.'],
    [/legal_prohibited/, 403, 'legal_prohibited', 'Licensee lists are prohibited in that state. Choose the Google Maps fallback.'],
    [/job_not_found/, 404, 'job_not_found', 'That job was not found.'],
    [/not_resumable/, 409, 'not_resumable', 'This job cannot be resumed: its sample failed or its hold was refunded. Start a new job.'],
    [/invalid_job_transition/, 409, 'invalid_state', 'The job is not in a state that allows that action.'],
    [/cap_too_small/, 400, 'cap_too_small', 'The quote is too small to run: raise the target.'],
  ];
  for (const [pattern, status, code, text] of known) if (pattern.test(message)) return new LeadEngineError(status, code, text);
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new LeadEngineError(503, 'storage_pending', 'The jobs tables are not applied to this database yet.');
  return new LeadEngineError(503, 'storage_pending', fallback);
}

async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw storageError(error);
  return data as T;
}

export interface CreditBalance { available: number; held: number }
export async function creditBalance(db: SupabaseClient, operator: string): Promise<CreditBalance> {
  return rpc<CreditBalance>(db, 'lead_engine_credit_balance', { p_operator: operator });
}
export async function grantCredits(db: SupabaseClient, operator: string, credits: number, note: string): Promise<CreditBalance> {
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 100000) throw new LeadEngineError(400, 'invalid_input', 'Credits must be a whole number from 1 to 100,000.');
  return rpc<CreditBalance>(db, 'lead_engine_grant_credits', { p_operator: operator, p_credits: credits, p_note: note.slice(0, 300) });
}

export interface JobView { job: JobRecord; progress: JobProgress; quote: JobQuote | null; spend: Array<{ vendor: string; step: string; units: number; cents: number }>; ledger: Array<{ kind: string; credits: number; note: string | null; createdAt: string }>; rows: DeliveredRow[] }
export interface DeliveredRow {
  id: string; phone10: string; name: string; city: string | null; state: string | null; timeZone: string | null; stage: string; dropReason: string | null; ledgerId: string | null;
  verification: Record<string, unknown>; sourceUrl: string | null; rating: number | null; reviews: number | null;
  ownerName: string | null; email: string | null; sourceRegister: string | null; sourceRowId: string | null; bucket: number | null; mapsPhone: string | null; licenseIssueDate: string | null;
}

export async function listJobs(db: SupabaseClient, operator: string): Promise<JobRecord[]> {
  const { data, error } = await db.from('lead_engine_jobs').select('*').eq('operator_id', operator).order('created_at', { ascending: false }).limit(50);
  if (error) throw storageError(error, 'Your jobs could not be loaded.');
  return (data ?? []) as JobRecord[];
}

async function loadJob(db: SupabaseClient, operator: string, jobId: string): Promise<JobRecord> {
  const { data, error } = await db.from('lead_engine_jobs').select('*').eq('id', jobId).eq('operator_id', operator).maybeSingle();
  if (error) throw storageError(error, 'The job could not be loaded.');
  if (!data) throw new LeadEngineError(404, 'job_not_found', 'That job was not found.');
  return data as JobRecord;
}

export async function getJob(db: SupabaseClient, operator: string, jobId: string): Promise<JobView> {
  const job = await loadJob(db, operator, jobId);
  const [spend, ledger, rows] = await Promise.all([
    db.from('lead_engine_job_spend').select('vendor,step,units,cents').eq('job_id', jobId).order('created_at'),
    db.from('lead_engine_credits_ledger').select('kind,credits,note,created_at').eq('job_id', jobId).order('seq'),
    db.from('lead_engine_job_rows').select('id,phone10,name,city,state,time_zone,stage,drop_reason,ledger_id,verification,source_url,rating,reviews,owner_name,email,source_register,source_row_id,bucket,maps_phone')
      .eq('job_id', jobId).in('stage', ['delivered', 'held', 'verified']).order('updated_at', { ascending: false }).limit(2000),
  ]);
  let quote: JobQuote | null = null;
  // A job running recipe A for an industry the brain routes elsewhere is a fallback job: quote it as one.
  const brainRecipe = brain().industries.find(item => item.key === job.industry_key)?.recipe ?? 'A';
  try { quote = quoteJob({ industry: job.industry, state: job.state, targetCells: job.target_cells, useFallback: job.recipe === 'A' && brainRecipe !== 'A' }); } catch { quote = null; }
  return {
    job, progress: readProgress(job), quote,
    spend: (spend.data ?? []) as JobView['spend'],
    ledger: ((ledger.data ?? []) as Array<{ kind: string; credits: number; note: string | null; created_at: string }>).map(entry => ({ kind: entry.kind, credits: entry.credits, note: entry.note, createdAt: entry.created_at })),
    rows: ((rows.data ?? []) as Array<Record<string, unknown>>).map(row => ({
      id: String(row.id), phone10: String(row.phone10 ?? ''), name: String(row.name), city: (row.city as string | null) ?? null, state: (row.state as string | null) ?? null,
      timeZone: (row.time_zone as string | null) ?? null, stage: String(row.stage), dropReason: (row.drop_reason as string | null) ?? null, ledgerId: (row.ledger_id as string | null) ?? null,
      verification: (row.verification as Record<string, unknown>) ?? {}, sourceUrl: (row.source_url as string | null) ?? null, rating: (row.rating as number | null) ?? null, reviews: (row.reviews as number | null) ?? null,
      ownerName: (row.owner_name as string | null) ?? null, email: (row.email as string | null) ?? null, sourceRegister: (row.source_register as string | null) ?? null, sourceRowId: (row.source_row_id as string | null) ?? null,
      bucket: (row.bucket as number | null) ?? null, mapsPhone: (row.maps_phone as string | null) ?? null,
      licenseIssueDate: typeof (row.verification as Record<string, unknown> | null)?.license_issue_date === 'string' ? String((row.verification as Record<string, unknown>).license_issue_date) : null,
    })),
  };
}

// Quote and create in one step: the job lands as 'quoted' with nothing held. Holding is a second,
// explicit click because that is the moment credits leave the balance.
export async function createJob(db: SupabaseClient, operator: string, input: JobInput): Promise<{ job: JobRecord; quote: JobQuote; balance: CreditBalance }> {
  const quote = quoteJob(input);
  if (quote.blockers.length > 0) throw new LeadEngineError(409, 'job_blocked', quote.blockers.join(' '));
  const source = brain();
  const job = await rpc<JobRecord>(db, 'lead_engine_create_job', { p_operator: operator, p_id: input.id, p_input: {
    industry: input.industry, industry_key: quote.route.industry, state: input.state, target_cells: input.targetCells, dnc_mode: input.dncMode,
    recipe: quote.recipe, recipe_version: quote.recipe, brain_version: source.version, legal_status: quote.legalStatus, legal_note: quote.legalNote,
    expected_clean: quote.expectedClean, credits_per_cell: source.recipes[quote.recipe].creditsPerCleanCell, credit_cents: quote.creditCents, cap_ratio: source.spendCapRatio,
  } });
  return { job, quote, balance: await creditBalance(db, operator) };
}

export async function startJob(db: SupabaseClient, operator: string, jobId: string): Promise<JobRecord> {
  const job = await rpc<JobRecord>(db, 'lead_engine_hold_job', { p_operator: operator, p_job: jobId });
  if (Object.keys(job.progress ?? {}).length === 0) {
    const registerSource = job.recipe !== 'A' ? registerSourceFor(job.industry_key, job.state) : null;
    return rpc<JobRecord>(db, 'lead_engine_job_progress', { p_operator: operator, p_job: jobId, p_progress: initialProgress(citiesFor(job.state), job.recipe, registerSource) });
  }
  return job;
}

export async function resumeJob(db: SupabaseClient, operator: string, jobId: string, extraCredits: number): Promise<JobRecord> {
  if (!Number.isSafeInteger(extraCredits) || extraCredits < 0 || extraCredits > 100000) throw new LeadEngineError(400, 'invalid_input', 'Extra credits must be a whole number.');
  return rpc<JobRecord>(db, 'lead_engine_resume_job', { p_operator: operator, p_job: jobId, p_extra_credits: extraCredits });
}

interface MeterDecision { allowed: boolean; reason: string; remaining_cents: number; spend_id?: string | null; alert?: boolean; vendor_today_cents?: number; ceiling_cents?: number }
async function meter(db: SupabaseClient, operator: string, jobId: string, vendor: string, step: string, units: number, cents: number): Promise<MeterDecision> {
  return rpc<MeterDecision>(db, 'lead_engine_meter', { p_operator: operator, p_job: jobId, p_vendor: vendor, p_step: step, p_units: units, p_cents: cents });
}
async function saveProgress(db: SupabaseClient, operator: string, jobId: string, progress: Partial<JobProgress>): Promise<JobRecord> {
  return rpc<JobRecord>(db, 'lead_engine_job_progress', { p_operator: operator, p_job: jobId, p_progress: progress });
}
async function freeze(db: SupabaseClient, operator: string, jobId: string, reason: string): Promise<JobRecord> {
  return rpc<JobRecord>(db, 'lead_engine_freeze_job', { p_operator: operator, p_job: jobId, p_reason: reason.slice(0, 600) });
}

// Phase 5: the entity graph accumulates what the registers overwrite. Writing an edge must never stop a
// job, so failures are counted in progress.graphEdgeErrors and the run goes on.
async function graph(db: SupabaseClient, progress: JobProgress | undefined, edges: readonly GraphEdge[]): Promise<void> {
  if (edges.length === 0) return;
  try { await writeEdges(db, edges); }
  catch { if (progress) progress.graphEdgeErrors = (progress.graphEdgeErrors ?? 0) + 1; }
}

export interface AdvanceResult { job: JobRecord; progress: JobProgress; did: string; waiting: boolean }

// One step. Returns quickly; the caller loops while `waiting` or the job is still running.
export async function advanceJob(db: SupabaseClient, operator: string, jobId: string, vendors: JobVendors): Promise<AdvanceResult> {
  let job = await loadJob(db, operator, jobId);
  let progress = readProgress(job);
  const done = (did: string, waiting = false): AdvanceResult => ({ job, progress, did, waiting });
  if (job.status !== 'sample_running' && job.status !== 'running') return done(`Job is ${job.status}.`);
  const expectedClean = Number(job.expected_clean);
  const isRegister = job.recipe === 'B' || job.recipe === 'C' || job.recipe === 'D';
  // Recipes whose names step is the only source of rows (no city plan): B and C.
  const namesOnly = job.recipe === 'B' || job.recipe === 'C';

  // 0. Recipes B, C and D: read the register one page per call until enough names are in (free).
  if (isRegister && !progress.namesDone) return await pullNames(db, operator, job, progress, done);

  // 0b. Recipe B: names without a home address go to the parcel layer (free), homes go to the skip trace (paid).
  if (job.recipe === 'B') {
    const parcel = await parcelStep(db, operator, job, progress, vendors, done);
    if (parcel) return parcel;
    const trace = await traceStep(db, operator, job, progress, vendors, done);
    if (trace) return trace;
  }

  // 1. An open city run: poll it, then page its dataset one page per call.
  if (progress.run) {
    if (!vendors.apify) { job = await freeze(db, operator, jobId, 'Scraper account not configured.'); return done('Frozen: scraper account missing.'); }
    const run = progress.run;
    try {
      if (run.total === null) {
        const state = await vendors.apify.poll(run.runId);
        if (state.status === 'running') return done(`Scraping ${run.city}: waiting for the scraper.`, true);
        if (state.status === 'failed') { job = await freeze(db, operator, jobId, `Scraper run for ${run.city} failed at the provider.`); return done('Frozen: scraper run failed.'); }
        run.total = 0; // Mark finished; the first page call sets the real total.
      }
      const page = await vendors.apify.page(run.datasetId, run.offset, 50);
      run.total = page.total;
      const counts = await ingestRows(db, job, progress, run.city, run.sample, page.rows);
      progress.scraped += counts.kept; progress.filtered += counts.filtered;
      run.offset += page.rows.length;
      const finished = run.offset >= page.total || page.rows.length === 0;
      if (finished) {
        progress.run = null; progress.cityIndex += 1; progress.lastMessage = `${run.city}: ${page.total} places, ${counts.kept} kept so far this page.`;
        // Recipe D: a finished city means its register rows can now be contrasted with Maps.
        if (job.recipe === 'D') { progress.scrapedCities = [...new Set([...progress.scrapedCities, run.city])]; progress.bucketPending = true; progress.phase = 'bucket'; }
      }
      job = await saveProgress(db, operator, jobId, progress);
      return done(finished ? `Finished ${run.city}: ${page.total} places.` : `Read ${run.offset} of ${page.total} places from ${run.city}.`, false);
    } catch (error) {
      if (error instanceof LeadEngineError) throw error;
      job = await freeze(db, operator, jobId, `Scraper: ${error instanceof VendorError ? error.message : 'unexpected failure'}`);
      return done('Frozen: scraper error.');
    }
  }

  // 1b. Recipe D: the bucket step (pure matching, no vendor) after each scraped city.
  if (job.recipe === 'D' && progress.bucketPending) return await bucketStep(db, operator, job, progress, false, done);

  // 1c. A reviews scrape still running from a previous call finishes here before more paid verify.
  if (progress.reviewsRun) {
    await nameOwners(db, job, progress, []);
    job = await saveProgress(db, operator, jobId, progress);
    if (progress.reviewsRun) return done('Waiting for the reviews scrape to name the owners.', true);
  }

  // 2. Numbers waiting for verification: ten per call, cache first, meter before the vendor. Recipe D
  // verifies nothing until the row has a bucket (the ledger needs it).
  // During the sample only sample-flagged rows are paid for (recipe A flags the whole first city, C its
  // first 50 names, D the first 50 register rows it buckets).
  const pendingBase = () => {
    const base = db.from('lead_engine_job_rows').select('id,phone10,name,city,state,zip,place_id,source_url,rating,reviews,sample,owner_name,email,source_register,source_row_id,bucket,maps_phone,verification')
      .eq('job_id', jobId).eq('stage', 'scraped').not('phone10', 'is', null);
    return job.status === 'sample_running' ? base.eq('sample', true) : base;
  };
  const pending = job.recipe === 'D'
    ? await pendingBase().not('bucket', 'is', null).order('sample', { ascending: false }).order('created_at').limit(VERIFY_CHUNK)
    : await pendingBase().order('sample', { ascending: false }).order('created_at').limit(VERIFY_CHUNK);
  if (pending.error) throw storageError(pending.error, 'The job rows could not be read.');
  const rows = (pending.data ?? []) as PendingRow[];
  if (rows.length > 0) {
    if (!vendors.batchdata) { job = await freeze(db, operator, jobId, 'Phone verification account not configured.'); return done('Frozen: verification account missing.'); }
    const phones = rows.map(row => row.phone10);
    const cached = await db.from('lead_engine_verified').select('phone10,line_type,dnc,tcpa,reachable,verified_at').in('phone10', phones).gt('verified_at', new Date(Date.now() - 31 * 86400000).toISOString());
    const cache = new Map<string, LeadVerification>(((cached.data ?? []) as Array<{ phone10: string; line_type: string | null; dnc: boolean | null; tcpa: boolean | null; reachable: boolean | null; verified_at: string }>)
      .map(entry => [entry.phone10, { phone10: entry.phone10, lineType: entry.line_type, dnc: entry.dnc, tcpa: entry.tcpa, reachable: entry.reachable, verifiedAt: entry.verified_at }]));
    const fresh = phones.filter(phone => !cache.has(phone));
    if (fresh.length > 0) {
      const decision = await meter(db, operator, jobId, 'batchdata', 'verify', fresh.length, verifyCents(fresh.length));
      if (!decision.allowed) return await stopForMeter(db, operator, job, progress, decision, done);
      try {
        for (const phone of fresh) {
          const [result] = await vendors.batchdata.verifyPhones([phone]);
          cache.set(phone, result);
          await db.from('lead_engine_verified').upsert({ phone10: phone, line_type: result.lineType, dnc: result.dnc, tcpa: result.tcpa, reachable: result.reachable, vendor: 'batchdata', verified_at: result.verifiedAt ?? new Date().toISOString() }, { onConflict: 'phone10' });
        }
      } catch (error) {
        // Numbers already answered are cached; the rest are re-tried on resume. The job does not die.
        const reason = error instanceof LeadEngineError && error.code === 'provider_balance_exhausted' ? 'BatchData balance exhausted. Top up the vendor account, then resume.' : `Verification: ${error instanceof Error ? error.message.slice(0, 200) : 'unexpected failure'}`;
        job = await freeze(db, operator, jobId, reason); return done('Frozen: verification error.');
      }
    } else progress.cached += phones.length;
    const counts = await settleVerified(db, job, rows, cache, progress);
    progress.verified += counts.verified; progress.dropped += counts.dropped; progress.held += counts.held; progress.delivered += counts.delivered; progress.flagged += counts.flagged;
    // Phase 4 task 5: name the owner on delivered Maps rows that have none (free about page first, then
    // reviews behind the meter). Recipe B and C rows arrive named by the register.
    if (counts.delivered > 0 && (job.recipe === 'A' || job.recipe === 'D')) await nameOwners(db, job, progress, rows.map(row => row.id));
    job = await saveProgress(db, operator, jobId, progress);
    return done(`Verified ${rows.length} numbers: ${counts.delivered} callable, ${counts.dropped} dropped${progress.ownersNamed ? `, ${progress.ownersNamed} owners named so far` : ''}.`);
  }

  // 3. Nothing open and nothing pending: the sample gate, then widen or deliver.
  const sampleReady = job.status === 'sample_running' && (namesOnly ? progress.namesDone : progress.cityIndex >= 1);
  if (sampleReady) {
    // Recipe B's expected clean rate is per traced person (Anas §5), so the gate divides by traced rows; the
    // other recipes divide by verified numbers.
    const sampledBase = db.from('lead_engine_job_rows').select('stage').eq('job_id', jobId).eq('sample', true);
    const sampled = job.recipe === 'B' ? await sampledBase.not('verification->>trace_status', 'is', null) : await sampledBase.in('stage', ['verified', 'dropped', 'delivered', 'held']);
    if (sampled.error) throw storageError(sampled.error, 'The sample rows could not be read.');
    const verifiedCount = (sampled.data ?? []).length, clean = (sampled.data ?? []).filter(row => (row as { stage: string }).stage === 'delivered').length;
    const gate = sampleGate(verifiedCount, clean, expectedClean, brain().sample.abortBelowFractionOfExpected);
    const moreAvailable = namesOnly ? !progress.namesExhausted : progress.cityIndex < progress.cities.length;
    // Too small to judge and more to read: keep sampling before deciding.
    if (!gate.pass && verifiedCount < 20 && moreAvailable) {
      if (namesOnly) { progress.namesDone = false; progress.phase = 'names'; job = await saveProgress(db, operator, jobId, progress); return done(`Sample too small (${verifiedCount} ${job.recipe === 'B' ? 'traced' : 'verified'}): reading more register names.`); }
      /* A and D: fall through to the next city */
    } else {
      job = await rpc<JobRecord>(db, 'lead_engine_sample_result', { p_operator: operator, p_job: jobId, p_sample: { verified: verifiedCount, clean, cleanRate: gate.cleanRate, expected: expectedClean, threshold: gate.threshold, cities: progress.cityIndex, names: progress.names, traced: progress.traced }, p_pass: gate.pass, p_reason: gate.reason });
      if (!gate.pass) return done(`Sample failed: ${gate.reason}. Credits refunded.`);
      progress.phase = namesOnly ? 'names' : 'run';
      if (namesOnly) progress.namesDone = false; // the run reads the rest of the register
      job = await saveProgress(db, operator, jobId, progress);
      return done(`Sample passed: ${(gate.cleanRate * 100).toFixed(0)}% clean. Widening.`);
    }
  }
  if (progress.delivered >= job.target_cells) return await deliver(db, operator, job, progress, 'Target reached.', done);
  if (namesOnly) {
    // Nothing pending: read another register page, or deliver when the register is exhausted.
    if (!progress.namesExhausted && progress.names < NAMES_MAX) { progress.namesDone = false; progress.phase = 'names'; job = await saveProgress(db, operator, jobId, progress); return done(`${progress.delivered} of ${job.target_cells} delivered: reading more register names.`); }
    return await deliver(db, operator, job, progress, `Register ${progress.registerSource ?? ''} exhausted after ${progress.names} names.`.replace('  ', ' '), done);
  }
  if (progress.cityIndex >= progress.cities.length) {
    // Recipe D: register rows in cities never scraped are bucket 1 by definition; verify them before delivering.
    if (job.recipe === 'D') {
      const unbucketed = await db.from('lead_engine_job_rows').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('stage', 'scraped').is('bucket', null).neq('source_register', 'google_maps');
      if (unbucketed.error) throw storageError(unbucketed.error, 'The job rows could not be counted.');
      if ((unbucketed.count ?? 0) > 0) return await bucketStep(db, operator, job, progress, true, done);
    }
    return await deliver(db, operator, job, progress, `All ${progress.cities.length} cities scraped.`, done);
  }

  // 4. Start the next city.
  if (!vendors.apify) { job = await freeze(db, operator, jobId, 'Scraper account not configured.'); return done('Frozen: scraper account missing.'); }
  const city = progress.cities[progress.cityIndex];
  const places = job.status === 'sample_running' ? 125 : placesForNextCity(job.target_cells, progress.delivered, expectedClean);
  const cents = scrapeCents(places);
  const decision = await meter(db, operator, jobId, 'apify', 'scrape', places, cents);
  if (!decision.allowed) return await stopForMeter(db, operator, job, progress, decision, done);
  try {
    const keyword = scrapeKeyword(job.industry_key, job.industry);
    const started = await vendors.apify.start({ searchTerm: keyword, location: city, maxPlaces: places, maxChargeCents: Math.max(50, cents) });
    progress.run = { runId: started.runId, datasetId: started.datasetId, city, offset: 0, total: started.status === 'succeeded' ? 0 : null, places, sample: job.status === 'sample_running' };
    progress.phase = job.status === 'sample_running' ? 'scrape' : 'run';
    progress.lastMessage = `Started ${city}: ${places} places, $${(cents / 100).toFixed(2)}.`;
    job = await saveProgress(db, operator, jobId, progress);
    return done(progress.lastMessage, true);
  } catch (error) {
    // The meter already recorded the charge; the provider refused. Freeze with the reason: no retry loop, no vendor switch.
    job = await freeze(db, operator, jobId, `Scraper could not start ${city}: ${error instanceof VendorError ? error.message : 'unexpected failure'}`);
    return done('Frozen: scraper could not start.');
  }
}

// Owner names from the website and, when that fails, from reviews (Apify + Haiku, both metered). A running
// reviews scrape is remembered in progress.reviewsRun and finished on a later call; nothing here can freeze
// the job: a vendor failure only leaves the owner column empty.
async function nameOwners(db: SupabaseClient, job: JobRecord, progress: JobProgress, rowIds: string[]): Promise<void> {
  try {
    const pending = progress.reviewsRun;
    const ids = pending ? pending.rowIds : rowIds;
    const rows = await db.from('lead_engine_job_rows').select('id,name,place_id,website,owner_name,verification').in('id', ids).eq('stage', 'delivered').is('owner_name', null);
    if (rows.error || !rows.data || rows.data.length === 0) { progress.reviewsRun = null; return; }
    const candidates = rows.data.map(row => ({ ...row, line_type: typeof row.verification?.lineType === 'string' ? row.verification.lineType : null }));
    const result = await extractOwnersForRows(db, { id: job.id, operator_id: job.operator_id }, candidates, reviewVendorsFromEnv(),
      pending ? { runId: pending.runId, datasetId: pending.datasetId } : {});
    progress.ownersNamed = (progress.ownersNamed ?? 0) + result.results.filter(item => item.owner).length;
    progress.reviewsRun = result.apifyRun ? { runId: result.apifyRun.runId, datasetId: result.apifyRun.datasetId, rowIds: ids } : null;
    if (result.stopped) progress.lastMessage = `Owner names: ${result.stopped}`;
  } catch (error) { progress.lastMessage = `Owner names skipped: ${error instanceof Error ? error.message.slice(0, 120) : 'failure'}`; progress.reviewsRun = null; }
}

async function stopForMeter(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, decision: MeterDecision, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult> {
  if (decision.reason === 'cap') {
    // Brain guardrail 1: on cap, deliver what exists, settle, stop.
    return deliver(db, operator, job, progress, `Spend cap reached ($${(job.cap_cents / 100).toFixed(2)}).`, done);
  }
  const reason = decision.reason === 'daily_ceiling' ? `Daily vendor ceiling reached ($${((decision.ceiling_cents ?? 0) / 100).toFixed(2)}). Resume tomorrow or raise the ceiling.`
    : decision.reason === 'execution_disabled' ? 'Execution is switched off in lead_engine_control.' : `Meter refused: ${decision.reason}.`;
  await freeze(db, operator, job.id, reason);
  return done(`Frozen: ${reason}`);
}

// Anas §7: every gate is a blocking check. A failure parks the job with the gate names in the reason;
// the one operator-overridable gate (clean rate outside 10% to 70%) ships only after an explicit resume,
// with the override recorded on the Summary tab.
async function deliver(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, why: string, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult> {
  if (progress.delivered > 0 || progress.flagged > 0) {
    const rows = await db.from('lead_engine_job_rows').select('phone10,name,state,time_zone,stage,drop_reason,verification')
      .eq('job_id', job.id).or('stage.eq.delivered,and(stage.eq.verified,drop_reason.eq.dnc_flagged)').limit(NAMES_MAX * 2);
    if (rows.error) throw storageError(rows.error, 'The delivered rows could not be read for the quality gates.');
    const gateRows: JobGateRow[] = ((rows.data ?? []) as Array<Record<string, unknown>>).map(row => {
      const v = (row.verification as Record<string, unknown> | null) ?? {};
      return { phone10: String(row.phone10 ?? ''), company: String(row.name ?? ''), state: (row.state as string | null) ?? null, timeZone: (row.time_zone as string | null) ?? null,
        lineType: typeof v.lineType === 'string' ? v.lineType : null, dnc: typeof v.dnc === 'boolean' ? v.dnc : null, tcpa: typeof v.tcpa === 'boolean' ? v.tcpa : null, reachable: typeof v.reachable === 'boolean' ? v.reachable : null,
        flagged: row.stage === 'verified',
        // Lane B evidence (05 §7): the traced address and how many distinct parcel owners the name matched.
        traced: v.trace_status === 'matched', homeStreet: typeof v.home_street === 'string' ? v.home_street : null, parcelOwners: typeof v.parcel_owner_count === 'number' ? v.parcel_owner_count : null };
    });
    const previous = progress.gateFailures ?? [];
    const gate = evaluateJobGates({
      rows: gateRows, dncMode: job.dnc_mode, verifiedInput: progress.verified, summary: { delivered: progress.delivered, flagged: progress.flagged },
      brokenFilterOverride: previous.length > 0 && previous.every(item => item.startsWith('clean_rate_out_of_range')), recipe: job.recipe, industryKey: job.industry_key,
    });
    if (gate.failures.length > 0) {
      progress.gateFailures = gate.failures; progress.phase = 'gate'; progress.lastMessage = `Quality gates blocked delivery: ${gate.failures.join('; ')}`;
      await saveProgress(db, operator, job.id, progress);
      const overridable = gate.failures.every(item => item.startsWith('clean_rate_out_of_range'));
      await freeze(db, operator, job.id, `Quality gate blocked delivery (${why}): ${gate.failures.join('; ')}.${overridable ? ' Resume to deliver anyway; the override is recorded on the file.' : ''}`);
      return done(`Frozen: quality gates failed (${gate.failures.join('; ')}).`);
    }
    progress.gateFailures = []; progress.gateNote = gate.note;
  }
  progress.phase = 'done'; progress.lastMessage = why;
  await saveProgress(db, operator, job.id, progress);
  if (progress.delivered === 0 && job.status === 'sample_running') {
    await rpc(db, 'lead_engine_sample_result', { p_operator: operator, p_job: job.id, p_sample: { verified: progress.verified, clean: 0 }, p_pass: false, p_reason: `No callable cells found. ${why}` });
    return done(`Nothing to deliver. ${why} Credits refunded.`);
  }
  if (job.status === 'sample_running') await rpc(db, 'lead_engine_sample_result', { p_operator: operator, p_job: job.id, p_sample: { verified: progress.verified, clean: progress.delivered, note: why }, p_pass: true, p_reason: null });
  await rpc(db, 'lead_engine_deliver_job', { p_operator: operator, p_job: job.id, p_delivered: progress.delivered, p_flagged: progress.flagged });
  return done(`Delivered ${progress.delivered} cells. ${why}`);
}

interface PendingRow {
  id: string; phone10: string; name: string; city: string | null; state: string | null; zip: string | null; place_id: string | null; source_url: string | null; rating: number | null; reviews: number | null; sample: boolean;
  owner_name: string | null; email: string | null; source_register: string | null; source_row_id: string | null; bucket: number | null; maps_phone: string | null; verification: Record<string, unknown> | null;
}

const EXCLUDE_CHUNK = 200;
// Phones already delivered (any job) or suppressed (global): never read from a register into a job.
async function excludedPhones(db: SupabaseClient, phones: string[]): Promise<Set<string>> {
  const excluded = new Set<string>();
  for (let index = 0; index < phones.length; index += EXCLUDE_CHUNK) {
    const chunk = phones.slice(index, index + EXCLUDE_CHUNK);
    const [delivered, suppressed] = await Promise.all([db.from('lead_engine_deliveries').select('phone10').in('phone10', chunk), db.from('lead_engine_suppressions').select('phone10').in('phone10', chunk)]);
    if (delivered.error) throw storageError(delivered.error, 'Delivered numbers could not be read.');
    if (suppressed.error) throw storageError(suppressed.error, 'Suppressed numbers could not be read.');
    for (const row of [...(delivered.data ?? []), ...(suppressed.data ?? [])] as Array<{ phone10: string }>) excluded.add(row.phone10);
  }
  return excluded;
}

// Recipes B, C and D, names step: one register page per call. Reads lead_engine_names for the mapped
// source (state filtered for nationwide files and for recipe B, business_type filtered when the brain id
// carries one, county filtered when the parcel layer covers one county), reuse_count <= 3 in the query and
// again in code, newest licence first, excludes delivered and suppressed phones, writes job rows at stage
// scraped with the licence facts in `verification` (license_issue_date, reuse_count, title_code,
// register_street). The sample is the first 50 names. Recipe C needs a phone on the row; B and D also take
// rows without one. Recipe B rows also carry first/last name and, when the file has the home street, the
// address the trace will use (parcel skipped, brain skip_if).
async function pullNames(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult> {
  const sourceId = progress.registerSource ?? registerSourceFor(job.industry_key, job.state);
  if (!sourceId) { await freeze(db, operator, job.id, `No register source is mapped for ${job.industry_key} in ${job.state}.`); return done('Frozen: register source missing.'); }
  progress.registerSource = sourceId; progress.phase = 'names';
  const { source, filter } = splitRegisterSource(sourceId);
  const industry = brain().industries.find(item => item.key === job.industry_key);
  const nationwide = industry !== undefined && !(job.state in industry.registerSource) && '*' in industry.registerSource;
  // Recipes B and C sample the first 50 names here. Recipe D reads its whole (free) budget first and flags its
  // sample at bucket time, because only rows in a scraped city can be contrasted and verified.
  const sampling = job.status === 'sample_running' && (job.recipe === 'B' || job.recipe === 'C');
  // First sample pull: 50 names. A "sample too small" re-pull adds another 50 so the gate has enough to judge.
  const sampleTarget = progress.names >= NAMES_SAMPLE ? progress.names + NAMES_SAMPLE : NAMES_SAMPLE;
  const limit = sampling ? NAMES_SAMPLE * 2 : NAMES_PAGE;
  let query = db.from('lead_engine_names')
    .select('id,source,source_row_id,first_name,last_name,company,title_code,business_type,license_issue_date,street,city,county,state,zip,phone10,email,reuse_count')
    .eq('source', source).lte('reuse_count', PHONE_REUSE_MAX);
  if (nationwide || job.recipe === 'B') query = query.eq('state', job.state);
  if (filter) query = query.ilike('business_type', `%${filter}%`);
  if (job.recipe === 'C') query = query.not('phone10', 'is', null);
  if (job.recipe === 'B') {
    // A person must have a first and a last name to be parcel-matched or traced (never a surname alone).
    query = query.not('first_name', 'is', null).not('last_name', 'is', null);
    // A county-scoped parcel layer cannot find a licensee who lives elsewhere: skip those rows when the register says the county.
    const parcel = parcelSourceFor(job.state);
    if (parcel?.county && sourceId && !homeStreetSkipsParcel(sourceId)) query = query.or(`county.is.null,county.ilike.${parcel.county}`);
  }
  const page = await query.order('license_issue_date', { ascending: false, nullsFirst: false }).order('id').range(progress.namesOffset, progress.namesOffset + limit - 1);
  if (page.error) throw storageError(page.error, 'The register could not be read.');
  const raw = (page.data ?? []) as Array<RegisterNameRow & { county: string | null }>;
  const excluded = await excludedPhones(db, raw.map(row => row.phone10).filter((phone): phone is string => Boolean(phone)));
  const selection = selectRegisterNames(raw, excluded, { requirePhone: job.recipe === 'C' });
  const kept = sampling ? selection.kept.slice(0, Math.max(0, sampleTarget - progress.names)) : selection.kept;
  // The register page and the selection share one order (newest licence first, then id), so a sliced
  // sample page only advances the offset past the last row it actually took.
  const consumed = kept.length < selection.kept.length && kept.length > 0 ? raw.indexOf(kept[kept.length - 1] as typeof raw[number]) + 1 : raw.length;
  let inserted = 0;
  for (const row of kept) {
    const person = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
    const verification: Record<string, unknown> = { license_issue_date: row.license_issue_date, reuse_count: row.reuse_count, title_code: row.title_code, business_type: row.business_type, register_street: row.street };
    let stage = 'scraped', dropReason: string | null = null;
    if (job.recipe === 'B') {
      verification.first_name = row.first_name; verification.last_name = row.last_name; verification.county = (row as { county?: string | null }).county ?? null;
      const origin = homeStreetSource(sourceId, row.title_code, row.street);
      verification.home_street_source = origin;
      if (origin !== 'parcel') {
        // The licence file already says where the person lives: skip the parcel step, keep the street gate.
        if (streetOk(row.street)) { verification.parcel_status = 'skipped_register_street'; verification.home_street = row.street; verification.home_city = row.city; verification.home_zip = row.zip; progress.parcelSkipped++; }
        else { verification.parcel_status = 'street_not_ok'; stage = 'dropped'; dropReason = 'street_not_ok'; progress.parcelDropped++; }
      }
    }
    const result = await db.from('lead_engine_job_rows').insert({
      job_id: job.id, operator_id: job.operator_id, phone10: row.phone10, name: registerRowName(row), city: row.city, state: row.state ?? job.state, zip: row.zip,
      place_id: null, source_url: null, website: null, rating: null, reviews: null, owner_name: person?.slice(0, 200) ?? null, email: row.email,
      source_register: row.source, source_row_id: row.source_row_id, bucket: null, maps_phone: null, stage, drop_reason: dropReason,
      sample: sampling, verification,
    });
    if (result.error && result.error.code === '23505') { selection.droppedDuplicate++; continue; }
    if (result.error) throw storageError(result.error, 'Register rows could not be saved into the job.');
    inserted++;
    await graph(db, progress, edgesFromRegisterRow({ source: row.source, source_row_id: row.source_row_id, first_name: row.first_name, last_name: row.last_name, company: row.company,
      title_code: row.title_code, business_type: row.business_type, license_issue_date: row.license_issue_date, state: row.state ?? job.state, zip: row.zip, phone10: row.phone10 }));
  }
  progress.names += inserted; progress.namesOffset += consumed;
  progress.namesDroppedReuse += selection.droppedReuse; progress.namesDroppedDelivered += selection.droppedDelivered + selection.droppedDuplicate; progress.namesDroppedNoPhone += selection.droppedNoPhone;
  progress.namesExhausted = raw.length < limit;
  const wanted = sampling ? sampleTarget : namesWanted(job.target_cells, progress.delivered, Number(job.expected_clean));
  progress.namesDone = progress.namesExhausted || progress.names >= wanted || progress.names >= NAMES_MAX;
  if (progress.namesDone && job.recipe === 'D' && progress.scrapedCities.length === 0) {
    // The register's busiest cities become the scrape plan (one city during the sample).
    const cities = await db.from('lead_engine_job_rows').select('city').eq('job_id', job.id).neq('source_register', 'google_maps').limit(NAMES_MAX);
    if (cities.error) throw storageError(cities.error, 'The register cities could not be read.');
    const top = topRegisterCities(((cities.data ?? []) as Array<{ city: string | null }>).map(row => row.city), job.state, REGISTER_CITIES_MAX);
    progress.cities = top.length > 0 ? top : citiesFor(job.state).slice(0, REGISTER_CITIES_MAX); progress.cityIndex = 0; progress.phase = 'scrape';
  } else if (progress.namesDone) progress.phase = job.recipe === 'D' ? 'scrape' : job.recipe === 'B' ? 'parcel' : 'verify';
  progress.lastMessage = `Register ${sourceId}: ${progress.names} names in (${progress.namesDroppedReuse} on shared phones, ${progress.namesDroppedDelivered} already delivered or duplicate${progress.namesDroppedNoPhone ? `, ${progress.namesDroppedNoPhone} without a phone` : ''}).`;
  await saveProgress(db, operator, job.id, progress);
  return done(progress.namesExhausted ? `Register exhausted: ${progress.names} names read.` : `Read ${raw.length} register rows, kept ${inserted}.`);
}

// True when every row of the register carries the home street (the county filter would only lose rows).
function homeStreetSkipsParcel(sourceId: string): boolean { return homeStreetSource(sourceId, null, null) === 'register'; }

interface RecipeBRow { id: string; name: string; city: string | null; state: string | null; zip: string | null; sample: boolean; source_register: string | null; source_row_id: string | null; email: string | null; verification: Record<string, unknown> | null }
const vstr = (v: Record<string, unknown> | null, key: string): string | null => typeof v?.[key] === 'string' && (v[key] as string).trim() ? (v[key] as string) : null;

// Recipe B parcel step (free): names without a home address, PARCEL_CHUNK per call, sample rows first. One
// GET per name against the state's parcel layer; exactly one owner-occupied parcel naming the person
// becomes the trace address. Zero or two owners is a drop, never a guess. Three endpoint failures freeze
// the job (no retry loop). The first three addresses are logged for the operator's eyes (brain guardrail).
// Returns null when nothing is waiting for a parcel.
async function parcelStep(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, vendors: JobVendors, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult | null> {
  const base = db.from('lead_engine_job_rows').select('id,name,city,state,zip,sample,source_register,source_row_id,email,verification')
    .eq('job_id', job.id).eq('stage', 'scraped').is('phone10', null).is('verification->>parcel_status', null);
  const pending = await (job.status === 'sample_running' ? base.eq('sample', true) : base).order('sample', { ascending: false }).order('created_at').limit(PARCEL_CHUNK);
  if (pending.error) throw storageError(pending.error, 'The names waiting for a parcel could not be read.');
  const rows = (pending.data ?? []) as RecipeBRow[];
  if (rows.length === 0) return null;
  const source = parcelSourceFor(job.state);
  if (!source) { await freeze(db, operator, job.id, `No parcel layer for ${job.state}: recipe B cannot turn these names into home addresses.`); return done('Frozen: no parcel layer.'); }
  const lookup = vendors.parcel ?? createParcelLookup();
  progress.phase = 'parcel';
  const now = new Date().toISOString();
  let resolved = 0, dropped = 0, failures = 0;
  for (const row of rows) {
    const first = vstr(row.verification, 'first_name'), last = vstr(row.verification, 'last_name');
    const update = async (patch: Record<string, unknown>) => {
      const saved = await db.from('lead_engine_job_rows').update({ ...patch, updated_at: now }).eq('id', row.id);
      if (saved.error) throw storageError(saved.error, 'A parcel result could not be saved.');
    };
    if (!first || !last) { dropped++; await update({ stage: 'dropped', drop_reason: 'name_incomplete', verification: { ...row.verification, parcel_status: 'name_incomplete' } }); continue; }
    if (progress.parcelFailures + failures >= PARCEL_MAX_FAILURES) break;
    const hits = await lookup.lookup(first, last, job.state);
    const result = resolveHome(first, last, hits);
    if (result.status === 'failed') { failures++; continue; }
    progress.parcelChecked++;
    if (result.status !== 'matched' || !result.hit) {
      dropped++;
      await update({ stage: 'dropped', drop_reason: `parcel_${result.status}`, verification: { ...row.verification, parcel_status: result.status, parcel_owner_count: result.owners, parcel_source: source.label } });
      continue;
    }
    resolved++;
    const hit = result.hit;
    if (progress.addressCheck.length < 3) progress.addressCheck.push(addressLine({ first, last, street: hit.street, city: hit.city || row.city || '', state: job.state, zip: hit.zip }));
    await update({ city: hit.city || row.city, zip: /^\d{5}$/.test(hit.zip) ? hit.zip : row.zip, verification: { ...row.verification, parcel_status: 'matched', parcel_owner_count: 1, parcel_owner_string: hit.owner, parcel_source: source.label, home_street: hit.street, home_city: hit.city || row.city, home_zip: hit.zip || row.zip } });
  }
  progress.parcelResolved += resolved; progress.parcelDropped += dropped; progress.parcelFailures += failures;
  progress.lastMessage = `Parcel ${source.label}: ${progress.parcelResolved} of ${progress.parcelChecked} names resolved to exactly one home (${progress.parcelSkipped} carried the street already).`;
  await saveProgress(db, operator, job.id, progress);
  if (progress.parcelFailures >= PARCEL_MAX_FAILURES) {
    await freeze(db, operator, job.id, `${job.state} parcel endpoint (${source.label}) failed or timed out ${progress.parcelFailures} times. Stopped without retrying; resume later.`);
    return done('Frozen: parcel endpoint failing.');
  }
  return done(`Parcel: ${resolved} homes found, ${dropped} names without a single home${failures ? `, ${failures} lookups failed` : ''}.`);
}

// Recipe B trace step (paid): homes without a phone, TRACE_CHUNK per call, sample rows first. The meter
// records $0.07 a person before BatchData is called (the vendor bills per request sent). Answers are matched
// by identity, never by position; the best clean Mobile becomes the row's phone and goes straight through
// the same settlement as a verified number (DNC mode, time zone, global dedupe, ledger). No Mobile or no
// answer is a drop with its reason. Returns null when nothing is waiting for a trace.
async function traceStep(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, vendors: JobVendors, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult | null> {
  const base = db.from('lead_engine_job_rows').select('id,name,city,state,zip,sample,source_register,source_row_id,email,verification')
    .eq('job_id', job.id).eq('stage', 'scraped').is('phone10', null).not('verification->>home_street', 'is', null).is('verification->>trace_status', null);
  const pending = await (job.status === 'sample_running' ? base.eq('sample', true) : base).order('sample', { ascending: false }).order('created_at').limit(TRACE_CHUNK);
  if (pending.error) throw storageError(pending.error, 'The homes waiting for a trace could not be read.');
  const rows = (pending.data ?? []) as RecipeBRow[];
  if (rows.length === 0) return null;
  if (!vendors.batchdata) { await freeze(db, operator, job.id, 'Skip trace account (BatchData) not configured.'); return done('Frozen: skip trace account missing.'); }
  progress.phase = 'trace';
  // Lane B gate before paying: only addresses with number + street + suffix are traced (engine.py show_addresses).
  const requests = rows.map(row => ({ row, first: vstr(row.verification, 'first_name') ?? '', last: vstr(row.verification, 'last_name') ?? '', street: vstr(row.verification, 'home_street') ?? '', city: vstr(row.verification, 'home_city') ?? row.city ?? '', state: job.state, zip: vstr(row.verification, 'home_zip') ?? row.zip ?? '' }));
  const now = new Date().toISOString();
  const traceable = requests.filter(item => item.first && item.last && streetOk(item.street));
  for (const item of requests.filter(item => !traceable.includes(item))) {
    const saved = await db.from('lead_engine_job_rows').update({ stage: 'dropped', drop_reason: 'street_not_ok', verification: { ...item.row.verification, trace_status: 'not_traced' }, updated_at: now }).eq('id', item.row.id);
    if (saved.error) throw storageError(saved.error, 'A row could not be dropped before the trace.');
    progress.parcelDropped++;
  }
  if (traceable.length === 0) { await saveProgress(db, operator, job.id, progress); return done(`Trace: ${requests.length} rows dropped before paying (street incomplete).`); }
  const decision = await meter(db, operator, job.id, 'batchdata', 'trace', traceable.length, traceCents(traceable.length));
  if (!decision.allowed) return await stopForMeter(db, operator, job, progress, decision, done);
  let results: Awaited<ReturnType<BatchDataVerificationProvider['skipTrace']>>;
  try {
    results = await vendors.batchdata.skipTrace(traceable.map(item => ({ first: item.first, last: item.last, street: item.street, city: item.city, state: item.state, zip: item.zip })));
  } catch (error) {
    // The meter already recorded the charge; the vendor refused. Freeze with the reason: no retry loop, no vendor switch.
    const reason = error instanceof LeadEngineError && error.code === 'provider_balance_exhausted' ? 'BatchData balance exhausted during the skip trace. Top up the vendor account, then resume.' : `Skip trace: ${error instanceof Error ? error.message.slice(0, 200) : 'unexpected failure'}`;
    await freeze(db, operator, job.id, reason); return done('Frozen: skip trace error.');
  }
  const settle: PendingRow[] = [];
  const cache = new Map<string, LeadVerification>();
  let matched = 0, unmatched = 0, noMobile = 0, duplicates = 0;
  for (let index = 0; index < traceable.length; index++) {
    const item = traceable[index], result = results[index];
    const verification: Record<string, unknown> = { ...item.row.verification, trace_status: result.status, trace_vendor: 'batchdata', traced_at: now, trace_score: result.score, trace_phones_seen: result.phonesSeen, trace_email: result.email };
    if (result.status !== 'matched') {
      unmatched++;
      const saved = await db.from('lead_engine_job_rows').update({ stage: 'dropped', drop_reason: 'trace_unmatched', verification, updated_at: now }).eq('id', item.row.id);
      if (saved.error) throw storageError(saved.error, 'A trace result could not be saved.');
      continue;
    }
    matched++;
    if (!result.phone10) {
      noMobile++;
      const saved = await db.from('lead_engine_job_rows').update({ stage: 'dropped', drop_reason: 'trace_no_mobile', email: result.email ?? item.row.email, verification: { ...verification, lineType: result.lineType, vendor: 'batchdata' }, updated_at: now }).eq('id', item.row.id);
      if (saved.error) throw storageError(saved.error, 'A trace result could not be saved.');
      continue;
    }
    // The traced number lands on the row; the same ten digits already on another row of this job is a duplicate, not a second owner.
    const saved = await db.from('lead_engine_job_rows').update({ phone10: result.phone10, email: result.email ?? item.row.email, verification, updated_at: now }).eq('id', item.row.id);
    if (saved.error && saved.error.code === '23505') {
      duplicates++;
      const dropped = await db.from('lead_engine_job_rows').update({ stage: 'dropped', drop_reason: 'duplicate_phone', verification, updated_at: now }).eq('id', item.row.id);
      if (dropped.error) throw storageError(dropped.error, 'A duplicate trace result could not be saved.');
      continue;
    }
    if (saved.error) throw storageError(saved.error, 'A trace result could not be saved.');
    // A skip-trace Mobile is a live number the vendor scored for this person: it is treated as reachable (the
    // trace answer has no separate reachability flag; the ledger records the evidence as the skip trace).
    cache.set(result.phone10, { phone10: result.phone10, lineType: 'Mobile', dnc: result.dnc, tcpa: result.tcpa, reachable: true, verifiedAt: now });
    settle.push({ id: item.row.id, phone10: result.phone10, name: item.row.name, city: item.city || item.row.city, state: job.state, zip: /^\d{5}$/.test(item.zip) ? item.zip : item.row.zip, place_id: null, source_url: null, rating: null, reviews: null, sample: item.row.sample,
      owner_name: `${item.first} ${item.last}`, email: result.email ?? item.row.email, source_register: item.row.source_register, source_row_id: item.row.source_row_id, bucket: null, maps_phone: null, verification });
  }
  const counts = settle.length > 0 ? await settleVerified(db, job, settle, cache) : { verified: 0, dropped: 0, held: 0, delivered: 0, flagged: 0 };
  progress.traced += traceable.length; progress.traceMatched += matched; progress.traceUnmatched += unmatched;
  progress.verified += counts.verified; progress.dropped += counts.dropped + noMobile + unmatched + duplicates; progress.held += counts.held; progress.delivered += counts.delivered; progress.flagged += counts.flagged;
  progress.lastMessage = `Trace: ${progress.traced} persons traced, ${progress.traceMatched} answered, ${progress.delivered} callable so far.`;
  await saveProgress(db, operator, job.id, progress);
  return done(`Traced ${traceable.length} persons ($${(traceCents(traceable.length) / 100).toFixed(2)}): ${counts.delivered} callable, ${noMobile} without a mobile, ${unmatched} unanswered.`);
}

const BUCKET_REGISTER_LIMIT = 1000;
const BUCKET_MAPS_LIMIT = 3000;
const cityKey = (value: string | null) => (value ?? '').split(',')[0].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Recipe D bucket step. Register rows still without a bucket in the cities scraped so far are matched
// against this job's Maps rows (src/lib/lead-engine-buckets.ts). `final` buckets every remaining register
// row (cities never scraped are bucket 1: no Maps listing was seen). Bounded: 1,000 register rows a call.
async function bucketStep(db: SupabaseClient, operator: string, job: JobRecord, progress: JobProgress, final: boolean, done: (did: string, waiting?: boolean) => AdvanceResult): Promise<AdvanceResult> {
  progress.phase = 'bucket';
  const registerRows = await db.from('lead_engine_job_rows').select('id,name,owner_name,city,zip,phone10,verification').eq('job_id', job.id).eq('stage', 'scraped').is('bucket', null).neq('source_register', 'google_maps').order('created_at').limit(BUCKET_REGISTER_LIMIT);
  if (registerRows.error) throw storageError(registerRows.error, 'Register rows could not be read for bucketing.');
  const scraped = new Set(progress.scrapedCities.map(cityKey));
  const register: RegisterRow[] = ((registerRows.data ?? []) as Array<Record<string, unknown>>)
    .filter(row => final || scraped.has(cityKey((row.city as string | null) ?? null)))
    .map(row => ({ id: String(row.id), name: String(row.name ?? ''), ownerName: (row.owner_name as string | null) ?? null, street: typeof (row.verification as Record<string, unknown> | null)?.register_street === 'string' ? String((row.verification as Record<string, unknown>).register_street) : null, city: (row.city as string | null) ?? null, zip: (row.zip as string | null) ?? null, phone10: (row.phone10 as string | null) ?? null }));
  // Maps rows not yet verified stay matchable, including ones already marked bucket 4 by an earlier pass.
  const mapsRows = await db.from('lead_engine_job_rows').select('id,name,city,zip,phone10,place_id,verification,bucket').eq('job_id', job.id).eq('stage', 'scraped').eq('source_register', 'google_maps').limit(BUCKET_MAPS_LIMIT);
  if (mapsRows.error) throw storageError(mapsRows.error, 'Maps rows could not be read for bucketing.');
  const mapsUnbucketed = new Set(((mapsRows.data ?? []) as Array<Record<string, unknown>>).filter(row => row.bucket === null).map(row => String(row.id)));
  const maps: MapsRow[] = ((mapsRows.data ?? []) as Array<Record<string, unknown>>).map(row => ({ id: String(row.id), name: String(row.name ?? ''), street: typeof (row.verification as Record<string, unknown> | null)?.maps_street === 'string' ? String((row.verification as Record<string, unknown>).maps_street) : null, city: (row.city as string | null) ?? null, zip: (row.zip as string | null) ?? null, phone10: (row.phone10 as string | null) ?? null, placeId: (row.place_id as string | null) ?? null }));
  const result = assignBuckets(register, maps);
  const now = new Date().toISOString();
  const update = async (id: string, patch: Record<string, unknown>) => {
    const saved = await db.from('lead_engine_job_rows').update({ ...patch, updated_at: now }).eq('id', id);
    if (saved.error) throw storageError(saved.error, 'A bucketed row could not be saved.');
  };
  const phoneless = new Set(register.filter(row => !row.phone10).map(row => row.id));
  const mapsBucket4 = new Set(result.mapsOnly);
  let sampled = 0;
  for (const assignment of result.register) {
    const scores = { bucket_name_score: Number(assignment.nameScore.toFixed(3)), bucket_address_score: Number(assignment.addressScore.toFixed(3)), bucket_evidence: assignment.evidence };
    if (phoneless.has(assignment.registerId)) {
      // Nothing to contrast: the register named the owner but printed no phone. The matched Maps line, if any, is verified as bucket 4.
      await update(assignment.registerId, { bucket: assignment.bucket, stage: 'filtered', drop_reason: 'no_register_phone', place_id: assignment.placeId, maps_phone: assignment.mapsPhone, verification: scores });
      if (assignment.mapsId) mapsBucket4.add(assignment.mapsId);
      continue;
    }
    // The recipe D sample: the first 50 bucketed register rows with a phone are what the sample verifies.
    const sample = job.status === 'sample_running' && sampled < NAMES_SAMPLE;
    if (sample) sampled++;
    await update(assignment.registerId, { bucket: assignment.bucket, place_id: assignment.placeId, maps_phone: assignment.mapsPhone, verification: scores, ...(sample ? { sample: true } : {}) });
    if (assignment.mapsId) {
      await update(assignment.mapsId, { stage: 'filtered', drop_reason: 'matched_register', bucket: assignment.bucket });
      if (!mapsUnbucketed.has(assignment.mapsId)) progress.bucket4 = Math.max(0, progress.bucket4 - 1); // was bucket 4 in an earlier pass
    }
  }
  // Maps rows nobody matched are bucket 4 once every register row of these cities has been seen.
  const complete = (registerRows.data ?? []).length < BUCKET_REGISTER_LIMIT;
  let newBucket4 = 0;
  if (complete) for (const id of mapsBucket4) if (mapsUnbucketed.has(id)) { await update(id, { bucket: 4 }); newBucket4++; }
  progress.bucket1 += result.counts.bucket1; progress.bucket2 += result.counts.bucket2; progress.bucket3 += result.counts.bucket3; progress.bucket4 += newBucket4; progress.bucketBand += result.counts.band;
  progress.bucketPending = !complete;
  if (complete) progress.phase = 'verify';
  progress.lastMessage = `Buckets: ${progress.bucket1} register only, ${progress.bucket2} direct line candidates, ${progress.bucket3} business lines, ${progress.bucket4} Maps only (${progress.bucketBand} in the 0.80 to 0.87 review band).`;
  await saveProgress(db, operator, job.id, progress);
  return done(`Bucketed ${register.length} register rows against ${maps.length} Maps places${final ? ' (final pass)' : ''}.`);
}

// Dataset rows -> job rows. The published filters (state, operating, phone, toll-free, relevance) come
// from the same parser the list flow uses; the brain adds the allowlist regex and the chain drop.
async function ingestRows(db: SupabaseClient, job: JobRecord, progress: JobProgress, city: string, sample: boolean, rows: unknown[]): Promise<{ kept: number; filtered: number }> {
  const industry = brain().industries.find(item => item.key === job.industry_key);
  const allow = industry?.allow ? new RegExp(industry.allow, 'i') : null;
  const plan = { industry: job.industry, metro: city, target: job.target_cells, hardBudgetCents: job.cap_cents, exclusions: [] as string[] };
  let kept = 0, filtered = 0;
  const inserts: Array<Record<string, unknown>> = [];
  for (const raw of rows) {
    const candidate = parseDiscoveryCandidate(raw, plan);
    const record = raw as Record<string, unknown>;
    const text = `${candidate.name} ${String(record.categoryName ?? '')} ${Array.isArray(record.categories) ? record.categories.join(' ') : ''}`;
    let rejection = candidate.rejection;
    if (!rejection && allow && !allow.test(text)) rejection = 'outside_allowlist';
    // Brain filter "drop chains": the brand list (OSM name-suggestion-index + research franchise lists).
    if (!rejection && isChain(candidate.name, job.industry_key)) rejection = 'chain';
    if (rejection) filtered++; else kept++;
    inserts.push({
      job_id: job.id, operator_id: job.operator_id, phone10: rejection ? null : candidate.phone10, name: candidate.name || 'Incomplete record',
      city: candidate.city || null, state: candidate.state || null, zip: zip5(record.postalCode), place_id: candidate.placeId, source_url: candidate.sourceUrl, website: candidate.website,
      rating: typeof record.totalScore === 'number' ? record.totalScore : null, reviews: typeof record.reviewsCount === 'number' ? Math.trunc(record.reviewsCount) : null,
      stage: rejection ? 'filtered' : 'scraped', drop_reason: rejection, sample, source_register: 'google_maps', source_row_id: candidate.placeId,
      verification: job.recipe === 'D' ? { maps_street: typeof record.street === 'string' ? record.street.slice(0, 200) : null } : {},
    });
  }
  // Duplicates inside the job (same phone in two cities) collapse on the unique index; one insert per row keeps the rest.
  for (const row of inserts) {
    const result = await db.from('lead_engine_job_rows').insert(row);
    if (result.error && result.error.code === '23505') {
      kept--; filtered++;
      // Recipe D: the same ten digits already sit on a register row. That is bucket 3 evidence: keep the Maps facts on it.
      if (job.recipe === 'D' && typeof row.phone10 === 'string') {
        const existing = await db.from('lead_engine_job_rows').select('id,source_register').eq('job_id', job.id).eq('phone10', row.phone10).maybeSingle();
        if (existing.data && (existing.data as { source_register: string | null }).source_register !== 'google_maps') {
          await db.from('lead_engine_job_rows').update({ maps_phone: row.phone10, place_id: row.place_id, source_url: row.source_url, website: row.website, rating: row.rating, reviews: row.reviews, updated_at: new Date().toISOString() }).eq('id', (existing.data as { id: string }).id);
        }
      }
      continue;
    }
    if (result.error) throw storageError(result.error, 'Scraped rows could not be saved.');
    if (row.stage === 'scraped') await graph(db, progress, edgesFromMapsRow({ place_id: (row.place_id as string | null) ?? null, name: String(row.name), state: (row.state as string | null) ?? null, zip: (row.zip as string | null) ?? null,
      phone10: (row.phone10 as string | null) ?? null, website: (row.website as string | null) ?? null, reviews: (row.reviews as number | null) ?? null, rating: (row.rating as number | null) ?? null }));
  }
  return { kept, filtered };
}

const CALLABLE = (v: LeadVerification) => v.lineType === 'Mobile' && v.dnc === false && v.tcpa === false && v.reachable === true;

async function settleVerified(db: SupabaseClient, job: JobRecord, rows: PendingRow[], cache: Map<string, LeadVerification>, progress?: JobProgress): Promise<{ verified: number; dropped: number; held: number; delivered: number; flagged: number }> {
  const counts = { verified: 0, dropped: 0, held: 0, delivered: 0, flagged: 0 };
  for (const row of rows) {
    const v = cache.get(row.phone10);
    // Licence facts written by the names step (license_issue_date, reuse_count, bucket scores) survive the verify result.
    const verification = { ...(row.verification ?? {}), ...(v ? { lineType: v.lineType, dnc: v.dnc, tcpa: v.tcpa, reachable: v.reachable, verifiedAt: v.verifiedAt, vendor: 'batchdata' } : { lineType: null, vendor: 'batchdata' }) };
    const fromRegister = row.source_register !== null && row.source_register !== 'google_maps';
    const licenseIssueDate = typeof row.verification?.license_issue_date === 'string' ? row.verification.license_issue_date : null;
    const update = async (stage: string, extra: Record<string, unknown>) => {
      const result = await db.from('lead_engine_job_rows').update({ stage, verification, updated_at: new Date().toISOString(), ...extra }).eq('id', row.id);
      if (result.error) throw storageError(result.error, 'A verified row could not be saved.');
    };
    counts.verified++;
    if (!v || v.lineType === null) { counts.dropped++; await update('dropped', { drop_reason: 'no_provider_answer' }); continue; }
    if (v.lineType !== 'Mobile') { counts.dropped++; await update('dropped', { drop_reason: 'not_mobile' }); continue; }
    if (v.tcpa !== false) { counts.dropped++; await update('dropped', { drop_reason: 'tcpa_litigator' }); continue; }
    if (v.dnc !== false) {
      if (job.dnc_mode === 'flag' && v.dnc === true) { counts.flagged++; await update('verified', { drop_reason: 'dnc_flagged' }); }
      else { counts.dropped++; await update('dropped', { drop_reason: 'do_not_call' }); }
      continue;
    }
    if (v.reachable !== true) { counts.dropped++; await update('dropped', { drop_reason: 'not_reachable' }); continue; }
    const timeZone = resolveZone({ zip: row.zip, state: row.state, city: row.city, phone10: row.phone10 });
    if (!timeZone) { counts.held++; await update('held', { drop_reason: 'time_zone_unresolved' }); continue; }
    // Global gate: one owner is delivered once across every job and list. A duplicate is a drop, not an error.
    const business = await db.from('lead_engine_businesses').insert({
      phone10: row.phone10, name_city: `${row.name} ${row.city ?? ''} ${row.state ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 300) || row.phone10,
      place_id: row.place_id, source_url: row.source_url ?? `https://www.google.com/maps/search/?api=1&query=${row.phone10}`, batch_id: job.batch_id, disposition: 'claimed',
    });
    if (business.error) { counts.dropped++; await update('dropped', { drop_reason: business.error.code === '23505' ? 'already_delivered' : 'business_record_rejected' }); continue; }
    const verifiedAt = v.verifiedAt ?? new Date().toISOString();
    const traced = row.verification?.trace_status === 'matched';
    const delivery = await db.from('lead_engine_deliveries').insert({
      phone10: row.phone10, batch_id: job.batch_id, plan_id: job.plan_id, operator_id: job.operator_id, line_type: 'Mobile', dnc: false, tcpa: false, reachable: true,
      verified_at: verifiedAt, time_zone: timeZone, evidence_ref: `${traced ? 'batchdata property/skip-trace' : 'batchdata phone/verification'} ${verifiedAt}`.slice(0, 300),
    });
    if (delivery.error) { counts.dropped++; await update('dropped', { drop_reason: /contact_suppressed/.test(delivery.error.message) ? 'suppressed' : 'delivery_gate_rejected' }); continue; }
    // The ledger row: provenance per number. Register rows carry their source and row id, recipe D its
    // bucket and the Maps phone seen at fetch; bucket 3 (register phone equals the Maps phone) is the
    // business-line evidence. legal_gate records the state rule the job ran under (restricted allowed).
    const bucket = job.recipe === 'D' ? row.bucket : null;
    const ledger = await db.from('lead_engine_row_ledger').insert({
      phone10: row.phone10, batch_id: job.batch_id, operator_id: job.operator_id, recipe: job.recipe, bucket,
      source_register: row.source_register ?? 'google_maps', source_row_id: row.source_row_id ?? row.place_id ?? row.phone10, source_fetched_at: new Date().toISOString(),
      maps_place_id: row.place_id, maps_phone_at_fetch: fromRegister ? row.maps_phone : row.phone10, business_line_evidence: bucket === 3 ? 'register_eq_maps' : 'none',
      verify_vendor: 'batchdata', verified_at: verifiedAt, line_type: 'Mobile',
      dnc_file_version: null, dnc_checked_at: verifiedAt, litigator_vendor: 'batchdata', litigator_checked_at: verifiedAt, legal_gate: `${job.state}: ${job.legal_status}`, tz: timeZone,
      features: {
        industry: job.industry_key, state: job.state, recipe: job.recipe, city: row.city, rating: row.rating, reviews: row.reviews, sample: row.sample, dnc_mode: job.dnc_mode,
        source_register: row.source_register ?? 'google_maps', bucket, license_issue_date: licenseIssueDate, phone_reuse_count: typeof row.verification?.reuse_count === 'number' ? row.verification.reuse_count : null,
        title_code: typeof row.verification?.title_code === 'string' ? row.verification.title_code : null, owner_direct_line_candidate: bucket === 2,
        register_eq_maps: bucket === 3, legal_status: job.legal_status, legal_note: job.legal_status === 'restricted' ? job.legal_note : null,
        // Recipe B provenance: how the home street was found, the parcel owner string it matched and the trace score.
        ...(traced ? { home_street_source: row.verification?.home_street_source ?? null, parcel_owner_string: row.verification?.parcel_owner_string ?? null, parcel_source: row.verification?.parcel_source ?? null, trace_score: row.verification?.trace_score ?? null, trace_vendor: 'batchdata', traced_at: row.verification?.traced_at ?? null } : {}),
      },
    }).select('id').single();
    if (ledger.error) throw storageError(ledger.error, 'The ledger row could not be written; delivery stopped to keep every delivered number accounted for.');
    counts.delivered++;
    const ledgerId = (ledger.data as { id: string }).id;
    await update('delivered', { time_zone: timeZone, ledger_id: ledgerId, drop_reason: null });
    const ownerParts = (row.owner_name ?? '').trim().split(/\s+/);
    await graph(db, progress, [
      ...edgesFromVerification({ phone10: row.phone10, vendor: 'batchdata', line_type: 'Mobile', dnc: false, verified_at: verifiedAt }),
      ...edgesFromDelivery({ phone10: row.phone10, ledger_id: ledgerId, batch_id: job.batch_id ?? '', recipe: job.recipe, bucket, source_register: row.source_register ?? 'google_maps', source_row_id: row.source_row_id,
        place_id: row.place_id, owner_first: ownerParts.length > 1 ? ownerParts[0] : null, owner_last: ownerParts.length > 1 ? ownerParts[ownerParts.length - 1] : null, business_name: row.name, state: row.state, zip: row.zip, delivered_at: new Date().toISOString() }),
    ]);
  }
  return counts;
}

// The deliverable as bytes. Held and flagged rows ride along, marked, so the caller sees the whole picture.
export async function jobWorkbook(db: SupabaseClient, operator: string, jobId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const view = await getJob(db, operator, jobId);
  // Phase 5: the Owner Probability Score (rule based v0) orders the sheet; the score rides in Status so
  // the 20 brain columns stay exactly as they are.
  const scored = scoreDialRows(view.rows.filter(row => row.stage === 'delivered' || (row.stage === 'verified' && row.dropReason === 'dnc_flagged')).map(row => ({
    row, features: featuresFromLedger({
      recipe: view.job.recipe, bucket: row.bucket, source_register: row.sourceRegister ?? 'google_maps', title_code: row.verification.title_code ?? null, business_type: row.verification.business_type ?? null,
      phone_reuse_count: row.verification.reuse_count ?? null, register_eq_maps: row.bucket === 3, line_type: 'Mobile', review_bucket: row.verification.review_bucket ?? null,
      license_issue_date: row.licenseIssueDate, reviews: row.reviews, state: view.job.state, industry: view.job.industry_key,
    }),
  })));
  const rows: DialRow[] = scored.map(({ row, score }, index) => ({
    position: index + 1, phone10: row.phone10, company: row.name, mapsUrl: row.sourceUrl, rating: row.rating, reviews: row.reviews, city: row.city, state: row.state, timeZone: row.timeZone,
    ownerName: row.ownerName, email: row.email,
    status: `${contactEvidenceStatus(row.stage, row.bucket, row.verification)} · score ${score}`,
    bucket: view.job.recipe === 'D' ? row.bucket : null, source: row.sourceRegister ?? 'google_maps', sourceRowId: row.sourceRowId, licenseIssueDate: row.licenseIssueDate, ledgerId: row.ledgerId,
  }));
  const spentByVendor = view.spend.reduce<Record<string, number>>((sum, line) => ({ ...sum, [line.vendor]: (sum[line.vendor] ?? 0) + line.cents }), {});
  const summary: Record<string, CellValue> = {
    'Target cells': view.job.target_cells, 'Delivered': view.job.delivered_count, 'Held (no time zone)': view.progress.held, 'DNC flagged': view.progress.flagged,
    'Scraped': view.progress.scraped, 'Filtered before paying': view.progress.filtered, 'Verified': view.progress.verified, 'Dropped in verification': view.progress.dropped,
    'Credits settled': view.job.credits_settled, 'Vendor spend (USD)': view.job.spent_cents / 100, ...Object.fromEntries(Object.entries(spentByVendor).map(([vendor, cents]) => [`Spend ${vendor} (USD)`, cents / 100])),
    ...(view.job.recipe === 'B' || view.job.recipe === 'C' || view.job.recipe === 'D' ? {
      'Register source': view.progress.registerSource, 'Register names read': view.progress.names, 'Dropped: phone on more than 3 licences': view.progress.namesDroppedReuse,
      'Dropped: already delivered or suppressed': view.progress.namesDroppedDelivered, 'Legal gate': `${view.job.state}: ${view.job.legal_status}${view.job.legal_note ? ` (${view.job.legal_note})` : ''}`,
    } : {}),
    ...(view.job.recipe === 'B' ? {
      'Parcel lookups (names checked)': view.progress.parcelChecked, 'Homes found (exactly one owner)': view.progress.parcelResolved, 'Home street from the licence file': view.progress.parcelSkipped,
      'Names without a single home': view.progress.parcelDropped, 'Persons skip traced': view.progress.traced, 'Trace answers matched by identity': view.progress.traceMatched, 'Trace unanswered': view.progress.traceUnmatched,
      'Cost per callable cell (USD)': view.job.delivered_count > 0 ? Math.round(view.job.spent_cents / view.job.delivered_count) / 100 : null,
    } : {}),
    ...(view.job.recipe === 'D' ? {
      [`Bucket 1: ${bucketLabel(1)}`]: view.progress.bucket1, [`Bucket 2: ${bucketLabel(2)}`]: view.progress.bucket2, [`Bucket 3: ${bucketLabel(3)}`]: view.progress.bucket3, [`Bucket 4: ${bucketLabel(4)}`]: view.progress.bucket4,
      'Name match review band (0.80 to 0.87, not delivered)': view.progress.bucketBand,
    } : {}),
    ...(view.progress.gateNote ? { 'Quality gate override': view.progress.gateNote } : {}),
    'Status': view.job.status, 'Dial window': '08:00 to 20:00 recipient local',
  };
  const safe = `${view.job.industry} ${view.job.state} owner cells ${view.job.id.slice(0, 8)}`.replace(/[^a-zA-Z0-9 ._-]/g, '');
  return { bytes: writeWorkbook(dialSheet(view.job, rows, summary)), filename: `${safe}.xlsx` };
}
