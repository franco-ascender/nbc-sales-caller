'use client';
import { useEffect, useRef, useState } from 'react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { LeadEngineError, leadPlanFingerprint } from '@/lib/lead-engine-storage';
import type { LeadDryRun, LeadPlanPage, SavedLeadPlan } from '@/lib/lead-engine-storage';
import type { LeadPlanStorageProps } from './LeadPlanStorage.types';
import styles from './LeadPlanStorage.module.css';
import { LeadScrapeWorkspace } from './LeadScrapeWorkspace';

async function request<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/lead-engine${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'The request failed. Keep your draft and retry.');
  return data;
}
const blockerLabels: Record<string, string> = {
  execution_not_connected: 'Provider execution is not connected.', lane_paused: 'This workflow is paused.',
  forecast_over_budget: 'The projected target cost exceeds the hard budget.', plan_paused: 'This saved plan is paused.',
  hard_budget_exceeded: 'Existing reservations or costs leave too little plan budget.', pilot_cap_exceeded: 'The cumulative pilot limit would be exceeded.',
  approved_measured_pilot_required: 'Scaling requires a measured and approved pilot.', large_batch_confirmation_required: 'This batch needs a recorded approval.',
  stop_loss_triggered: 'Stop-loss or an unresolved provider result blocks another batch.', balance_check_required: 'A current provider balance has not been verified.',
  provider_balance_exceeded: 'The verified provider balance is insufficient.', verified_source_and_quote_required: 'Business sources and a current provider quote still need verification.',
};
export function LeadPlanStorage(props: LeadPlanStorageProps) {
  const { token, user } = useWorkspaceAccess();
  if (!token || !user) return null;
  return <LeadPlanStorageSession key={user.id} {...props} token={token} />;
}

