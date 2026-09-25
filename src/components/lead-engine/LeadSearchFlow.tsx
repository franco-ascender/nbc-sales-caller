'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { buildLeadPlan, dollarsToCents, isUsState, LEAD_LIMITS } from '@/lib/lead-engine-plan';
import { estimateScrapeCost, belowProviderMinimum, PROVIDER_MIN_CHARGE_CENTS } from '@/lib/lead-engine-cost';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import type { SavedLeadPlan } from '@/lib/lead-engine-storage';
import type { LeadListPage, ScrapeQuote } from '@/lib/lead-engine-scrape';
import { LeadTable } from './LeadTable';
import styles from './LeadSearchFlow.module.css';

// One screen: say what you want → see the price → approve → watch it run. The plan, quote and batch
// records the budget guards depend on are still created, but the operator never walks through them.
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const MEASURED_CELLS_PER_THOUSAND = 187;
// Below this the provider refuses the run, so the derived batch never lands in a dead end.
const MIN_BUSINESSES = 125;
const DISCOVERY_TOOL = 'Apify';

async function call<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/lead-engine${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'That step could not be completed. Nothing was charged.');
  return data;
}

export function LeadSearchFlow() {
  const { token, user } = useWorkspaceAccess();
  if (!token || !user) return null;
  return <SearchFlow key={user.id} token={token} />;
}

