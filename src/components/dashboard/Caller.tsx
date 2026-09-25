"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Conversation } from "@elevenlabs/client";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import { BarChart3, Phone, Users, MessageSquareText, SlidersHorizontal, AudioLines, Check, Clock3, Download, Loader2, LockKeyhole, Mic, MicOff, PhoneOff, RefreshCw, Search, MapPinned } from "lucide-react";
import type { CallSession, ReconcilePage, SessionPage } from "@/lib/caller-types";
import { canExportSession, exportSessionTranscript, filterSessions, formatCallTime, mergeSessionHistory, retainFinalResult, sessionInsights } from "@/lib/caller-insights";
import type { SessionFilter } from "@/lib/caller-insights";
import styles from "./Caller.module.css";
import sales from "./CallerSales.module.css";
import { CallerReasons, CallerDialer, useCallerLeads } from "./CallerSalesPanels";
import { CallerVoices } from "./CallerVoices";
import { CallerCrm } from "./CallerCrm";
import { useCallerPipeline } from "./CallerPipeline";
import { CallerAnalytics } from './CallerAnalytics';
import { CallerVoicePresence } from './CallerVoicePresence';
import { CallerAiQueue } from './CallerAiQueue';
import { CallerCityCoverage } from "./CallerCityCoverage";
import { CallerScorecard } from "./CallerScorecard";
import { CallerPostCallAnalysis } from "./CallerPostCallAnalysis";
import { useCallerLists } from './CallerLists';
import { beginRecovery, finishRecovery } from '@/lib/caller-recovery';
import type { RecoveryLock } from '@/lib/caller-recovery';
import ops from './CallerOperations.module.css';
import type { CallerLead } from "@/lib/caller-crm";
import { CallerKnowledgeLab } from "./CallerKnowledgeLab";
import type { ConversationScenario } from "@/lib/caller-knowledge";

async function request<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(25000) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
  return data;
}

