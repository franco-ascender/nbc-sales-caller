"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, BarChart3, Check, ChevronRight, FileUp, LayoutList, Phone, Plus, Search, Users, X } from "lucide-react";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import { leadStages, normalizePhone, parseLeadCsv, pipelineStats, stageLabel } from "@/lib/caller-crm";
import type { CallerLead, LeadStage } from "@/lib/caller-crm";
import type { CallSession } from "@/lib/caller-types";
import { conversationQuality, conversationSignals } from "@/lib/caller-reasons";
import styles from "./CallerSales.module.css";

import { salesRequest } from "@/lib/caller-request";
export { salesRequest } from "@/lib/caller-request";
import { CallerLeadDetail } from "./CallerLeadDetail";
import type { NoteDraft } from "./CallerLeadDetail";
import type { PipelineStore } from "./CallerPipeline";
import { isBlocked } from "@/lib/caller-workbench";
import type { ListStore } from "./CallerLists";
import { CallerAudioRecorder } from "./CallerAudioRecorder";
import ops from "./CallerOperations.module.css";

export function useCallerLeads(demo = false) {
  const { token } = useWorkspaceAccess();
  const [leads, setLeads] = useState<CallerLead[]>([]), [configured, setConfigured] = useState(false), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const alive = useRef(true), lock = useRef(false), version = useRef(0), context = useRef({ token, demo }); context.current = { token, demo };
  useEffect(() => { alive.current = true; return () => { alive.current = false; version.current++; }; }, []);
  async function refresh(): Promise<void> {
    if (context.current.token !== token || context.current.demo !== demo) return;
    const turn = ++version.current;
    const data = await salesRequest<{ leads: CallerLead[]; configured: boolean; hasMore: boolean }>(token, `/api/caller/leads${demo ? "?demo=true" : ""}`);
    if (alive.current && context.current.token === token && context.current.demo === demo && turn === version.current) { setLeads(data.leads); setConfigured(data.configured); setHasMore(data.hasMore); }
  }
  async function run(work: () => Promise<string>): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { const message = await work(); if (alive.current) setSuccess(message); return true; }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Try again."); return false; }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => { setLeads([]); setError(""); if (!token) return; let cancelled = false; setBusy(true); void refresh().catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Leads could not load."); }).finally(() => { if (!cancelled) setBusy(false); }); return () => { cancelled = true; version.current++; }; }, [token, demo]);
  async function save(lead: CallerLead, stage: LeadStage, notes: string): Promise<boolean> {
    return run(async () => {
      const result = await salesRequest<{ lead: CallerLead }>(token, "/api/caller/leads", "PATCH", { id: lead.id, stage, notes, updatedAt: lead.updated_at, demo });
      version.current++;
      if (alive.current) setLeads(previous => previous.map(item => item.id === result.lead.id ? result.lead : item));
      return "Lead updated. No call was placed.";
    });
  }
  return { leads, configured, hasMore, busy, error, success, run, refresh, save, token, demo };
}
export type LeadStore = ReturnType<typeof useCallerLeads>;
export function LeadFeedback({ store }: { store: LeadStore }): ReactNode {
  return <>{store.error && <div className={styles.error} role="alert">{store.error} <button disabled={store.busy} onClick={() => void store.run(async () => { await store.refresh(); return "Leads refreshed."; })}>Refresh leads</button></div>}{store.success && <p className={styles.success} role="status"><Check size={16} />{store.success}</p>}{!store.configured && !store.busy && !store.error && <p className={styles.notice}>Your CRM storage is being prepared. You can preview a CSV now; saving leads will become available after setup.</p>}</>;
}
export function CallerReasons({ sessions, inspect }: { sessions: CallSession[]; inspect(id: string): void }): ReactNode {
  const [range, setRange] = useState("30"), [channel, setChannel] = useState("all");
  const filtered = sessions.filter(session => (range === "all" || Date.parse(session.created_at) >= Date.now() - Number(range) * 86400000) && (channel === "all" || session.channel === channel));
  const analysis = conversationSignals(filtered);
  const quality = conversationQuality(filtered);
  const categories = ["Objections", "Customer care", "Next steps"] as const;
  return <div className={styles.stack}>
    <header className={styles.sectionHead}><div><span className={styles.kicker}>LISTEN. LEARN. REFINE.</span><h2>What keeps coming up?</h2><p>Every completed conversation feeds a living view of objections, care issues, and next steps.</p></div></header>
    <div className={styles.insightStrip}><article><strong>{analysis.recurring}</strong><span>recurring themes</span></article><article><strong>{analysis.analyzed}</strong><span>verified conversations</span></article><article><strong>{analysis.analyzedByProvider}</strong><span>AI-enriched results</span></article></div>
    <div className={styles.filters}><label>Period<select value={range} onChange={event => setRange(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All loaded history</option></select></label><label>Conversation source<select value={channel} onChange={event => setChannel(event.target.value)}><option value="all">All sources</option><option value="web">Browser voice tests</option><option value="phone">Phone calls</option></select></label><span className={styles.pill}>Live post-call learning</span></div>
    <p className={styles.notice}>New calls use structured post-call analysis; older calls use conservative phrase evidence. Open the supporting transcript before changing the caller brain.</p>
    <div className={styles.reasonGrid}>{categories.map(category => <section className={styles.reasonCard} key={category}><header><h3>{category}</h3><p>Of {analysis.analyzed} verified conversations in this view</p></header>{analysis.signals.filter(signal => signal.category === category).length ? analysis.signals.filter(signal => signal.category === category).map(signal => <details key={signal.key}><summary><span>{signal.label}{signal.recurring && <em className={styles.repeat}>REPEATING</em>}</span><strong>{signal.evidence.length}</strong><small>{Math.round(signal.evidence.length / analysis.analyzed * 100)}%</small><ChevronRight size={14} /><span className={styles.reasonBar}><i style={{ width: `${signal.evidence.length / analysis.analyzed * 100}%` }} /></span></summary><div className={styles.quotes}>{signal.evidence.map(item => <blockquote key={item.sessionId}><small>{item.source === "structured" ? "AI-extracted signal" : "Matched phrase"}</small><p>“{item.quote}”</p><button onClick={() => inspect(item.sessionId)}>View transcript · {Math.floor(item.seconds)}s<ArrowUpRight size={13} /></button></blockquote>)}</div></details>) : <div className={styles.empty}><p>No matching signals in this view.</p></div>}</section>)}</div>
    <section className={styles.qualityReport}><header><div><span className={styles.kicker}>QUALITY REPORT</span><h3>Is the caller getting better?</h3></div><span className={styles.pill}>{quality.enriched} enriched calls</span></header><div>{quality.metrics.map(metric => <article key={metric.key}><span>{metric.label}</span><strong>{metric.value === null ? "—" : `${metric.value}${metric.unit}`}</strong><small>{metric.measured ? `${metric.measured} measured` : "Starts with the next enriched call"}</small></article>)}</div></section>
    <p className={styles.scope}>Each conversation counts once per theme; percentages may overlap. Only final, verified transcripts are analyzed. Filters cover loaded history ({sessions.length} sessions), not the entire provider account.</p>
  </div>;
}
export function CallerDialer({ store, initialLead, pipeline }: { store: LeadStore; initialLead: CallerLead | null; pipeline: PipelineStore }): ReactNode {
  const drafts = useRef(new Map<string, NoteDraft>());
  const [recordingPanel, setRecordingPanel] = useState(false);
  const [phone, setPhone] = useState(initialLead?.phone || ""), [leadId, setLeadId] = useState(initialLead?.id || "");
  const selected = store.leads.find(lead => lead.id === leadId);
  let number = ""; try { number = normalizePhone(phone); } catch { /* Invalid input keeps call action unavailable. */ }
  const excluded = store.demo || store.leads.some(lead => lead.phone === number && isBlocked(lead));
  return <div className={styles.stack}><header className={styles.sectionHead}><div><span className={styles.kicker}>A HUMAN TOUCH</span><h2>Your next hello.</h2><p>Keep the lead and the context together while you work your list.</p></div><span className={styles.pill}>Phone connection pending</span></header><LeadFeedback store={store} />{recordingPanel && <section className={ops.cloneCard}><h3>Call recording needs an in-app phone connection.</h3><p>A call in your device phone app cannot be captured here. You can record a microphone note instead; it will not include or be labeled as a verified two-way call recording.</p><CallerAudioRecorder /></section>}<div className={styles.dialerGrid}><section className={styles.dialer}><span className={styles.kicker}>MANUAL DIALER</span><label>Phone number<input type="tel" aria-label="Phone number" placeholder="+1 (555) 000-0000" value={phone} maxLength={40} onChange={event => { setPhone(event.target.value); setLeadId(""); }} /></label><div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9","*","0","#"].map((key,index) => <button key={key} onClick={() => { setPhone(value => (value + key).slice(0,40)); setLeadId(""); }}>{key}<small>{["","ABC","DEF","GHI","JKL","MNO","PQRS","TUV","WXYZ","","+",""][index]}</small></button>)}</div><button className={styles.secondary} onClick={() => { setPhone(value => value.slice(0,-1)); setLeadId(""); }}>Delete last digit</button><button className={styles.primary} disabled><Phone size={17} />Browser calling not connected</button><button className={styles.secondary} onClick={() => setRecordingPanel(value => !value)}>Record call</button>{excluded ? <p className={styles.error}>{store.demo ? "Demo numbers cannot be dialed." : "This lead is marked Do not call."}</p> : number && <a className={styles.externalCall} href={`tel:${number}`}>Open device phone app<ArrowUpRight size={15} /></a>}<small>The device link uses your external phone app. NBC cannot record or verify that call.</small></section><section className={styles.card}><h3>Put a name to the number.</h3><label>Select a lead<select aria-label="Select a lead" value={leadId} onChange={event => { const lead = store.leads.find(item => item.id === event.target.value); setLeadId(lead?.id || ""); setPhone(lead?.phone || ""); }}><option value="">Choose a lead</option>{store.leads.map(lead => <option key={lead.id} value={lead.id} disabled={isBlocked(lead)}>{lead.name}{isBlocked(lead) ? " · Do not call" : ""}</option>)}</select></label>{selected ? <CallerLeadDetail key={selected.id} lead={selected} store={store} pipeline={pipeline} drafts={drafts.current} /> : <div className={styles.empty}><Phone size={28} /><h3>Context makes the difference.</h3><p>Select a lead to review notes and save a manually reported outcome.</p></div>}<p className={styles.notice}>In-app calling and parallel AI outreach need a connected phone provider and an outbound workflow. Neither starts from this screen today.</p></section></div></div>;
}