function SearchFlow({ token }: { token: string }) {
  const [industry, setIndustry] = useState('Roofing');
  const [metro, setMetro] = useState('');
  const [target, setTarget] = useState('50');
  const [quote, setQuote] = useState<ScrapeQuote | null>(null);
  const [results, setResults] = useState<LeadListPage | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const planRef = useRef<SavedLeadPlan | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (polling.current) clearInterval(polling.current); }, []);

  const targetNumber = /^\d+$/.test(target) ? Number(target) : 0;
  const metroEntry = metro.trim(), metroParts = /^(.{2,}),\s*([A-Za-z]{2})$/.exec(metroEntry);
  const metroInvalid = metroEntry.length > 0 && (!metroParts || !isUsState(metroParts[2].toUpperCase()));
  const businesses = Math.min(LEAD_LIMITS.pilotBusinesses, Math.max(MIN_BUSINESSES, Math.ceil(targetNumber * 1000 / MEASURED_CELLS_PER_THOUSAND)));
  const ready = industry.trim().length >= 2 && !metroInvalid && metroEntry.length > 0 && targetNumber > 0;

  async function step<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(label); setError('');
    try { return await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Something failed. Nothing was charged.'); return null; }
    finally { setBusy(''); }
  }

  async function reviewCost(): Promise<void> {
    if (!ready) return;
    const input = { industry: industry.trim(), metro: metroEntry, target: targetNumber, hardBudgetCents: LEAD_LIMITS.pilotCents, exclusions: [] };
    const plan = buildLeadPlan(input);
    if (plan.errors.length > 0) { setError(plan.errors[0]); return; }
    await step('Pricing your search…', async () => {
      const saved = await call<{ plan: SavedLeadPlan }>(token, '/plans', { version: 1, planId: crypto.randomUUID(), input });
      planRef.current = saved.plan;
      const priced = await call<{ quote: ScrapeQuote }>(token, '/quotes', {
        version: 1, quoteId: crypto.randomUUID(), planId: saved.plan.id, folderId: null,
        name: `${input.industry} · ${input.metro}`.slice(0, 80), count: businesses,
      });
      setQuote(priced.quote);
    });
  }

  function watch(listId: string): void {
    if (polling.current) clearInterval(polling.current);
    polling.current = setInterval(() => {
      void (async () => {
        try {
          const page = await call<LeadListPage>(token, `/lists/${listId}/sync`, {});
          setResults(page);
          if (page.list.importStatus === 'complete' || ['failed', 'uncertain'].includes(page.list.status)) {
            if (polling.current) clearInterval(polling.current);
            polling.current = null; setBusy('');
          }
        } catch { /* keep polling; a transient sync failure must not stop an approved run */ }
      })();
    }, 5000);
  }

  async function approveAndRun(): Promise<void> {
    if (!quote) return;
    const id = quote.id;
    await step('Starting your search…', async () => {
      const page = await call<LeadListPage>(token, `/quotes/${id}/approve`, {});
      setQuote(null); setResults(page);
    });
    setBusy('Searching… results appear below as they arrive.');
    watch(id);
  }

  const cost = quote ? estimateScrapeCost({ businesses: quote.maxResults, discoveryTool: DISCOVERY_TOOL, discoveryMinCents: quote.minCostCents, discoveryMaxCents: quote.maxCostCents }) : null;
  const tooSmall = quote ? belowProviderMinimum(quote.maxCostCents) : false;
  const kept = results?.records.filter(row => row.reviewStatus === 'verification_pending') ?? [];

  return <section className={styles.flow} aria-labelledby="search-flow-title">
    <div className={styles.card}>
      <h2 id="search-flow-title">Find businesses to call</h2>
      <p className={styles.lead}>Tell us the market. You will see the exact price before anything runs.</p>
      <div className={styles.fields}>
        <label>What kind of business?<div className={styles.withIcon}><Search size={17} /><input value={industry} maxLength={150} onChange={event => setIndustry(event.target.value)} placeholder="Roofing, garage doors, med spas…" /></div></label>
        <label>Which city?<div className={styles.withIcon}><MapPin size={17} /><input value={metro} maxLength={150} onChange={event => setMetro(event.target.value)} placeholder="Charlotte, NC" aria-invalid={metroInvalid} /></div>
          {metroInvalid && <small className={styles.fieldError}>Add the two-letter state: {metroEntry.split(',')[0].trim() || 'Charlotte'}, NC</small>}</label>
        <label>How many contacts do you want?<input type="number" min="1" max="100000" value={target} onChange={event => setTarget(event.target.value)} /></label>
      </div>
      {ready && <p className={styles.derived}>We will scan <strong>{businesses}</strong> businesses in {metroEntry} to find roughly {Math.floor(businesses * MEASURED_CELLS_PER_THOUSAND / 1000)} callable contacts. One batch is capped at {LEAD_LIMITS.pilotBusinesses} businesses and {money(LEAD_LIMITS.pilotCents)}.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <span><ShieldCheck size={14} />Nothing runs and nothing is charged until you approve the price.</span>
        <button type="button" className={styles.primary} disabled={!ready || Boolean(busy)} onClick={() => void reviewCost()}>
          {busy === 'Pricing your search…' ? <><Loader2 size={16} className={styles.spin} />Pricing…</> : <>See the price<ArrowRight size={16} /></>}
        </button>
      </div>
    </div>

    {quote && cost && <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="price-title">
      <div className={styles.dialog}>
        <div className={styles.dialogTop}><span>NOTHING HAS STARTED</span><button type="button" aria-label="Close" onClick={() => setQuote(null)}><X size={18} /></button></div>
        <h3 id="price-title">{money(cost.approvedMaxCents)}</h3>
        <p className={styles.dialogLead}>To scan up to {quote.maxResults} businesses. This is the most you can be charged.</p>
        <table className={styles.breakdown}><tbody>
          {cost.lines.map(line => <tr key={line.stage} className={line.includedInApproval ? undefined : styles.later}>
            <td>{line.tool}<small>{line.stage}</small></td>
            <td>{line.units.toLocaleString('en-US')} {line.unitLabel}</td>
            <td>{line.minCents === line.maxCents ? money(line.maxCents) : `${money(line.minCents)}–${money(line.maxCents)}`}{line.includedInApproval ? '' : ' later'}</td>
          </tr>)}
        </tbody></table>
        <p className={styles.note}>You are approving business discovery only. Phone verification is a separate step you approve later; the figure above does not include it.</p>
        {tooSmall && <p className={styles.error}>Too small for the provider, which will not accept a cap under {money(PROVIDER_MIN_CHARGE_CENTS)}. Ask for more contacts.</p>}
        {quote.blockers.length > 0 && <p className={styles.error}>{quote.blockers.join(', ')}</p>}
        <div className={styles.dialogActions}>
          <button type="button" onClick={() => setQuote(null)}>Cancel</button>
          <button type="button" className={styles.primary} disabled={tooSmall || quote.blockers.length > 0 || Boolean(busy)} onClick={() => void approveAndRun()}>Approve {money(cost.approvedMaxCents)} and run</button>
        </div>
      </div>
    </div>}

    {results && <div className={styles.card}>
      <div className={styles.resultsHead}>
        <h3>{results.list.name}</h3>
        <span>{busy ? <><Loader2 size={14} className={styles.spin} />{busy}</> : `${results.list.processed} of up to ${results.list.maxResults} businesses processed`}</span>
      </div>
      {results.records.length === 0
        ? <p className={styles.empty}>{busy ? 'Waiting for the first results…' : 'No businesses came back for this search.'}</p>
        : <table className={styles.results}><thead><tr><th>Business</th><th>Where</th><th>Listing</th><th>Status</th></tr></thead><tbody>
          {results.records.map(row => <tr key={row.position}>
            <td>{row.name || 'Incomplete record'}</td>
            <td>{[row.city, row.state].filter(Boolean).join(', ')}</td>
            <td>{row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer">Google</a>}{row.website && <a href={row.website} target="_blank" rel="noreferrer">Site</a>}</td>
            <td>{row.reviewStatus === 'verification_pending' ? 'Found · phone not verified yet' : row.reviewStatus.replaceAll('_', ' ')}</td>
          </tr>)}
        </tbody></table>}
      {results.list.importStatus === 'complete' && <LeadTable token={token} listId={results.list.id} listName={results.list.name} />}
    </div>}
  </section>;
}
