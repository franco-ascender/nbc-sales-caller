'use client';
import { Fragment, useState } from 'react';
import { ChevronDown, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import type { LeadDetail, VerificationProgress } from '@/services/lead-engine-verify.service';
import styles from './LeadTable.module.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const phone = (value: string | null) => value ? `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}` : '—';
const MILLICENTS_PER_NUMBER = 700;

const statusLabel: Record<LeadDetail['status'], string> = {
  delivered: 'Callable mobile', dropped: 'Dropped in verification',
  unverified: 'Not verified yet', filtered_out: 'Filtered before paying',
};
const dropLabel: Record<string, string> = {
  not_mobile: 'Landline or VoIP — never dial a landline from this list',
  do_not_call: 'On the Do Not Call registry',
  tcpa_litigator: 'Known TCPA litigator',
  not_reachable: 'Number is not reachable',
  no_provider_answer: 'The verification provider had no data for this number',
  time_zone_unresolved: 'No time zone could be resolved, so there is no legal calling window',
};

async function call<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/lead-engine${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(40000),
  });
  const data = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new LeadEngineError(response.status, data.code ?? 'request_failed', data.error ?? 'That step could not be completed.');
  return data;
}

export function LeadTable({ token, listId, listName }: { token: string; listId: string; listName: string }) {
  const [leads, setLeads] = useState<LeadDetail[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [totals, setTotals] = useState<VerificationProgress | null>(null);

  async function load(): Promise<void> {
    setBusy('Loading leads…'); setError('');
    try { setLeads((await call<{ leads: LeadDetail[] }>(token, `/lists/${listId}/leads`)).leads); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The leads could not be loaded.'); }
    finally { setBusy(''); }
  }

  // One call per chunk so progress is visible and a timeout never loses numbers already paid for.
  async function verifyAll(): Promise<void> {
    setError('');
    const running: VerificationProgress = { processed: 0, remaining: 0, costCents: 0, delivered: 0, mobile: 0, landline: 0, dncExcluded: 0, tcpaExcluded: 0, unreachable: 0, noTimeZone: 0, unmatched: 0 };
    try {
      for (let guard = 0; guard < 40; guard++) {
        const round = await call<VerificationProgress>(token, `/lists/${listId}/verify`, {});
        for (const key of Object.keys(running) as Array<keyof VerificationProgress>) {
          if (key !== 'remaining') running[key] += round[key];
        }
        running.remaining = round.remaining;
        setTotals({ ...running });
        setBusy(round.remaining > 0 ? `Verifying… ${running.processed} done, ${round.remaining} to go` : '');
        if (round.remaining === 0 || round.processed === 0) break;
      }
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Verification stopped. Numbers already checked are saved and will not be charged again.');
    } finally { setBusy(''); }
  }

  if (!leads) return <div className={styles.panel}>
    <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void load()}>
      {busy ? <><Loader2 size={15} className={styles.spin} />Loading…</> : `Open ${listName}`}
    </button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;

  const pending = leads.filter(lead => lead.status === 'unverified' && lead.phone10);
  const callable = leads.filter(lead => lead.status === 'delivered');

  return <div className={styles.panel}>
    <div className={styles.head}>
      <div><h3>{listName}</h3><p>{leads.length} businesses · <strong>{callable.length} callable mobiles</strong> · {pending.length} not verified yet</p></div>
      {pending.length > 0 && <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void verifyAll()}>
        {busy ? <><Loader2 size={15} className={styles.spin} />{busy}</> : <><ShieldCheck size={15} />Verify all {pending.length} · {money(Math.ceil(pending.length * MILLICENTS_PER_NUMBER / 1000))}</>}
      </button>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {totals && <p className={styles.progress}>Checked {totals.processed} numbers for {money(totals.costCents)} · {totals.delivered} callable · {totals.landline} landline · {totals.dncExcluded} on Do Not Call · {totals.tcpaExcluded} litigator · {totals.unreachable} unreachable</p>}

    <table className={styles.table}>
      <thead><tr><th /><th>Business</th><th>Phone</th><th>Where</th><th>Status</th></tr></thead>
      <tbody>
        {leads.map(lead => <Fragment key={lead.position}>
          <tr className={lead.status === 'delivered' ? styles.callable : undefined}>
            <td><button type="button" className={styles.expand} aria-expanded={open === lead.position} aria-label={`Details for ${lead.name}`}
              onClick={() => setOpen(open === lead.position ? null : lead.position)}><ChevronDown size={15} /></button></td>
            <td>{lead.name || 'Incomplete record'}</td>
            <td className={styles.phone}>{lead.status === 'delivered' ? <strong><Phone size={13} />{phone(lead.phone10)}</strong> : phone(lead.phone10)}</td>
            <td>{[lead.city, lead.state].filter(Boolean).join(', ')}</td>
            <td><span className={styles[lead.status]}>{statusLabel[lead.status]}</span></td>
          </tr>
          {open === lead.position && <tr><td /><td colSpan={4}>
            <dl className={styles.detail}>
              <div><dt>Phone</dt><dd>{phone(lead.phone10)}</dd></div>
              <div><dt>Line type</dt><dd>{lead.lineType ?? 'Not checked'}</dd></div>
              <div><dt>Do Not Call</dt><dd>{lead.dnc === null ? 'Not checked' : lead.dnc ? 'Listed — do not call' : 'Clear'}</dd></div>
              <div><dt>TCPA litigator</dt><dd>{lead.tcpa === null ? 'Not checked' : lead.tcpa ? 'Listed — excluded' : 'Clear'}</dd></div>
              <div><dt>Reachable</dt><dd>{lead.reachable === null ? 'Not checked' : lead.reachable ? 'Yes' : 'No'}</dd></div>
              <div><dt>Time zone</dt><dd>{lead.timeZone ?? 'Unresolved — no legal calling window'}</dd></div>
              <div><dt>Verified</dt><dd>{lead.verifiedAt ? new Date(lead.verifiedAt).toLocaleString('en-US') : 'Not verified'}</dd></div>
              <div><dt>Website</dt><dd>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : 'None published'}</dd></div>
              <div><dt>Google listing</dt><dd>{lead.sourceUrl ? <a href={lead.sourceUrl} target="_blank" rel="noreferrer">Open listing</a> : '—'}</dd></div>
              <div><dt>Email</dt><dd>Not collected — the scraper runs with contact enrichment off to keep the cost at $0.004 per business.</dd></div>
              {lead.rejection && <div><dt>Filtered before paying</dt><dd>{lead.rejection.replaceAll('_', ' ')}</dd></div>}
              {lead.dropReason && <div><dt>Dropped because</dt><dd>{dropLabel[lead.dropReason] ?? lead.dropReason.replaceAll('_', ' ')}</dd></div>}
            </dl>
          </td></tr>}
        </Fragment>)}
      </tbody>
    </table>
    <p className={styles.note}>Only rows marked callable passed all four checks: mobile, not on Do Not Call, not a litigator, and reachable. The scrub is accurate today and must be repeated after 31 days. Manual dialing only, 8:00am to 8:00pm in the lead&apos;s own time zone.</p>
  </div>;
}