export function Caller(): ReactNode {
  const access = useWorkspaceAccess();
  const [demo, setDemo] = useState(false), [demoExists, setDemoExists] = useState(false), [demoAvailable, setDemoAvailable] = useState(false), [demoBusy, setDemoBusy] = useState(false), [demoError, setDemoError] = useState("");
  const demoLock = useRef(false), mode = useRef(false); mode.current = demo;
  const leads = useCallerLeads(demo);
  const lists = useCallerLists(access.token, demo);
  const pipeline = useCallerPipeline(access.token, demo);
  const [transfer, setTransfer] = useState({ids: [] as string[], version: 0}), [importRequest, setImportRequest] = useState(0), [testOpen, setTestOpen] = useState(true);
  const [tab, setTab] = useState("crm");
  const [dialLead, setDialLead] = useState<CallerLead | null>(null);
  const [studioOpened, setStudioOpened] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ConversationScenario | null>(null);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [recoveryCursor, setRecoveryCursor] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryFailures, setRecoveryFailures] = useState<string[]>([]);
  const [selected, setSelected] = useState<CallSession | null>(null);
  const [busy, setBusy] = useState("");
  const [active, setActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionFilter>("all");
  const [settling, setSettling] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<{ role: string; message: string }[]>([]);
  const token = useRef("");
  const client = useRef<Conversation | null>(null);
  const sessionId = useRef<string | null>(null);
  const starting = useRef(false);
  const actionLock = useRef(false);
  const ending = useRef(false);
  const recoveryState = useRef<RecoveryLock>({ busy: false, queued: null });
  const historyVersion = useRef(0);
  const syncRequests = useRef(new Map<string, Promise<CallSession>>());
  const selection = useRef<string | null>(null);
  const voiceRun = useRef(0);
  const mounted = useRef(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; voiceRun.current++; if (timeout.current) clearTimeout(timeout.current); void client.current?.endSession().catch(() => undefined); }; }, []);
  useEffect(() => { if (!active) return; const clock = setInterval(() => setElapsed(value => value + 1), 1000); return () => clearInterval(clock); }, [active]);

  function applyResults(incoming: CallSession[]): void {
    setSessions(previous => mergeSessionHistory(previous, incoming, "update"));
    const result = incoming.find(session => session.id === selection.current);
    if (result) setSelected(previous => selection.current === result.id ? retainFinalResult(previous, result) : previous);
  }

  async function refresh(cursor?: string): Promise<void> {
    const accessToken = token.current;
    const version = ++historyVersion.current;
    const requestedDemo = mode.current;
    const params = new URLSearchParams(); if (cursor) params.set("cursor", cursor); if (requestedDemo) params.set("demo", "true");
    const result = await request<SessionPage & { configured: boolean }>(accessToken, `/api/caller/sessions${params.size ? `?${params}` : ""}`);
    if (mounted.current && token.current === accessToken && version === historyVersion.current) {
      setSessions(previous => mergeSessionHistory(previous, result.sessions, cursor ? "append" : "replace"));
      setNextCursor(result.nextCursor ?? null); setConfigured(result.configured);
      const selectedResult = result.sessions.find(session => session.id === selection.current);
      if (selectedResult) setSelected(previous => selection.current === selectedResult.id ? retainFinalResult(previous, selectedResult) : previous);
    }
  }

  async function recover(cursor?: string): Promise<void> {
    if (mode.current || starting.current || client.current) return;
    if (beginRecovery(recoveryState.current, cursor) === "queued") return;
    const accessToken = token.current;
    setRecovering(true); setRecoveryMessage("Checking up to five saved sessions…"); setRecoveryFailures([]);
    try {
      const result = await request<ReconcilePage>(accessToken, "/api/caller/sessions/reconcile", cursor ? { cursor } : {});
      if (!mounted.current || token.current !== accessToken) return;
      applyResults(result.results.flatMap(item => item.session ? [item.session] : []));
      setRecoveryCursor(result.nextCursor);
      const count = (outcome: string): number => result.results.filter(item => item.outcome === outcome).length;
      setRecoveryMessage(result.results.length ? `Checked ${result.results.length}: ${count("completed")} completed, ${count("failed")} failed, ${count("pending")} still pending, ${count("expired")} expired, ${count("retry")} need a retry.` : "No pending sessions found in this part of your history.");
      setRecoveryFailures(result.results.filter(item => item.outcome === "retry").map(item => item.sessionId));
    } catch {
      if (mounted.current && token.current === accessToken) setRecoveryMessage("Recovery could not finish. Use Recover pending to retry, or sign in again if your access expired. Saved results remain available.");
    } finally {
      const queued = finishRecovery(recoveryState.current);
      if (mounted.current && token.current === accessToken) setRecovering(false);
      // A token refresh can arrive while the old request is still locked. Run the
      // newest recovery after that request releases the lock; its stale result is
      // still discarded by the token comparison above.
      if (queued && mounted.current) void recover(queued.cursor);
    }
  }

  async function sync(id: string, select = true): Promise<CallSession> {
    const accessToken = token.current;
    if (select) selection.current = id;
    const existing = syncRequests.current.get(id);
    if (existing) return existing;
    const pending = (async (): Promise<CallSession> => {
      const result = await request<{ session: CallSession }>(accessToken, `/api/caller/sessions/${id}/sync`, {});
      if (mounted.current && token.current === accessToken) applyResults([result.session]);
      return result.session;
    })();
    syncRequests.current.set(id, pending);
    try { return await pending; } finally { syncRequests.current.delete(id); }
  }

  async function disconnected(id: string, currentRun: number): Promise<void> {
    if (sessionId.current !== id || voiceRun.current !== currentRun) return;
    const accessToken = token.current;
    sessionId.current = null; client.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    if (!mounted.current) return;
    setActive(false); setSpeaking(false); setMuted(false); setBusy("");
    if (id) {
      setSettling(id);
      let saved = false;
      for (let attempt = 0; attempt < 12 && mounted.current && token.current === accessToken && voiceRun.current === currentRun; attempt++) {
        try {
          const result = await sync(id, attempt === 0 && !selection.current);
          if (["completed", "failed", "expired"].includes(result.status)) { saved = true; break; }
        } catch { /* The provider may not expose the result immediately after disconnect. */ }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (mounted.current && token.current === accessToken && voiceRun.current === currentRun) {
        setSettling(null);
        if (!saved) setError("The call ended. Its result may still be processing; use Refresh result in the history shortly.");
        void refresh().catch(() => { if (mounted.current && token.current === accessToken && voiceRun.current === currentRun) setError("Refresh the history to check whether your result was saved."); });
      }
    }
  }

  async function start(): Promise<void> {
    if (mode.current || starting.current || client.current || sessionId.current || recoveryState.current.busy || actionLock.current) return;
    starting.current = true; voiceRun.current++; selection.current = null;
    const currentRun = voiceRun.current;
    setBusy("start"); setError(""); setMessages([]); setSelected(null); setElapsed(0); setMuted(false); setSettling(null);
    let reserved = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Open this page on localhost or HTTPS to use your microphone.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      if (!mounted.current) return;
      const scenarioForThisTest = activeScenario;
      const authorization = await request<{ sessionId: string; signedUrl: string; conversationId: string; maxDurationSeconds: number; conversationOverride?: { prompt: string; firstMessage: string } }>(token.current, "/api/caller/sessions", { sessionId: crypto.randomUUID(), ...(scenarioForThisTest ? { scenario: scenarioForThisTest } : {}) });
      reserved = true; sessionId.current = authorization.sessionId;
      if (scenarioForThisTest) setActiveScenario(null);
      if (!mounted.current) return;
      const { Conversation: Voice } = await import("@elevenlabs/client");
      const conversation = await Voice.startSession({
        signedUrl: authorization.signedUrl, connectionType: "websocket",
        ...(authorization.conversationOverride ? { overrides: { agent: { prompt: { prompt: authorization.conversationOverride.prompt }, firstMessage: authorization.conversationOverride.firstMessage } } } : {}),
        onConnect: () => { if (mounted.current && voiceRun.current === currentRun) setActive(true); },
        onDisconnect: () => { void disconnected(authorization.sessionId, currentRun); },
        onModeChange: ({ mode }) => { if (mounted.current && voiceRun.current === currentRun) setSpeaking(mode === "speaking"); },
        onMessage: ({ role, message }) => { if (mounted.current && voiceRun.current === currentRun) setMessages(previous => [...previous.slice(-199), { role, message }]); },
        onError: () => { if (mounted.current && voiceRun.current === currentRun) setError("The voice connection reported an error. End the test and refresh its result; check the provider's agent settings and credits if it repeats."); },
      });
      if (!mounted.current) { await conversation.endSession(); return; }
      if (conversation.getId() !== authorization.conversationId) { await conversation.endSession(); throw new Error("The voice session did not match its saved authorization."); }
      if (!sessionId.current) { await conversation.endSession(); return; }
      client.current = conversation;
      setBusy("");
      timeout.current = setTimeout(() => { void conversation.endSession().catch(() => { if (mounted.current) setError("The browser could not close the connection. Try End voice test again; the agent also enforces its ten-minute limit."); }); }, authorization.maxDurationSeconds * 1000);
      void refresh().catch(() => { if (mounted.current) setError("The voice test is connected, but history could not refresh. You can still end the test normally."); });
    } catch (caught) {
      if (mounted.current) { setActive(false); setBusy(""); setError(caught instanceof DOMException && caught.name === "NotAllowedError" ? "Allow microphone access in your browser, then start again." : reserved ? "The voice connection could not start. Refresh the session result; an unused authorization expires after 10 minutes." : caught instanceof Error ? caught.message : "The test could not start."); }
      if (client.current) await client.current.endSession().catch(() => undefined);
      const failedSessionId = sessionId.current;
      client.current = null; sessionId.current = null;
      // A failed WebSocket handshake can reach the provider before the client
      // receives an onDisconnect callback. Reconcile it now so a retry is not
      // trapped behind a stale ready reservation.
      if (reserved && failedSessionId) void sync(failedSessionId, false).catch(() => undefined).finally(() => { void refresh().catch(() => undefined); });
      else if (reserved) void refresh().catch(() => undefined);
    } finally { starting.current = false; }
  }

  async function action(name: string, work: () => Promise<unknown>): Promise<void> {
    if (name === "end" ? ending.current : actionLock.current) return;
    if (name === "end") ending.current = true; else actionLock.current = true;
    const accessToken = token.current;
    setBusy(name); setError("");
    try { await work(); } catch (caught) { if (mounted.current && token.current === accessToken) setError(caught instanceof Error ? caught.message : "The action could not be completed."); }
    finally { if (name === "end") ending.current = false; else actionLock.current = false; if (mounted.current && token.current === accessToken) setBusy(current => current === name ? "" : current); }
  }

  function toggleMute(): void {
    if (!client.current) return;
    try { client.current.setMicMuted(!muted); setMuted(!muted); }
    catch { setError("The microphone control failed. Try it again, or end this test."); }
  }

  function downloadTranscript(): void {
    if (!selected) return;
    try {
      const exported = exportSessionTranscript(selected);
      const url = URL.createObjectURL(new Blob([exported.text], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = exported.filename; document.body.appendChild(anchor);
      anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("A finalized, verified transcript is needed to download this result."); }
  }

  useEffect(() => {
    if (!access.token) return;
    token.current = access.token;
    historyVersion.current++; selection.current = null; setSelected(null); setSessions([]); setNextCursor(null); setRecoveryCursor(null); setRecoveryMessage(""); setRecoveryFailures([]);
    void refresh().then(() => { if (!mode.current) return recover(); }).catch(() => { if (mounted.current) setError("Your history could not load. Refresh history to try again."); });
  }, [access.token, demo]);
  useEffect(() => { if (access.user?.role !== "admin" || !access.token) return; let cancelled = false; void request<{exists:boolean;available:boolean}>(access.token,"/api/caller/demo").then(result=>{if(!cancelled){setDemoExists(result.exists);setDemoAvailable(result.available);}}).catch(()=>{if(!cancelled)setDemoError("Demo controls could not load. Refresh Caller to retry.");}); return ()=>{cancelled=true;}; },[access.token,access.user?.role]);
  function changeMode(value:boolean):void { historyVersion.current++; mode.current=value; setDemo(value); setDialLead(null); setTransfer(previous=>({ids:[],version:previous.version+1})); setSelected(null); selection.current=null; }
  async function setMockData(enabled:boolean):Promise<void> { if(demoLock.current||active||recovering||Boolean(busy))return;demoLock.current=true;setDemoBusy(true);setDemoError("");try{await request(access.token,"/api/caller/demo",{enabled});setDemoExists(enabled);changeMode(enabled);if(demo===enabled)await Promise.all([leads.refresh(),lists.refresh(),refresh()]);}catch(failure){setDemoError(failure instanceof Error?failure.message:"Demo data could not be updated. Retry the same action.");}finally{demoLock.current=false;setDemoBusy(false);} }
  function inspectResult(result:CallSession):void {selection.current=result.id;setSelected(result);setTestOpen(true);chooseTab("voice");}

  useEffect(() => { if (!selected || !testOpen || tab !== "voice") return; const frame = requestAnimationFrame(() => document.getElementById("caller-conversation-result")?.scrollIntoView({ behavior: "instant", block: "start" })); return () => cancelAnimationFrame(frame); }, [selected?.id, testOpen, tab]);

  const insights = sessionInsights(sessions);
  const visibleSessions = filterSessions(sessions, query, statusFilter);

  const tabs = [{ id: "crm", label: "CRM", icon: Users }, { id: "analytics", label: "Analytics", icon: BarChart3 }, { id: "voice", label: "AI Caller", icon: AudioLines }, { id: "dialer", label: "Dialer", icon: Phone }, { id: "insights", label: "Insights", icon: MessageSquareText }, ...(access.user?.role === "admin" ? [{ id: "coverage", label: "Local coverage", icon: MapPinned }, { id: "voices", label: "Voices", icon: SlidersHorizontal }] : [])];
  function chooseTab(value: string): void { setTab(value); if (value === "voices") setStudioOpened(true); }
  return <div className={styles.workspace}>
    <header className={sales.workspaceHead}><div><h1>Caller</h1><p>Leads, conversations and follow-up.</p></div></header>
    {access.user?.role === "admin" && <div className={ops.demoBar}><div><strong>{demo ? "DEMO DATA" : "Live data"}</strong><small>{demo ? "Illustrative leads and conversations. No real calls or NBC results." : "Admin development tools · demo records are stored separately."}</small></div><div className={ops.actions}>{demoExists && <button className={ops.secondary} disabled={demoBusy||active||recovering||Boolean(busy)||leads.busy||lists.busy} onClick={()=>changeMode(!demo)}>{demo?"Show live data":"Show demo data"}</button>}<button className={ops.secondary} disabled={!demoAvailable||demoBusy||active||recovering||Boolean(busy)||leads.busy||lists.busy} onClick={()=>void setMockData(!demoExists)}>{demoBusy?"Updating demo data…":demoExists?"Remove mock data":"Add mock data"}</button></div>{demoError&&<p role="alert" className={ops.error}>{demoError}</p>}</div>}
    <div role="tablist" aria-label="Caller workspace" className={sales.tabs}>{tabs.map(({ id, label, icon: Icon }, index) => <button id={`caller-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`caller-panel-${id}`} tabIndex={tab === id ? 0 : -1} key={id} onClick={() => chooseTab(id)} onKeyDown={event => { let next = index; if (event.key === "ArrowRight") next = (index + 1) % tabs.length; else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length; else if (event.key === "Home") next = 0; else if (event.key === "End") next = tabs.length - 1; else return; event.preventDefault(); chooseTab(tabs[next].id); document.getElementById(`caller-tab-${tabs[next].id}`)?.focus(); }}><Icon size={17} />{label}</button>)}</div>
    {(active || busy === "start") && (tab !== "voice" || !testOpen) && <div className={sales.activeVoice} role="status"><AudioLines size={20} /><span>{active ? `Voice test active · ${formatCallTime(elapsed)}` : "Connecting voice test…"}</span><button onClick={() => {setTestOpen(true);chooseTab("voice");}}>Return to voice test</button><button disabled={!active || busy === "end"} onClick={() => void action("end", () => client.current?.endSession() ?? Promise.resolve())}>End voice test</button></div>}
    <section role="tabpanel" id="caller-panel-crm" aria-labelledby="caller-tab-crm" hidden={tab !== "crm"}><CallerCrm key={String(demo)} store={leads} lists={lists} pipeline={pipeline} importRequest={importRequest} send={ids=>{setTransfer(previous=>({ids,version:previous.version+1}));chooseTab("voice");}} dial={lead => { setDialLead(lead); chooseTab("dialer"); }} /></section>
    {tab === "analytics" && <section role="tabpanel" id="caller-panel-analytics" aria-labelledby="caller-tab-analytics"><CallerAnalytics leads={leads.leads} sessions={sessions} demo={demo} pipeline={pipeline.pipeline} /></section>}
    {tab === "dialer" && <section role="tabpanel" id="caller-panel-dialer" aria-labelledby="caller-tab-dialer"><CallerDialer key={dialLead?.id || "manual"} store={leads} pipeline={pipeline} initialLead={dialLead} /></section>}
    {tab === "insights" && <section role="tabpanel" id="caller-panel-insights" aria-labelledby="caller-tab-insights"><CallerReasons sessions={sessions} inspect={id => { const result = sessions.find(session => session.id === id); if (result) inspectResult(result); }} /></section>}
    {access.user?.role === "admin" && <section role="tabpanel" id="caller-panel-coverage" aria-labelledby="caller-tab-coverage" hidden={tab !== "coverage"}><CallerCityCoverage active={tab === "coverage"} token={access.token} /></section>}
    {studioOpened && access.user?.role === "admin" && <section role="tabpanel" id="caller-panel-voices" aria-labelledby="caller-tab-voices" hidden={tab !== "voices"}><CallerVoices active={tab === "voices"} /></section>}
    <section role="tabpanel" id="caller-panel-voice" aria-labelledby="caller-tab-voice" hidden={tab !== "voice"}>
    <div className={ops.toolsBar}><div><h3>Talk to your AI caller.</h3><p>Browser voice tests let you talk to the AI agent. They do not call a lead.</p></div><div className={ops.actions}><button className={ops.secondary} onClick={()=>setTestOpen(value=>!value)}>{testOpen?"Hide voice test":"Show voice test"}</button><button className={ops.secondary} onClick={()=>document.getElementById("caller-saved-history")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"})}>Conversation history</button></div></div>
    {access.user?.role === "admin" && !demo && <CallerKnowledgeLab token={access.token} activeScenario={activeScenario} disabled={active || Boolean(busy) || recovering} onUseScenario={setActiveScenario} />}
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div hidden={!testOpen}>
      <div className={styles.grid}>
        <section className={styles.voice}>
          <span className={styles.eyebrow}>NBC CALLER · INTERNAL TEST</span>
          <CallerVoicePresence client={client} active={active} speaking={speaking} muted={muted} connecting={busy === "start"}/>
          <h2>{active ? muted ? "Your microphone is muted." : speaking ? "Your agent is speaking." : "Your agent is listening." : "Your next conversation starts here."}</h2>
          <p>{activeScenario ? `Next test · ${activeScenario.title}` : "English · Current agent voice"}<br />10-minute limit · Browser microphone</p>
          <span className={styles.timer}><Clock3 size={14} />{formatCallTime(elapsed)}</span>
          {active ? <div className={styles.callControls}>
            <button className={styles.mute} aria-pressed={muted} disabled={busy === "start" || busy === "end"} onClick={toggleMute}>{muted ? <MicOff size={18} /> : <Mic size={18} />}{muted ? "Unmute microphone" : "Mute microphone"}</button>
            <button className={styles.end} disabled={busy === "end" || busy === "start"} onClick={() => void action("end", async () => { await client.current?.endSession(); })}><PhoneOff size={18} />End voice test</button>
          </div> : <button disabled={demo || !configured || Boolean(busy) || recovering} onClick={() => void start()}>{busy === "start" ? <Loader2 size={18} className={styles.spin} /> : <Mic size={18} />}Start voice test</button>}
          <small>{muted ? "You can still hear the agent. Unmute when you are ready to respond." : configured ? "A transcript and summary are saved. The agent announces the recording mode before your test." : "The private voice agent still needs to be configured."}</small>
        </section>
        <section className={styles.panel}><header><div><span className={styles.eyebrow}>DURING THE CALL</span><h2>Live conversation</h2></div><span className={styles.status}>{active ? "Connected" : "Standby"}</span></header><div className={styles.transcript} aria-live="polite">{messages.length ? messages.map((message, i) => <article key={i} className={message.role === "user" ? styles.userTurn : ""}><span>{message.role === "user" ? "You" : "NBC agent"}</span><p>{message.message}</p></article>) : <div className={styles.empty}><Mic size={27} /><h3>Your words will appear here.</h3><p>Start a test and speak naturally. Try describing your business, asking a question, or interrupting the agent.</p></div>}</div><footer>Live text is provisional. The saved result is verified with the voice provider.</footer></section>
      </div>
    </div>
    <CallerAiQueue key={String(demo)} store={leads} lists={lists} transfer={transfer} upload={()=>{setImportRequest(value=>value+1);chooseTab("crm");}} sessions={sessions} inspect={inspectResult}/>
      <div className={styles.metrics} aria-label="Recent call metrics">
        <article><span>Completed tests</span><strong>{insights.completed}</strong><small>Of {insights.total} recent sessions</small></article>
        <article><span>Conversation time</span><strong>{(insights.durationSeconds / 60).toFixed(1)}<em>min</em></strong><small>{insights.missingDurations ? `${insights.missingDurations} duration${insights.missingDurations === 1 ? "" : "s"} still unknown` : "Saved conversation time"}</small></article>
        <article><span>Failed tests</span><strong>{insights.failed}</strong><small>{insights.expired} expired reservation{insights.expired === 1 ? "" : "s"} tracked separately</small></article>
        <article><span>Awaiting result</span><strong>{insights.pending}</strong><small>Reserved, active or processing</small></article>
      </div>
      <p className={styles.scope}>Metrics cover the latest 30 loaded sessions at most, regardless of filters. Search and status filters cover all loaded history, not your entire account.</p>
      {settling && <div className={styles.processing} role="status"><Loader2 size={16} className={styles.spin} />The call ended. Checking the provider for its saved result…</div>}
      <section id="caller-saved-history" className={styles.panel}>
        <header><div><span className={styles.eyebrow}>PERSISTENT CALL HISTORY</span><h2>{demo ? "Demo conversation history" : "Your real test sessions"}</h2></div><button disabled={Boolean(busy)} onClick={() => void action("refresh", () => refresh())}><RefreshCw size={15} />Refresh history</button></header>
        <div className={styles.recovery}>
          <div className={styles.recoveryActions}>
            <button disabled={demo || recovering || active || Boolean(busy)} onClick={() => void recover()}>{recovering ? <Loader2 className={styles.spin} size={15} /> : <RefreshCw size={15} />}Recover pending</button>
            {recoveryCursor && <button disabled={demo || recovering || active || Boolean(busy)} onClick={() => void recover(recoveryCursor)}>Recover next batch</button>}
          </div>
          <p>Checks up to five saved sessions per action, including expired reservations. Recovery also runs once when you sign in; it does not run while you are away.</p>
          <p role="status" aria-live="polite">{recoveryMessage}</p>
          {recoveryFailures.length > 0 && <p>Retry needed for sessions: {recoveryFailures.join(", ")}. Use Refresh result on those rows, or Recover pending to check the newest batch again.</p>}
        </div>
        {sessions.length > 0 && <div className={styles.filters}>
          <label className={styles.search}><Search size={16} /><input type="search" aria-label="Search saved sessions" placeholder="Search transcript, summary or session ID" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label className={styles.filterLabel}>Status<select aria-label="Filter saved session status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as SessionFilter)}><option value="all">All statuses</option>{["preparing", "ready", "active", "processing", "completed", "failed", "expired"].map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label>
          <span>{visibleSessions.length} of {sessions.length} loaded sessions</span>
        </div>}
        {visibleSessions.length ? <div className={styles.history}>{visibleSessions.map(session => <article key={session.id} className={selected?.id === session.id ? styles.selectedSession : ""}>
          <div><strong>{session.scenario_title || new Date(session.created_at).toLocaleString("en-US")}</strong><span>{session.scenario_title ? `${new Date(session.created_at).toLocaleString("en-US")} · ${session.scenario_type?.replaceAll("_", " ") || "custom scenario"} · ` : ""}{session.channel === "web" ? "Browser voice test" : "Phone call"} · {session.duration_seconds === null ? "Duration pending" : formatCallTime(session.duration_seconds)} · {session.cost_microusd == null ? "Cost pending" : `$${(session.cost_microusd/1e6).toFixed(4)} provider cost`} · {session.id.slice(0, 8)}</span>{session.summary && <p>{session.summary}</p>}</div>
          <span className={styles.status} data-status={session.status}>{session.status}</span>
          <button aria-pressed={selected?.id === session.id} onClick={() => { selection.current = session.id; setSelected(previous => retainFinalResult(previous, session)); if (!["completed", "failed"].includes(session.status)) void action("sync", () => sync(session.id, false)); }}>{["completed", "failed"].includes(session.status) ? "View result" : "Refresh result"}</button>
        </article>)}</div> : <div className={styles.empty}><AudioLines size={27} /><h3>{sessions.length ? "No sessions match your search." : "No test conversations yet."}</h3><p>{sessions.length ? "Search covers loaded sessions. Load more to search older history." : "Your first session will appear here as soon as it is started."}</p>{sessions.length > 0 && <button className={styles.clearFilters} onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</button>}</div>}
        <footer className={styles.pagination}>
          <span>{sessions.length} sessions loaded. Refresh history returns to the newest page.</span>
          {nextCursor ? <button disabled={Boolean(busy)} onClick={() => void action("more", () => refresh(nextCursor))}>{busy === "more" ? "Loading more…" : "Load more"}</button> : <span>End of loaded history.</span>}
        </footer>
      </section>
      {selected && <section id="caller-conversation-result" className={styles.panel}>
        <header><div><span className={styles.eyebrow}>{selected.is_demo ? "DEMO RESULT · ILLUSTRATIVE" : "SAVED PROVIDER RESULT"}</span><h2>Conversation result</h2></div><div className={styles.resultActions}><span className={styles.status} data-status={selected.status}>{selected.status}</span><button disabled={!canExportSession(selected)} onClick={downloadTranscript}><Download size={15} />Download transcript</button></div></header>
        <div className={styles.result}>
          <p className={styles.sessionMeta}>Session {selected.id}<br />{selected.is_demo ? "Synthetic demo transcript. No real conversation took place." : selected.synced_at ? `Last verified: ${new Date(selected.synced_at).toLocaleString("en-US")}${selected.cost_microusd == null ? " · Cost pending" : ` · Provider-reported cost: $${(selected.cost_microusd/1e6).toFixed(4)}`}` : "This session has not returned a verified result yet."}</p>
          <h3>Summary</h3><p>{selected.summary || (["completed", "failed"].includes(selected.status) ? "No summary was returned for this conversation." : selected.status === "expired" ? "This reservation expired. Refresh the result to check whether a conversation was recorded by the provider." : "The result is not final yet. Refresh it again shortly.")}</p>
          {selected.failure_code && <p>Session status: {selected.failure_code.replaceAll("_", " ")}</p>}
          {!selected.is_demo && <CallerPostCallAnalysis token={access.token} session={selected} onSaved={session => { setSelected(session); setSessions(previous => previous.map(item => item.id === session.id ? session : item)); }} />}
          {!selected.is_demo && <CallerScorecard transcript={selected.transcript} />}
          <h3>Saved transcript</h3>{selected.transcript.length ? selected.transcript.map((turn, index) => <article key={index}><strong>{turn.role === "agent" ? "NBC agent" : "You"}<small>{formatCallTime(turn.time_in_call_secs)}</small></strong><p>{turn.message}</p></article>) : <p>No transcript is available yet.</p>}
        </div>
        <footer>{selected.is_demo ? "Demo transcripts are illustrative. Verified transcript export is reserved for real finalized sessions." : "Downloads contain the saved transcript and summary. Available when a verified result is final and has transcript text."}</footer>
      </section>}
    </section>
  </div>;
}
