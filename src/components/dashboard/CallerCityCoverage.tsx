"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Building2, CheckCircle2, CircleDollarSign, MapPinned, Phone, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { CityNumberCoverageSummary, NumberQuoteResult, PhoneNumberCoverage } from "@/services/caller-city-numbers.service";
import { formatUsPhoneNumber } from "@/lib/twilio-phone-numbers";
import ops from "./CallerOperations.module.css";
import coverage from "./CallerCityCoverage.module.css";

async function request<T>(token: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/caller/phone-numbers", {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(body?.action === "purchase" ? 30000 : 15000),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Local-number coverage could not be updated.");
  return result;
}

const money = (cents: number | null, currency = "USD"): string => cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);

export function CallerCityCoverage({ active, token }: { active: boolean; token: string }): ReactNode {
  const [data, setData] = useState<CityNumberCoverageSummary | null>(null);
  const [quote, setQuote] = useState<NumberQuoteResult | null>(null);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [budget, setBudget] = useState("25");
  const [capacity, setCapacity] = useState("10");
  const [pending, setPending] = useState<PhoneNumberCoverage | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh(): Promise<void> {
    if (!token || busy) return;
    setBusy("refresh"); setError("");
    try {
      const next = await request<CityNumberCoverageSummary>(token);
      setData(next);
      if (next.approval?.monthlyBudgetCents !== null && next.approval?.monthlyBudgetCents !== undefined) setBudget(String(next.approval.monthlyBudgetCents / 100));
      if (next.approval) setCapacity(String(next.approval.maximumActiveNumbers));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Local-number coverage could not be loaded."); }
    finally { setBusy(""); }
  }
  useEffect(() => { if (active && !data && !busy) void refresh(); }, [active, token]);

  async function search(event: FormEvent): Promise<void> {
    event.preventDefault(); setBusy("quote"); setError(""); setSuccess(""); setQuote(null);
    try {
      const result = await request<NumberQuoteResult>(token, { action: "quote", city, region });
      setQuote(result);
      if (!result.candidates.length) setSuccess("Twilio has no eligible voice numbers for that exact city right now. Try another nearby city or search again later.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The quote could not be loaded."); }
    finally { setBusy(""); }
  }

  async function purchase(): Promise<void> {
    if (!pending || !confirmed) return;
    setBusy("purchase"); setError(""); setSuccess("");
    try {
      await request<{ number: PhoneNumberCoverage }>(token, { action: "purchase", quoteId: pending.id, requestId: crypto.randomUUID(), confirmed: true });
      setSuccess(formatUsPhoneNumber(pending.phoneNumber) + " is now active for " + pending.city + ", " + pending.region + ".");
      setPending(null); setConfirmed(false); setQuote(null);
      setData(await request<CityNumberCoverageSummary>(token));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The purchase could not be confirmed."); }
    finally { setBusy(""); }
  }

  async function reconcile(id: string): Promise<void> {
    setBusy("reconcile-" + id); setError(""); setSuccess("");
    try {
      await request(token, { action: "reconcile", id });
      setSuccess("Twilio ownership was reconciled and the number is active.");
      setData(await request<CityNumberCoverageSummary>(token));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The number could not be reconciled."); }
    finally { setBusy(""); }
  }

  async function saveBudget(approved: boolean): Promise<void> {
    setBusy("budget"); setError(""); setSuccess("");
    try {
      const next = await request<CityNumberCoverageSummary>(token, { action: "set_budget", approved, monthlyBudgetCents: Math.round(Number(budget) * 100), maximumActiveNumbers: Number(capacity) });
      setData(next); setSuccess(approved ? "The monthly purchase guard is active." : "Number purchasing is blocked.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The budget could not be updated."); }
    finally { setBusy(""); }
  }

  const activeNumbers = data?.numbers.filter(number => number.status === "active").length ?? 0;
  const approval = data?.approval;
  const purchaseAllowed = Boolean(approval?.approved && approval.monthlyBudgetCents !== null);
  return <div className={ops.stack}>
    <section className={ops.queueHero}>
      <div><span className={ops.kicker}>LOCAL CALLER ID</span><h2>Own the local presence from NBC.</h2><p>Search Twilio inventory by city, see the account-specific monthly price, and add an approved number to the Caller without leaving the workspace.</p><div className={ops.actions}><button className={ops.secondary} disabled={Boolean(busy)} onClick={() => void refresh()}><RefreshCw size={15} />{busy === "refresh" ? "Refreshing…" : "Refresh inventory"}</button></div></div>
      <div className={ops.queueSummary}><MapPinned size={22} /><strong>{activeNumbers}</strong><span>active local numbers</span><small>{approval ? money(approval.committedMonthlyCents) + " / month committed" : "Loading controls"}</small></div>
    </section>
    {error && <p className={ops.error} role="alert">{error}</p>}
    {success && <p className={ops.success} role="status">{success}</p>}
    {!data && !error && <p className={ops.notice}>Loading local-number controls…</p>}
    {data && !data.configured && <p className={ops.notice}>Local-number purchasing is being activated. The database guard is not available yet, so no purchase can be submitted.</p>}
    {data?.configured && <>
      <section className={ops.statGrid} aria-label="Local coverage status">
        <article><span>Purchase authority</span><strong>{approval?.approved ? "Ready" : "Locked"}</strong><small>{approval?.approved ? "Anas approved the monthly guard." : "Only Anas can unlock spending."}</small><ShieldCheck className={ops.statIcon} size={20} /></article>
        <article><span>Coverage capacity</span><strong>{activeNumbers}/{approval?.maximumActiveNumbers ?? 0}</strong><small>Active NBC local numbers</small><Building2 className={ops.statIcon} size={20} /></article>
        <article><span>Monthly commitment</span><strong>{money(approval?.committedMonthlyCents ?? 0)}</strong><small>Numbers active or awaiting reconciliation</small><Phone className={ops.statIcon} size={20} /></article>
        <article><span>Approved ceiling</span><strong>{money(approval?.monthlyBudgetCents ?? null)}</strong><small>Hard guard before every purchase</small><CircleDollarSign className={ops.statIcon} size={20} /></article>
      </section>

      {data.canApprove && <section className={ops.chartCard}>
        <header><div><span className={ops.kicker}>ANAS APPROVAL</span><h3>Monthly purchase guard</h3></div><span className={ops.chartBadge}>{approval?.approved ? "Purchasing enabled" : "Purchasing locked"}</span></header>
        <p className={ops.scope}>This is the hard ceiling for recurring phone-number rent. Every purchase is still confirmed individually.</p>
        <div className={coverage.numberControls}>
          <label>Monthly budget (USD)<input aria-label="Monthly number budget" type="number" min="1" max="1000" step="1" value={budget} onChange={event => setBudget(event.target.value)} /></label>
          <label>Maximum active numbers<input aria-label="Maximum active numbers" type="number" min="1" max="100" step="1" value={capacity} onChange={event => setCapacity(event.target.value)} /></label>
          <button className={ops.primary} disabled={Boolean(busy)} onClick={() => void saveBudget(true)}><ShieldCheck size={15} />Approve guard</button>
          {approval?.approved && <button className={ops.secondary} disabled={Boolean(busy)} onClick={() => void saveBudget(false)}>Lock purchases</button>}
        </div>
      </section>}

      <section className={ops.chartCard}>
        <header><div><span className={ops.kicker}>LIVE TWILIO INVENTORY</span><h3>Find a local number</h3></div><span className={ops.chartBadge}>{data.providerConfigured ? "Connected" : "Setup required"}</span></header>
        <form className={coverage.numberSearch} onSubmit={event => void search(event)}>
          <label>City<input aria-label="City" autoComplete="address-level2" placeholder="Miami" value={city} onChange={event => setCity(event.target.value)} /></label>
          <label>State<input aria-label="State" autoComplete="address-level1" placeholder="FL" maxLength={2} value={region} onChange={event => setRegion(event.target.value.toUpperCase())} /></label>
          <button className={ops.primary} disabled={Boolean(busy) || !data.providerConfigured}><Search size={15} />{busy === "quote" ? "Searching…" : "Search numbers"}</button>
        </form>
        <p className={ops.scope}>Searching is read-only and does not spend money. Quotes expire after ten minutes because provider availability changes.</p>
        {quote && quote.candidates.length > 0 && <div className={coverage.numberGrid}>
          {quote.candidates.map(number => <article key={number.id}>
            <div className={coverage.numberIcon}><Phone size={18} /></div>
            <div><strong>{formatUsPhoneNumber(number.phoneNumber)}</strong><span>{number.city}, {number.region} · {number.rateCenter ?? "local rate center"}</span></div>
            <div className={coverage.numberPrice}><strong>{money(number.quotedMonthlyCents, number.quotedCurrency)}</strong><span>per month</span></div>
            <button className={ops.primary} disabled={!purchaseAllowed || Boolean(busy)} title={purchaseAllowed ? "Review purchase" : "Anas must approve a budget first"} onClick={() => { setPending(number); setConfirmed(false); }}>Review purchase</button>
          </article>)}
        </div>}
      </section>

      <section className={ops.chartCard}><header><div><span className={ops.kicker}>NBC INVENTORY</span><h3>City numbers</h3></div><span className={ops.chartBadge}>{data.numbers.length} records</span></header>{data.numbers.length ? <div className={ops.tableWrap}><table><thead><tr><th>City</th><th>Number</th><th>Monthly</th><th>Voice</th><th>Status</th><th></th></tr></thead><tbody>{data.numbers.map(number => <tr key={number.id}><td>{number.city}, {number.region}<small>{number.rateCenter ?? "Rate center not supplied"}</small></td><td>{formatUsPhoneNumber(number.phoneNumber)}</td><td>{money(number.quotedMonthlyCents, number.quotedCurrency)}</td><td>{number.voiceCapable ? "Ready" : "Unavailable"}</td><td><span className={number.status === "active" ? ops.done : ops.ready}>{number.status}</span></td><td>{["purchasing", "uncertain"].includes(number.status) && <button className={ops.textButton} disabled={Boolean(busy)} onClick={() => void reconcile(number.id)}>{busy === "reconcile-" + number.id ? "Checking…" : "Reconcile"}</button>}</td></tr>)}</tbody></table></div> : <div className={ops.empty}><MapPinned size={27} /><h3>No local numbers assigned.</h3><p>Search a target city to see live availability. Nothing is purchased until Anas approves the budget and an admin confirms a specific number.</p></div>}</section>
    </>}

    {pending && <dialog open className={`${ops.dialog} ${coverage.dialogModal}`} aria-labelledby="number-purchase-title">
      <header><div><span className={ops.kicker}>RECURRING PURCHASE</span><h3 id="number-purchase-title">Add this number to NBC?</h3></div><button className={ops.textButton} aria-label="Close purchase review" disabled={busy === "purchase"} onClick={() => setPending(null)}><X size={18} /></button></header>
      <div className={coverage.purchaseReview}><div className={coverage.numberIcon}><Phone size={21} /></div><div><strong>{formatUsPhoneNumber(pending.phoneNumber)}</strong><span>{pending.city}, {pending.region} · {pending.rateCenter ?? "local rate center"}</span></div><div><strong>{money(pending.quotedMonthlyCents, pending.quotedCurrency)}</strong><span>charged monthly by Twilio</span></div></div>
      <label className={ops.consent}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this recurring number purchase. It fits within Anas’s approved monthly ceiling.</label>
      <p className={ops.scope}>NBC rechecks capacity and budget on the server before contacting Twilio. A timeout is held for reconciliation and never triggers an automatic second purchase.</p>
      <div className={ops.actions}><button className={ops.primary} disabled={!confirmed || busy === "purchase"} onClick={() => void purchase()}><CheckCircle2 size={15} />{busy === "purchase" ? "Confirming with Twilio…" : "Purchase number"}</button><button className={ops.secondary} disabled={busy === "purchase"} onClick={() => setPending(null)}>Cancel</button></div>
    </dialog>}
  </div>;
}
