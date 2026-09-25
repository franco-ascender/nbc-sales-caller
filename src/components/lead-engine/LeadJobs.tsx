'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Play, RefreshCw, Upload, Wallet } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import type { JobRecord, JobQuote, JobProgress, Outcome } from '@/lib/lead-engine-jobs';
import { scoreOwnerProbability, featuresFromLedger } from '@/lib/lead-engine-score';
import type { OwnerScore } from '@/lib/lead-engine-score';
import { OUTCOMES } from '@/lib/lead-engine-jobs';
import { dialStatus } from '@/lib/lead-engine-dial-window';
import type { CoverageCell, LegalStatus } from '@/lib/lead-engine-brain';
import styles from './LeadJobs.module.css';

// Owner cells as a job: industry + state + how many cells -> quote in credits -> hold -> the engine
// scrapes city by city and verifies behind the meter -> download the dial sheet -> record outcomes.
// The browser drives the loop by calling advance until the job is delivered or parked.

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const phone = (value: string) => `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', sample_running: 'Sampling', sample_done: 'Sample passed', running: 'Running', delivered: 'Delivered', needs_attention: 'Needs attention' };
const OUTCOME_LABEL: Record<Outcome, string> = { reached_owner: 'Reached owner', gatekeeper: 'Gatekeeper', wrong_number: 'Wrong number', voicemail: 'Voicemail', disconnected: 'Disconnected', opt_out: 'Opt out (suppress)', no_answer: 'No answer' };
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

// Owner Probability Score v0 shown per delivered row (rule formula, src/lib/lead-engine-score.ts); the
// factors ride on the cell's title. Delivered rows are verified mobiles, so line_type is Mobile here.
function ownerScore(recipe: string, row: { bucket: number | null; sourceRegister: string | null; licenseIssueDate: string | null }, owner: string | null): OwnerScore {
  return scoreOwnerProbability(featuresFromLedger({ recipe, bucket: row.bucket, source_register: row.sourceRegister ?? 'google_maps', register_eq_maps: row.bucket === 3, license_issue_date: row.licenseIssueDate, title_code: owner ? 'owner' : null }, 'Mobile'));
}

interface Balance { available: number; held: number }
interface Coverage { version: string; industries: Array<{ key: string; recipe: string; aliases: string[]; expectedClean: number; measuredBy: string; n: number }>; states: Array<{ code: string; legalStatus: LegalStatus; legalNote: string | null }>; cells: CoverageCell[] }
interface JobView { job: JobRecord; progress: JobProgress; spend: Array<{ vendor: string; step: string; units: number; cents: number }>; rows: Array<{ id: string; phone10: string; name: string; city: string | null; state: string | null; timeZone: string | null; stage: string; dropReason: string | null; ledgerId: string | null; ownerName: string | null; sourceRegister: string | null; bucket: number | null; licenseIssueDate: string | null }> }
const BUCKET_SHORT: Record<number, string> = { 1: 'Register only', 2: 'Direct line candidate', 3: 'Business line', 4: 'Maps only' };

async function call<T>(token: string, path: string, body?: object | Uint8Array, method?: string): Promise<T> {
  const isBytes = body instanceof Uint8Array;
  const response = await fetch(`/api/lead-engine${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${token}`, ...(body && !isBytes ? { 'Content-Type': 'application/json' } : {}), ...(isBytes ? { 'Content-Type': 'application/octet-stream' } : {}) },
    ...(body ? { body: isBytes ? new Blob([body as BlobPart]) : JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(65000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'That step could not be completed.');
  return data;
}

export function LeadJobs() {
  const { token, user } = useWorkspaceAccess();
  if (!token || !user) return null;
  return <Jobs key={user.id} token={token} />;
}

function Jobs({ token }: { token: string }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [industry, setIndustry] = useState('hvac');
  const [state, setState] = useState('FL');
  const [target, setTarget] = useState('20');
  const [dncMode, setDncMode] = useState<'strict' | 'flag'>('strict');
  const [useFallback, setUseFallback] = useState(false);
  const [quote, setQuote] = useState<JobQuote | null>(null);
  const [grant, setGrant] = useState('100');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showCoverage, setShowCoverage] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [credits, list, grid] = await Promise.all([call<Balance>(token, '/credits'), call<{ jobs: JobRecord[] }>(token, '/jobs'), coverage ? Promise.resolve(coverage) : call<Coverage>(token, '/coverage')]);
      setBalance(credits); setJobs(list.jobs); setCoverage(grid);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The jobs could not be loaded.'); }
  }, [token, coverage]);
  useEffect(() => { void load(); }, [load]);

  async function step<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(label); setError('');
    try { return await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Something failed. Nothing was charged.'); return null; }
    finally { setBusy(''); }
  }
  const targetNumber = /^\d+$/.test(target) ? Number(target) : 0;

  async function getQuote(): Promise<void> {
    const result = await step('Quoting…', () => call<{ quote: JobQuote; balance: Balance }>(token, '/jobs/quote', { industry, state, targetCells: targetNumber, dncMode, useFallback }));
    if (result) { setQuote(result.quote); setBalance(result.balance); }
  }
  async function createAndStart(): Promise<void> {
    const id = crypto.randomUUID();
    const created = await step('Creating the job…', () => call<{ job: JobRecord }>(token, '/jobs', { id, industry, state, targetCells: targetNumber, dncMode, useFallback }));
    if (!created) return;
    const started = await step('Holding credits…', () => call<{ job: JobRecord }>(token, `/jobs/${id}/start`, {}));
    if (!started) { await load(); return; }
    setQuote(null); await load(); setOpen(id);
  }
  async function addCredits(): Promise<void> {
    const credits = Number(grant);
    if (!Number.isSafeInteger(credits) || credits < 1) return;
    const result = await step('Adding credits…', () => call<Balance>(token, '/credits', { credits, note: 'internal top up from the Lead Engine UI' }));
    if (result) setBalance(result);
  }

  if (open) return <div>
    <button type="button" className={styles.panel + ' ' + styles.backLink} style={{ padding: '10px 16px', marginBottom: 12 }} onClick={() => { setOpen(null); void load(); }}><ArrowLeft size={15} /> All jobs</button>
    <JobDetail key={open} token={token} jobId={open} onChange={load} />
  </div>;

  return <div>
    <section className={styles.panel}>
      <div className={styles.topline}>
        <div><h3>Owner cells by the job</h3><p>Industry, state and how many verified owner cells you want. The engine quotes in credits, holds them, samples one city, then widens until the target is met or the spend cap stops it.</p></div>
        <div className={styles.balance}><Wallet size={18} /><span>Credits</span><strong>{balance ? balance.available : '…'}</strong><span>available</span><span>{balance ? `${balance.held} held` : ''}</span>
          <span className={styles.grant}><input aria-label="Credits to add" value={grant} inputMode="numeric" onChange={event => setGrant(event.target.value.replace(/\D/g, ''))} /><button type="button" disabled={Boolean(busy)} onClick={() => void addCredits()}>Add credits</button></span>
        </div>
      </div>
      <div className={styles.form}>
        <label className={styles.field}>Industry
          <input list="lead-jobs-industries" value={industry} onChange={event => { setIndustry(event.target.value); setQuote(null); }} placeholder="hvac, roofing, plumbing…" />
          <datalist id="lead-jobs-industries">{coverage?.industries.map(item => <option key={item.key} value={item.key}>{`${item.key} · recipe ${item.recipe} · ${Math.round(item.expectedClean * 100)}% clean (${item.measuredBy}, n=${item.n})`}</option>)}</datalist>
        </label>
        <label className={styles.field}>State
          <select value={state} onChange={event => { setState(event.target.value); setQuote(null); }}>{STATES.map(code => <option key={code} value={code}>{code}</option>)}</select>
        </label>
        <label className={styles.field}>Owner cells wanted
          <input value={target} inputMode="numeric" onChange={event => { setTarget(event.target.value.replace(/\D/g, '')); setQuote(null); }} />
        </label>
        <label className={styles.field}>Do Not Call rows
          <select value={dncMode} onChange={event => setDncMode(event.target.value as 'strict' | 'flag')}><option value="strict">Drop them (strict)</option><option value="flag">Keep flagged, half rate</option></select>
        </label>
        <button type="button" className={styles.primary} disabled={Boolean(busy) || !industry.trim() || targetNumber < 1} onClick={() => void getQuote()}>
          {busy === 'Quoting…' ? <Loader2 size={15} className={styles.spin} /> : null}Get quote
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {quote && <div className={styles.quote}>
        <div><span>Route</span><strong>{quote.route.industry} · recipe {quote.recipe}</strong><small>{quote.route.reason}</small></div>
        <div><span>Expected clean rate</span><strong>{Math.round(quote.expectedClean * 100)}%</strong><small>{quote.route.measuredBy}, n = {quote.route.n}</small></div>
        <div><span>Credits to hold</span><strong>{quote.credits}</strong><small>{quote.route.creditsPerCleanCell} per cell · {money(quote.credits * quote.creditCents)} billed</small></div>
        <div><span>Engine spend cap</span><strong>{money(quote.capCents)}</strong><small>60% of billing, hard stop</small></div>
        <div><span>Vendor estimate</span><strong>{money(quote.estimatedVendorCents)}</strong><small>{quote.recipe === 'B' ? `~${quote.expectedBusinesses} names read, ~${quote.traces} skip traces` : `~${quote.expectedBusinesses} businesses scraped`}</small></div>
        <div><span>Cities</span><strong>{quote.cities.length}</strong><small>{quote.cities.slice(0, 4).join(', ')}…</small></div>
        <div><span>Legal</span><strong>{quote.legalStatus}</strong><small>{quote.legalNote ?? 'No restriction recorded'}</small></div>
        {quote.pathNote && <p className={styles.blocker} style={{ borderLeftColor: '#1d4ed8', background: '#eef2ff' }}><strong>Path for {state}:</strong> {quote.pathNote}{quote.route.recipe !== 'A' && !useFallback ? ` The register path (recipe ${quote.route.recipe}) is used automatically in the states that have one.` : ''}</p>}
        {quote.registerSource && <div><span>Register</span><strong>{quote.registerSource}</strong><small>names step reads lead_engine_names; {quote.recipe === 'B' ? 'the skip trace is the only paid step ($0.07 a person)' : `verify is the only paid step${quote.recipe === 'D' ? ' plus one Maps scrape over the register cities' : ''}`}</small></div>}
        {quote.recipe === 'B' && <div><span>Home address</span><strong>{quote.skipParcel ? 'in the licence file' : quote.parcelSource ?? 'parcel layer'}</strong><small>{quote.skipParcel ? 'parcel step skipped: the register prints the licensee\'s own street' : `free parcel lookup, about 25% of names resolve to one home · ~${quote.traces} traces`}</small></div>}
        {quote.recipe === 'B' && quote.costPerCleanCellCents !== null && <div><span>Cost per clean cell</span><strong>{money(quote.costPerCleanCellCents)}</strong><small>our vendor cost; Anas measured $0.15 to $0.27 for recipe B</small></div>}
        {quote.blockers.map(item => <p key={item} className={styles.blocker}>{item}{quote.fallbackAvailable && !useFallback ? <> <button type="button" onClick={() => { setUseFallback(true); setQuote(null); }}>Use the Google Maps scrape instead</button></> : null}</p>)}
        <div className={styles.quoteActions}>
          <button type="button" className={styles.primary} disabled={Boolean(busy) || quote.blockers.length > 0 || (balance !== null && balance.available < quote.credits)} onClick={() => void createAndStart()}>
            {busy && busy !== 'Quoting…' ? <Loader2 size={15} className={styles.spin} /> : <Play size={15} />}Hold {quote.credits} credits and start
          </button>
          {balance !== null && balance.available < quote.credits && <small>Not enough credits: {balance.available} available, {quote.credits} needed.</small>}
          <small>Nothing is spent until you click. The sample costs about $0.50 to $1.20 and stops the job if the clean rate is under half the expected.</small>
        </div>
      </div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.topline}><div><h3>Your jobs</h3><p>Open a job to watch it run, download the dial sheet and record call outcomes.</p></div><button type="button" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button></div>
      {!jobs ? <p>Loading…</p> : jobs.length === 0 ? <p>No jobs yet. Quote one above.</p> : <table className={styles.jobs}>
        <thead><tr><th>Job</th><th>Target</th><th>Delivered</th><th>Spent</th><th>Credits</th><th>Status</th><th /></tr></thead>
        <tbody>{jobs.map(job => <tr key={job.id}>
          <td>{job.industry} · {job.state} <small style={{ color: 'var(--muted)' }}>recipe {job.recipe} · {new Date(job.created_at).toLocaleDateString('en-US')}</small></td>
          <td>{job.target_cells}</td><td>{job.delivered_count || (job.progress?.delivered ?? 0)}</td><td>{money(job.spent_cents)} / {money(job.cap_cents)}</td>
          <td>{job.credits_settled || job.credits_held} {job.status === 'delivered' ? 'settled' : 'held'}</td>
          <td><span className={styles.status} data-status={job.status}>{STATUS_LABEL[job.status] ?? job.status}</span></td>
          <td><button type="button" className={styles.primary} onClick={() => setOpen(job.id)}>Open</button></td>
        </tr>)}</tbody>
      </table>}
    </section>

    <section className={styles.panel}>
      <div className={styles.topline}><div><h3>Coverage</h3><p>Every industry the brain knows against every state it has measured. Green is live today (recipe A). Blue is a register recipe (C or D): it runs once that state&apos;s register is ingested and mapped. Struck through is legally closed for licensee lists.</p></div><button type="button" onClick={() => setShowCoverage(!showCoverage)}>{showCoverage ? 'Hide grid' : 'Show grid'}</button></div>
      {showCoverage && coverage && <CoverageGrid coverage={coverage} />}
    </section>
  </div>;
}

function CoverageGrid({ coverage }: { coverage: Coverage }) {
  const states = coverage.states.map(item => item.code).sort();
  const byKey = new Map(coverage.cells.map(cell => [`${cell.industry}|${cell.state}`, cell]));
  return <div>
    <div className={styles.coverage}><table className={styles.grid}>
      <thead><tr><th>Industry (brain {coverage.version})</th>{states.map(code => <th key={code}>{code}</th>)}</tr></thead>
      <tbody>{coverage.industries.map(item => <tr key={item.key}>
        <td>{item.key} <small>({item.recipe})</small></td>
        {states.map(code => { const cell = byKey.get(`${item.key}|${code}`); return <td key={code}>{cell ? <span className={styles.cell} data-legal={cell.legalStatus} data-live={String(cell.available && cell.recipe === 'A')} title={`${cell.recipe} · ${cell.legalStatus} · ${Math.round(cell.expectedClean * 100)}% ${cell.measuredBy}`}>{cell.recipe}</span> : ''}</td>; })}
      </tr>)}</tbody>
    </table></div>
    <div className={styles.legend}><span><span className={styles.cell} data-live="true">A</span> live now</span><span><span className={styles.cell} data-live="false" data-legal="ok">C</span> register path, Phase 2</span><span><span className={styles.cell} data-legal="restricted">C</span> legal read pending</span><span><span className={styles.cell} data-legal="prohibited">C</span> prohibited</span></div>
  </div>;
}

function JobDetail({ token, jobId, onChange }: { token: string; jobId: string; onChange: () => Promise<void> }) {
  const [view, setView] = useState<JobView | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [extra, setExtra] = useState('20');
  const [outcomeBusy, setOutcomeBusy] = useState('');
  const [importSummary, setImportSummary] = useState('');
  const stop = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try { setView(await call<JobView>(token, `/jobs/${jobId}`)); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The job could not be loaded.'); }
  }, [token, jobId]);
  useEffect(() => { void refresh(); }, [refresh]);

  // The loop: one advance per call, a pause while the scraper works, until the job leaves running.
  const run = useCallback(async () => {
    if (running) return;
    setRunning(true); stop.current = false; setError('');
    try {
      for (let guard = 0; guard < 400 && !stop.current; guard++) {
        const result = await call<{ job: JobRecord; progress: JobProgress; did: string; waiting: boolean }>(token, `/jobs/${jobId}/advance`, {});
        setLog(previous => [result.did, ...previous].slice(0, 12));
        setView(previous => previous ? { ...previous, job: result.job, progress: result.progress } : previous);
        if (result.job.status !== 'sample_running' && result.job.status !== 'running') break;
        await new Promise(resolve => setTimeout(resolve, result.waiting ? 6000 : 400));
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The run stopped. Everything already paid for is saved; press Continue to pick it up.'); }
    finally { setRunning(false); await refresh(); await onChange(); }
  }, [running, token, jobId, refresh, onChange]);

  // Auto-continue a job that is mid-flight when the page opens.
  useEffect(() => { if (view && (view.job.status === 'sample_running' || view.job.status === 'running') && !running && log.length === 0) void run(); }, [view, running, log.length, run]);

  async function resume(): Promise<void> {
    setError('');
    try { await call(token, `/jobs/${jobId}/resume`, { extraCredits: Number(extra) || 0 }); await refresh(); void run(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The job could not be resumed.'); }
  }
  async function download(): Promise<void> {
    setError('');
    try {
      const response = await fetch(`/api/lead-engine/jobs/${jobId}/download`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('The dial sheet could not be generated.');
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'owner-cells.xlsx'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Download failed.'); }
  }
  async function recordOutcome(ledgerId: string, outcome: Outcome): Promise<void> {
    setOutcomeBusy(ledgerId); setError('');
    try { const saved = await call<{ suppressed: boolean; withinDialWindow: boolean }>(token, '/outcomes', { ledgerId, outcome }); setImportSummary(`Saved ${OUTCOME_LABEL[outcome]}${saved.suppressed ? ' and suppressed the number globally' : ''}${saved.withinDialWindow ? '' : ' (outside the 8am to 8pm window, recorded anyway)'}.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The outcome could not be saved.'); }
    finally { setOutcomeBusy(''); }
  }
  async function importSheet(file: File): Promise<void> {
    setError(''); setImportSummary('Uploading…');
    try {
      const summary = await call<{ recorded: number; skipped: number; suppressed: number; errors: string[] }>(token, '/outcomes/import', new Uint8Array(await file.arrayBuffer()));
      setImportSummary(`Recorded ${summary.recorded} outcomes, ${summary.suppressed} suppressed, ${summary.skipped} rows not called yet.${summary.errors.length ? ` ${summary.errors.length} rows need a fix: ${summary.errors.slice(0, 3).join(' ')}` : ''}`);
    } catch (failure) { setImportSummary(''); setError(failure instanceof Error ? failure.message : 'The sheet could not be imported.'); }
  }

  if (!view) return <p className={styles.panel}>{error || 'Loading the job…'}</p>;
  const { job, progress } = view;
  const active = job.status === 'sample_running' || job.status === 'running';
  const delivered = view.rows.filter(row => row.stage === 'delivered');
  const bar = (label: string, value: number, of: number | null, hint?: string) => <div className={styles.bar}><span>{label}</span><strong>{value}{of ? ` / ${of}` : ''}</strong>{hint && <small style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{hint}</small>}{of ? <i><b style={{ width: `${Math.min(100, value / of * 100)}%` }} /></i> : null}</div>;

  return <section className={styles.panel + ' ' + styles.detail}>
    <div className={styles.topline}>
      <div><h3>{job.industry} · {job.state} · {job.target_cells} owner cells</h3><p>Recipe {job.recipe} · brain {job.brain_version} · {job.credits_held || job.credits_settled} credits {job.status === 'delivered' ? 'settled' : 'held'} · cap {money(job.cap_cents)} · DNC {job.dnc_mode}</p></div>
      <span className={styles.status} data-status={job.status}>{STATUS_LABEL[job.status] ?? job.status}</span>
    </div>
    <div className={styles.bars}>
      {(job.recipe === 'B' || job.recipe === 'C' || job.recipe === 'D') && bar('Register names', progress.names, null, `${progress.registerSource ?? 'no source'} · ${progress.namesDroppedReuse} shared phones dropped · ${progress.namesDroppedDelivered} already delivered${progress.namesExhausted ? ' · exhausted' : ''}`)}
      {job.recipe === 'B' && bar('Homes found', progress.parcelResolved + progress.parcelSkipped, null, `${progress.parcelChecked} parcel lookups · ${progress.parcelSkipped} streets from the licence file · ${progress.parcelDropped} names without a single home${progress.parcelFailures ? ` · ${progress.parcelFailures} lookups failed` : ''}`)}
      {job.recipe === 'B' && bar('Skip traced', progress.traced, null, `${progress.traceMatched} answered · ${progress.traceUnmatched} unanswered · $0.07 a person`)}
      {job.recipe !== 'C' && job.recipe !== 'B' && bar('Cities', progress.cityIndex, progress.cities.length, progress.run ? `Scraping ${progress.run.city}` : job.recipe === 'D' ? 'from the register' : undefined)}
      {job.recipe !== 'C' && job.recipe !== 'B' && bar('Scraped', progress.scraped, null, `${progress.filtered} filtered free`)}
      {job.recipe === 'D' && bar('Buckets', progress.bucket1 + progress.bucket2 + progress.bucket3 + progress.bucket4, null, `${progress.bucket1} register only · ${progress.bucket2} direct line · ${progress.bucket3} business line · ${progress.bucket4} Maps only · ${progress.bucketBand} review band`)}
      {bar('Verified', progress.verified, null, `${progress.dropped} dropped · ${progress.cached} from cache`)}
      {bar('Delivered', progress.delivered, job.target_cells, `${progress.held} held (no time zone)${progress.flagged ? ` · ${progress.flagged} DNC flagged` : ''}`)}
      {bar('Spent', Math.round(job.spent_cents), job.cap_cents, `${money(job.spent_cents)} of ${money(job.cap_cents)}`)}
    </div>
    {job.recipe === 'B' && progress.addressCheck.length > 0 && <div className={styles.attention} style={{ borderLeftColor: '#1d4ed8', background: '#eef2ff' }}>
      <strong>Address check</strong> <small>(the first homes the parcel layer returned, logged before any trace fires)</small>
      {progress.addressCheck.map(line => <small key={line} style={{ display: 'block', fontFamily: 'monospace' }}>{line}</small>)}
    </div>}
    {job.status === 'needs_attention' && <div className={styles.attention}>
      <strong>Parked:</strong> {job.attention_reason}
      {progress.gateFailures.length > 0 && <small style={{ display: 'block' }}>Quality gates: {progress.gateFailures.join(' · ')}</small>}
      {job.resume_from && job.credits_held > 0 && <>
        <label>Add credits <input value={extra} inputMode="numeric" onChange={event => setExtra(event.target.value.replace(/\D/g, ''))} /></label>
        <button type="button" className={styles.primary} onClick={() => void resume()}><Play size={14} /> Resume{Number(extra) > 0 ? ` with ${extra} more credits` : ''}</button>
      </>}
    </div>}
    <div className={styles.actions}>
      {active && !running && <button type="button" className={styles.primary} onClick={() => void run()}><Play size={14} /> Continue</button>}
      {running && <button type="button" onClick={() => { stop.current = true; }}><Loader2 size={14} className={styles.spin} /> Running… click to pause</button>}
      {(delivered.length > 0 || job.status === 'delivered') && <button type="button" className={styles.primary} onClick={() => void download()}><Download size={14} /> Download dial sheet (.xlsx)</button>}
      {delivered.length > 0 && <>
        <input ref={fileInput} type="file" accept=".xlsx" className={styles.hiddenInput} aria-label="Dial sheet with outcomes" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importSheet(file); }} />
        <button type="button" onClick={() => fileInput.current?.click()}><Upload size={14} /> Upload sheet with outcomes</button>
      </>}
      <button type="button" onClick={() => void refresh()}><RefreshCw size={14} /></button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {importSummary && <p className={styles.log}>{importSummary}</p>}
    {log.length > 0 && <p className={styles.log}>{log[0]}</p>}
    {progress.lastMessage && log.length === 0 && <p className={styles.log}>{progress.lastMessage}</p>}

    {delivered.length > 0 && <table className={styles.rows}>
      <thead><tr><th>Cell</th><th>Business</th><th>Owner</th><th>Score</th><th>City</th>{job.recipe !== 'A' && <th>Source</th>}{job.recipe === 'D' && <th>Bucket</th>}<th>Local time</th><th>Outcome</th></tr></thead>
      <tbody>{delivered.map(row => {
        const local = row.timeZone ? dialStatus(row.timeZone) : null;
        const owner = row.ownerName && row.ownerName !== row.name ? row.ownerName : null;
        const score = ownerScore(job.recipe, row, owner);
        return <tr key={row.id}>
          <td className={styles.phone}>{phone(row.phone10)}</td><td>{row.name}</td>
          <td>{owner ?? <small style={{ color: 'var(--muted)' }}>no name</small>}</td>
          <td title={score.factors.map(factor => `${factor.label}: ${factor.points}`).join(' · ')}>{score.score}</td><td>{row.city}</td>
          {job.recipe !== 'A' && <td><small>{row.sourceRegister ?? 'google_maps'}{row.licenseIssueDate ? ` · lic. ${row.licenseIssueDate}` : ''}</small></td>}
          {job.recipe === 'D' && <td>{row.bucket ? `${row.bucket} · ${BUCKET_SHORT[row.bucket] ?? ''}` : ''}</td>}
          <td>{local ? <span className={local.open ? styles.open : styles.closed}>{local.localTime} {local.open ? 'open' : `opens in ${Math.floor(local.opensInMinutes / 60)}h ${local.opensInMinutes % 60}m`}</span> : 'no zone'}</td>
          <td>{row.ledgerId ? <select aria-label={`Outcome for ${row.name}`} defaultValue="" disabled={outcomeBusy === row.ledgerId} onChange={event => { const value = event.target.value as Outcome | ''; if (value && row.ledgerId) void recordOutcome(row.ledgerId, value); }}>
            <option value="">Record a call…</option>{OUTCOMES.map(item => <option key={item} value={item}>{OUTCOME_LABEL[item]}</option>)}
          </select> : 'no ledger'}</td>
        </tr>;
      })}</tbody>
    </table>}
    <p className={styles.log} style={{ marginTop: 14 }}>Manual dialing only, 8:00am to 8:00pm in the lead&apos;s own time zone. An opt out suppresses the number globally the moment it is saved. Every outcome is stored with the row&apos;s features frozen at delivery: that is the training set for the owner score.</p>
  </section>;
}
