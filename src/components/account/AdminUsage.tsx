'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { quoteCredits } from '@/lib/usage';
import type { ProviderUsageAvailable, UsagePage } from '@/lib/usage';
import styles from './Account.module.css';
import costs from './AdminUsage.module.css';

const number = (value: number): string => value.toLocaleString('en-US');
const money = (value: number): string => `$${(value / 1e6).toFixed(value < 1e6 ? 4 : 2)}`;
const minutes = (seconds: number): string => `${(seconds / 60).toFixed(1)} min`;

export function AdminUsage() {
  const { user, token } = useWorkspaceAccess();
  return user?.role === 'admin' ? <Usage token={token} /> : <div className={styles.page}><h1>Usage</h1><p>Administrator access is required.</p></div>;
}

function ProviderCosts({ provider }: { provider: ProviderUsageAvailable }) {
  const maximum = Math.max(1, ...provider.daily.map(day => day.costMicrousd));
  const usedPercent = provider.account.creditsUsed !== null && provider.account.creditsLimit ? Math.min(100, provider.account.creditsUsed / provider.account.creditsLimit * 100) : null;
  return <section className={`${styles.card} ${costs.providerCard}`}>
    <div className={costs.providerHeading}>
      <div><span className={costs.liveBadge}><i />LIVE PROVIDER DATA</span><h2>Actual voice infrastructure cost</h2><p>Reported directly by the connected provider. Values include this workspace&apos;s voice, intelligence and generation usage.</p></div>
      <span className={costs.measured}>Updated {new Date(provider.measuredAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
    <div className={costs.costStats}>
      <article><span>Today</span><strong>{money(provider.today.costMicrousd)}</strong><small>{minutes(provider.today.seconds)} · {number(provider.today.credits)} credits</small></article>
      <article><span>Last 7 days</span><strong>{money(provider.sevenDays.costMicrousd)}</strong><small>{minutes(provider.sevenDays.seconds)} · provider reported</small></article>
      <article><span>Last 30 days</span><strong>{money(provider.thirtyDays.costMicrousd)}</strong><small>{minutes(provider.thirtyDays.seconds)} · provider reported</small></article>
      <article><span>Current overage</span><strong>{provider.account.currentOverageMicrousd === null ? '—' : money(provider.account.currentOverageMicrousd)}</strong><small>{provider.account.currency ?? 'Plan billing'} · invoice impact</small></article>
    </div>
    <div className={costs.providerBody}>
      <div className={costs.trend}>
        <div className={costs.subheading}><div><Activity size={16}/><strong>Daily cost</strong></div><span>UTC · last 30 days</span></div>
        <div className={costs.costBars} aria-label="Daily provider cost for the last 30 days">{provider.daily.map(day => <i key={day.date} style={{ height: `${Math.max(3, day.costMicrousd / maximum * 100)}%` }} aria-label={`${day.date}: ${money(day.costMicrousd)}`} title={`${day.date} · ${money(day.costMicrousd)}`} />)}</div>
      </div>
      <div className={costs.allowance}>
        <div className={costs.subheading}><div><WalletCards size={16}/><strong>Plan allowance</strong></div><span>{provider.account.tier ?? 'Connected plan'}</span></div>
        {provider.account.creditsUsed !== null && provider.account.creditsLimit !== null ? <>
          <div className={costs.allowanceNumbers}><strong>{number(provider.account.creditsRemaining ?? 0)}</strong><span>credits remaining</span></div>
          <div className={costs.allowanceTrack}><i style={{ width: `${usedPercent ?? 0}%` }} /></div>
          <small>{number(provider.account.creditsUsed)} of {number(provider.account.creditsLimit)} used{provider.account.resetsAt ? ` · resets ${new Date(provider.account.resetsAt).toLocaleDateString('en-US')}` : ''}</small>
        </> : <p>Allowance details are unavailable for this plan.</p>}
      </div>
    </div>
    <div className={costs.productRows}>{provider.products.map(product => <div key={product.label}><span><i />{product.label}</span><strong>{money(product.costMicrousd)}</strong><small>{minutes(product.seconds)}</small></div>)}</div>
    <p className={costs.costNote}>Provider cost is the measured value of usage. The amount charged to the card can differ when usage is covered by the subscription; current overage is shown separately.</p>
  </section>;
}

function Usage({ token }: { token: string }) {
  const [data, setData] = useState<UsagePage | null>(null), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [revision, setRevision] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(true), [cost, setCost] = useState('1.00');
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    void fetch(`/api/admin/usage?${new URLSearchParams({ offset: String(offset), search: query })}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async response => { if (!response.ok) throw Error('Usage could not be loaded.'); return response.json(); })
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setError('Usage could not be loaded. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token, offset, query, revision]);
  const rate = data?.rates.find(item => item.status === 'draft'), amount = Number(cost);
  const estimate = rate && Number.isFinite(amount) && amount >= 0 && amount <= 1000000 ? quoteCredits(Math.round(amount * 1e6), rate.credit_value_microusd, rate.markup_bps) : null;
  return <div className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>NBC ADMINISTRATION</span><h1>Usage & costs</h1><p>Provider spend, member consumption and NBC Credits in one place.</p></div><button aria-label="Refresh usage" onClick={() => setRevision(value => value + 1)} disabled={busy}><RefreshCw size={16}/></button></header>
    <div className={styles.notice}><ShieldCheck size={15}/> Live observation · Provider costs are read directly. NBC Credits are not deducted automatically yet.</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {data?.provider.status === 'available' ? <ProviderCosts provider={data.provider} /> : data && <div className={styles.notice}>The provider cost feed is temporarily unavailable. Member usage remains visible below; refresh to retry.</div>}
    <div className={styles.stats}><div className={styles.stat}><span>{query ? 'Matching members' : 'Registered members'}</span><strong>{data ? number(data.total) : '—'}</strong><span>New members appear automatically</span></div><div className={styles.stat}><span>Metering</span><strong>Live</strong><span>Actual usage, no automatic charges</span></div><div className={styles.stat}><span>Credit top-ups</span><strong>{data?.paymentsReady ? 'Configured' : 'In setup'}</strong><span>Approved packages required</span></div></div>
    <section className={styles.card}>
      <div className={styles.toolbar}><h2>Member usage</h2><form onSubmit={event => { event.preventDefault(); setOffset(0); setQuery(search); }}><input aria-label="Search members" placeholder="Search by name or email…" maxLength={120} value={search} onChange={event => setSearch(event.target.value)}/><button aria-label="Search usage"><Search size={16}/></button></form></div>
      <p>Lifetime reported totals. Finalized Caller sessions now store their full provider-reported cost; older or incomplete operations stay clearly marked as partial.</p>
      {busy && <p role="status">Loading member usage…</p>}
      <div className={styles.table}><table><thead><tr>{['Member','Input / output tokens','Cached tokens','Voice minutes','Known cost','NBC Credits','Metering coverage'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{data?.members.map(member => <tr key={member.id}><td><strong>{member.display_name}</strong><small>{member.email}</small><small>{member.role} · {member.status}</small></td><td>{member.events > 0 && member.unmeasured === member.events ? '— / —' : `${number(member.input_tokens)} / ${number(member.output_tokens)}`}<small>{number(member.events)} recorded operations</small></td><td>{number(member.cached_tokens)}</td><td>{(member.seconds / 60).toFixed(1)}</td><td>{money(member.known_cost_microusd)}<small>{member.partial_cost ? 'Includes partial / unavailable costs' : 'Reported total cost'}</small></td><td>{number(member.available)} available<small>{number(member.reserved)} reserved</small></td><td>{member.events === 0 ? 'No usage yet' : member.unmeasured ? `${member.unmeasured} without token measurements` : 'Tokens reported'}<small>{member.last_used ? new Date(member.last_used).toLocaleDateString('en-US') : 'Ready to track'}</small></td></tr>)}</tbody></table></div>
      {data && !data.members.length && !busy && <p>No members match this search.</p>}
      <div className={styles.pagination}><button disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</button><span>{data?.total ? `${offset + 1}–${Math.min(offset + 50, data.total)} of ${data.total}` : '0 members'}</span><button disabled={busy || data?.nextOffset == null} onClick={() => setOffset(data!.nextOffset!)}>Next</button></div>
    </section>
    <div className={styles.twoCols}><section className={styles.card}><span className={styles.badge}>DRAFT EQUIVALENCE</span><h2>NBC Credits</h2><p>{rate ? `Working proposal: 1 credit = $${(rate.credit_value_microusd / 1e6).toFixed(2)} of purchasing value. Illustrative ${rate.markup_bps / 10000}× cost multiplier.` : 'The commercial rate is being prepared.'} These values are not active customer pricing.</p><div className={styles.calculation}><label>Actual operation cost (USD)<input aria-label="Operation cost in USD" type="number" step="0.01" min="0" max="1000000" value={cost} onChange={event => setCost(event.target.value)}/></label><div><strong>{estimate === null ? '—' : number(estimate)}</strong><small>estimated credits · rounded up</small></div></div></section><section className={styles.card}><span className={styles.badge}>PAYMENT INFRASTRUCTURE</span><h2>Ready for the next step</h2><p>Credit packages, purchase records and verified payment fulfillment are prepared. Top-ups remain unavailable until the payment account and approved packages are configured.</p><p>Members see their NBC balance. Provider details and cost analysis stay in administration.</p></section></div>
  </div>;
}