function LeadPlanStorageSession({ input, valid, onOpen, mode = 'search', token }: LeadPlanStorageProps & { token: string }) {
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(''); const [errorCode, setErrorCode] = useState('');
  const [page, setPage] = useState<LeadPlanPage | null>(null); const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SavedLeadPlan | null>(null); const [dryRun, setDryRun] = useState<LeadDryRun | null>(null);
  const currentToken = useRef(token); currentToken.current = token;
  const generation = useRef(0); const active = useRef(false);
  const saveAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const dryAttempt = useRef<{ planId: string; id: string } | null>(null);
  const fingerprint = leadPlanFingerprint(input); const latest = useRef(fingerprint); latest.current = fingerprint;
  const savedMatches = selected !== null && leadPlanFingerprint(selected.input) === fingerprint;
  useEffect(() => {
    generation.current++; active.current = false; setBusy(''); setAccessBlocked(false);
    void run('Loading saved plans…', current => loadPage(0, current));
    return () => { generation.current++; active.current = false; };
  }, [token]);
  useEffect(() => { setDryRun(null); setNotice(''); setErrorCode(''); }, [fingerprint]);

  async function run(label: string, action: (current: () => boolean) => Promise<void>): Promise<void> {
    if (active.current) return;
    active.current = true; const epoch = generation.current;
    const current = () => epoch === generation.current && token === currentToken.current;
    setBusy(label); setNotice(''); setErrorCode('');
    try { await action(current); }
    catch (error) {
      if (!current()) return;
      setNotice(error instanceof LeadEngineError ? error.message : 'The request could not finish. Your draft is unchanged. Retry to recover the same request.');
      setErrorCode(error instanceof LeadEngineError ? error.code : 'request_failed');
      if (error instanceof LeadEngineError && error.code === 'storage_pending') setStorageUnavailable(true);
      if (error instanceof LeadEngineError && [401, 403].includes(error.status)) {
        denyAccess(error.status);
      }
    } finally { if (current()) { active.current = false; setBusy(''); } }
  }
  async function loadPage(next: number, current: () => boolean): Promise<void> {
    const result = await request<LeadPlanPage>(token, `/plans?offset=${next}`);
    if (current()) { setPage(result); setOffset(next); setAccessBlocked(false); setStorageUnavailable(false); }
  }
  function denyAccess(status: number): void {
    generation.current++; active.current = false; setBusy(''); setAccessBlocked(true);
    setPage(null); setSelected(null); setDryRun(null);
    setErrorCode(status === 403 ? 'account_access_pending' : 'workspace_session_pending');
    setNotice(status === 403
      ? 'Saved research is not available for your account yet. Your draft is still available to download.'
      : 'Your NBC session could not be verified. Try again after your workspace session refreshes. Your draft is unchanged.');
  }
  function save(): void {
    if (!valid || accessBlocked || storageUnavailable) return;
    if (saveAttempt.current?.fingerprint !== fingerprint) saveAttempt.current = { fingerprint, id: crypto.randomUUID() };
    const attempt = saveAttempt.current;
    void run('Saving snapshot…', async current => {
      const result = await request<{ plan: SavedLeadPlan }>(token, '/plans', { version: 1, planId: attempt.id, input });
      if (!current()) return;
      setSelected(result.plan); setDryRun(null);
      setNotice(latest.current === attempt.fingerprint ? 'Plan saved. This snapshot is stored in your account.' : 'The earlier snapshot was saved. Your latest edits are still a draft.');
      // Saving remains successful even if the independent list refresh later fails.
      try { await loadPage(0, current); } catch { if (current()) setNotice('Plan saved. Refresh saved plans to update the list.'); }
    });
  }
  function open(id: string): void {
    void run('Opening snapshot…', async current => {
      const result = await request<{ plan: SavedLeadPlan }>(token, `/plans/${id}`);
      if (!current()) return;
      saveAttempt.current = { fingerprint: leadPlanFingerprint(result.plan.input), id: result.plan.id };
      setSelected(result.plan); setDryRun(null); onOpen(result.plan.input);
    });
  }
  function prepare(): void {
    if (!selected || !savedMatches) return;
    if (dryAttempt.current?.planId !== selected.id) dryAttempt.current = { planId: selected.id, id: crypto.randomUUID() };
    const attempt = dryAttempt.current;
    void run('Preparing dry-run…', async current => {
      const result = await request<{ dryRun: LeadDryRun }>(token, `/plans/${attempt.planId}/dry-run`, { version: 1, batchId: attempt.id });
      if (current()) { setDryRun(result.dryRun); setNotice('Dry-run saved. No money was reserved and no search was run.'); }
    });
  }
  return <section className={styles.card} aria-labelledby="saved-plans-title" aria-busy={Boolean(busy)}>
    <div className={styles.heading}><div><h2 id="saved-plans-title" tabIndex={-1}>Your saved research</h2><p>Save a search brief and pick up where you left off.</p></div></div>
      <div hidden={mode === 'lists'}>
      <div className={styles.actions}>
        <button type="button" id="lead-save-draft" className={styles.primary} disabled={!valid || accessBlocked || storageUnavailable || Boolean(busy)} onClick={save}>{savedMatches ? 'Save same snapshot' : 'Save draft snapshot'}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('Loading saved plans…', current => loadPage(0, current))}>Refresh saved plans</button>
        <button type="button" disabled={storageUnavailable || !savedMatches || selected?.status !== 'draft' || Boolean(busy)} onClick={prepare}>Prepare dry-run</button>
      </div>
      <p className={styles.hint}>{savedMatches ? `Saved · ${selected?.status}. Next: below, choose how many businesses to scrape, then review the cost before approving. A dry-run only checks readiness and spends nothing.` : 'Save your current draft to continue. Changes create a new snapshot.'}</p>
      {page?.plans.length === 0 && <p className={styles.empty}>No saved plans yet. Save your first draft snapshot.</p>}
      {page && page.plans.length > 0 && <ul className={styles.plans}>{page.plans.map(plan => <li key={plan.id}>
        <div><strong>{plan.input.industry}</strong><span>{plan.input.metro} · {plan.input.target.toLocaleString('en-US')} target contacts · {plan.status}</span><small>{new Date(plan.createdAt).toLocaleString('en-US')}</small></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => open(plan.id)} aria-label={`Open ${plan.input.industry} plan in ${plan.input.metro}`}>Open plan</button>
      </li>)}</ul>}
      {page && <div className={styles.actions}>
        <button type="button" disabled={offset === 0 || Boolean(busy)} onClick={() => void run('Loading saved plans…', current => loadPage(Math.max(0, offset - 20), current))}>Previous plans</button>
        <button type="button" disabled={page.nextOffset === null || Boolean(busy)} onClick={() => void run('Loading saved plans…', current => loadPage(page.nextOffset!, current))}>Next plans</button>
      </div>}
      </div>
      {!accessBlocked && <LeadScrapeWorkspace key={token} token={token} plan={selected} savedMatches={savedMatches} mode={mode} onAccessDenied={denyAccess} storageUnavailable={storageUnavailable} onStorageChange={setStorageUnavailable} />}
      {accessBlocked && mode === 'lists' && <button type="button" disabled={Boolean(busy)} onClick={() => void run('Checking account access…', current => loadPage(0, current))}>Try again</button>}
    {busy && <p role="status">{busy}</p>}
    {storageUnavailable && <div role="status" className={styles.notice} aria-label="Saving availability"><strong>Saving isn't available yet</strong><p>NBC is finishing setup for saving searches and lead lists. You can still plan and download your draft. Saving and scraping are not available yet.</p><button type="button" disabled={Boolean(busy)} onClick={() => void run('Checking saving availability…', current => loadPage(0, current))}>Check again</button></div>}
    {notice && errorCode !== 'storage_pending' && (mode !== 'lists' || errorCode) && <div role="status" className={errorCode ? styles.notice : styles.success}>
<p>{notice}</p>
    </div>}
    {dryRun && savedMatches && mode !== 'lists' && <div className={styles.dryRun}><h3>Dry-run · execution disabled</h3>
      <p>Up to {dryRun.maxBusinesses} businesses · ${(dryRun.maxCostCents / 100).toFixed(2)} cap · $0 reserved · $0 spent</p>
      <ul>{dryRun.blockers.map(blocker => <li key={blocker}>{blockerLabels[blocker] ?? 'An additional server readiness check is required.'}</li>)}</ul>
      <p>Checked {new Date(dryRun.checkedAt).toLocaleString('en-US')}. Repeating this request opens the same diagnostic snapshot.</p>
    </div>}
  </section>;
}
