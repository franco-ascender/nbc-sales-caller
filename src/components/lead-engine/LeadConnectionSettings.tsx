'use client';

import { useEffect, useRef, useState } from 'react';
import { Database, Globe2, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import type { LeadConnectionCheck } from '@/lib/lead-engine-research';
import styles from './LeadConnectionSettings.module.css';

export function LeadConnectionSettings() {
  const { token, user } = useWorkspaceAccess();
  if (!token || user?.role !== 'admin') return null;
  return <AdminLeadConnectionSettings key={`${user.id}:${token}`} token={token} />;
}

function AdminLeadConnectionSettings({ token }: { token: string }) {
  const [result, setResult] = useState<LeadConnectionCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current++; }, []);

  async function check(): Promise<void> {
    if (active.current) return;
    active.current = true; const version = epoch.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/lead-engine/connections/check', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}', cache: 'no-store', signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(response.status === 403
        ? 'Administrator access is required to manage lead providers.'
        : response.status === 401 ? 'Your NBC session could not be verified. Refresh your session and try again.'
          : 'Provider access could not be checked. Please try again.');
      const data = await response.json() as LeadConnectionCheck;
      if (version === epoch.current) setResult(data);
    } catch (failure) {
      if (version === epoch.current) setError(failure instanceof Error ? failure.message : 'Provider access could not be checked.');
    } finally {
      if (version === epoch.current) { active.current = false; setBusy(false); }
    }
  }

  return <section className={styles.section} aria-labelledby="lead-provider-settings-title" aria-busy={busy}>
    <header className={styles.heading}><div><span className={styles.badge}><ShieldCheck size={14} />Administrator settings</span><h2 id="lead-provider-settings-title">Lead providers</h2><p>Manage the services behind Lead Engine for your NBC workspace.</p></div><button type="button" disabled={busy} onClick={() => void check()}><RefreshCw size={15} />{busy ? 'Checking access…' : 'Check provider access'}</button></header>
    <div className={styles.grid}>
      <article><Globe2 size={21} /><h3>Outscraper</h3><p>Business discovery (Google Maps). Adapter built and tested with fixtures; the account is reserved for another use, so this stays on hold.</p><details><summary>Setup requirements</summary><p>Configure OUTSCRAPER_API_KEY privately on the server only if a dedicated account becomes available. Confirm balance and pricing before enabling discovery runs.</p></details></article>
      <article><Globe2 size={21} /><h3>Apify</h3><p>Business discovery. Adapter is ready; requires a dedicated API token, verified pricing and an approved budget.</p><details><summary>Setup requirements</summary><p>Configure APIFY_API_TOKEN privately on the server. Confirm the Actor, build, inputs, pricing and available balance before enabling discovery.</p></details></article>
      <article><Phone size={21} /><h3>BatchData</h3><p>Phone verification. Adapter is ready; not yet connected to any route or automatic run.</p><details><summary>Setup requirements</summary><p>Configure BATCHDATA_API_KEY privately on the server. No free read-only check exists for this provider, so access still needs a small approved paid test before it counts as verified.</p></details></article>
      <article><Database size={21} /><h3>Research storage</h3><p>Uses the existing Supabase account. Lead Engine storage and budget controls are pending integration.</p></article>
    </div>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {result && <div className={styles.notice} role="status"><h3>Provider access results</h3><dl>
      <div><dt>Outscraper</dt><dd>{{ missing: 'API key not configured', access_verified: 'Account access verified; no scrape run', rejected: 'Key rejected; check provider permissions', unavailable: 'Could not verify access; retry' }[result.outscraper]}</dd></div>
      <div><dt>Apify</dt><dd>{{ missing: 'API token not configured', access_verified: 'Account access verified; no scrape run', rejected: 'Token rejected; check provider permissions', unavailable: 'Could not verify access; retry' }[result.apify]}</dd></div>
      <div><dt>BatchData</dt><dd>{result.phoneVerifier === 'missing' ? 'API key not configured' : 'Key configured; capabilities not verified'}</dd></div>
    </dl><p>No scraper or paid phone verification was started. Account access does not establish available balance or approve a budget.</p></div>}
    <p className={styles.note}>Credentials are configured privately on the server. Students and coaches use NBC Credits and do not manage provider accounts here.</p>
  </section>;
}
