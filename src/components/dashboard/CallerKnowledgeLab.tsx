"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, FileAudio, FileText, FlaskConical, Loader2, Plus, RotateCw, ShieldCheck, Sparkles, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { ConversationScenario } from "@/lib/caller-knowledge";
import { defaultPhoneScenario } from "@/lib/caller-default-scenario";
import { consolidateScenario, briefCharacterCount, briefLimits, BRIEF_CHARACTER_LIMIT } from "@/lib/caller-brief";
import { parseCallerContext } from "@/lib/caller-context";
import { CallerContextEditor } from "./CallerContextEditor";
import { audioFileType } from "@/lib/caller-audio";
import styles from "./CallerKnowledgeLab.module.css";

interface KnowledgeSource {
  id: string;
  title: string;
  kind: "call_audio" | "transcript" | "playbook";
  status: string;
  context: string;
  fileName: string | null;
  sizeBytes: number | null;
  hasTranscript: boolean;
  createdAt: string;
}

interface SavedScenario {
  id: string;
  title: string;
  conversationType: ConversationScenario["conversationType"];
  brief: ConversationScenario;
  createdAt: string;
}

interface Props {
  token: string;
  activeScenario: ConversationScenario | null;
  disabled: boolean;
  onUseScenario: (scenario: ConversationScenario | null) => void;
}

const initialScenario: ConversationScenario = consolidateScenario(defaultPhoneScenario);

async function api<T>(token: string, path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

const formatBytes = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
};

const kindLabel = (kind: KnowledgeSource["kind"]): string => kind === "call_audio" ? "Call audio" : kind === "playbook" ? "Playbook" : "Transcript";

export function CallerKnowledgeLab({ token, activeScenario, disabled, onUseScenario }: Props): ReactNode {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"scenario" | "knowledge">("scenario");
  const [scenario, setScenario] = useState<ConversationScenario>(initialScenario);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sourceMode, setSourceMode] = useState<"transcript" | "playbook" | "call_audio">("transcript");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    setBusy("load"); setError("");
    try {
      const [knowledge, saved] = await Promise.all([
        api<{ configured: boolean; sources: KnowledgeSource[] }>(token, "/api/caller/knowledge"),
        api<{ configured: boolean; scenarios: SavedScenario[] }>(token, "/api/caller/scenarios"),
      ]);
      setConfigured(knowledge.configured && saved.configured);
      setSources(knowledge.sources);
      setScenarios(saved.scenarios);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The Lab could not load."); }
    finally { setBusy(""); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const contextError = useMemo(() => { try { if (scenario.context) parseCallerContext(scenario.context); for (const [key, limit] of Object.entries(briefLimits)) if (scenario[key as keyof typeof briefLimits].length > limit) return `${key} exceeds its character limit. Review the combined saved content.`; if (briefCharacterCount(scenario) > BRIEF_CHARACTER_LIMIT) return "Keep the brief under 22,000 characters."; return ""; } catch (error) { return error instanceof Error ? error.message : "Check the caller context."; } }, [scenario]);
  const scenarioReady = [scenario.title, scenario.agentRole, scenario.objective, scenario.prospectProfile, scenario.offer].every(value => value.trim()) && !contextError;
  const update = <K extends keyof ConversationScenario>(key: K, value: ConversationScenario[K]): void => setScenario(previous => ({ ...previous, [key]: value }));

  async function saveScenario(): Promise<void> {
    if (disabled || busy || !scenarioReady) return;
    setBusy("scenario"); setError(""); setMessage("");
    try {
      const result = await api<{ scenario: SavedScenario }>(token, "/api/caller/scenarios", { requestId: crypto.randomUUID(), scenario });
      setScenarios(previous => [result.scenario, ...previous]);
      setMessage("New version saved. Select it under Make a Call, or use this brief for your next browser test.");
      window.dispatchEvent(new Event("nbc:scenarios-updated"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The scenario could not be saved."); }
    finally { setBusy(""); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !sourceTitle) setSourceTitle(selected.name.replace(/\.[^.]+$/, ""));
  }

  async function addKnowledge(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (disabled || busy || !authorized) return;
    setBusy("knowledge"); setError(""); setMessage("");
    try {
      const requestId = crypto.randomUUID();
      if (sourceMode === "call_audio") {
        if (!file) throw new Error("Choose an authorized call recording first.");
        if (file.size < 1024 || file.size > 250 * 1024 * 1024) throw new Error("Audio must be between 1 KB and 250 MB.");
        const detected = audioFileType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
        if (!detected) throw new Error("The selected file does not contain a supported audio format.");
        const mimeType = file.type || ({ mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg" }[file.name.split(".").pop()?.toLowerCase() || ""] ?? "");
        const matching = (detected === "mp3" && mimeType === "audio/mpeg") || (detected === "mp4" && mimeType === "audio/mp4") || (detected === "wav" && ["audio/wav", "audio/x-wav"].includes(mimeType)) || (detected === "webm" && ["audio/webm", "video/webm"].includes(mimeType)) || (detected === "ogg" && mimeType === "audio/ogg");
        if (!matching) throw new Error("The selected file contents do not match its audio type.");
        const reserved = await api<{ source: KnowledgeSource; signedUrl: string }>(token, "/api/caller/knowledge", { mode: "audio", requestId, title: sourceTitle, context: sourceContext, fileName: file.name, mimeType, sizeBytes: file.size, authorizationConfirmed: true });
        const form = new FormData(); form.append("cacheControl", "0"); form.append("", file);
        const uploaded = await fetch(reserved.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form, signal: AbortSignal.timeout(180_000) });
        if (!uploaded.ok) throw new Error("The private audio upload did not finish. Retry this source.");
        const finalized = await api<{ source: KnowledgeSource }>(token, `/api/caller/knowledge/${requestId}/finalize`, {});
        setSources(previous => [finalized.source, ...previous.filter(item => item.id !== requestId)]);
        setMessage("Recording stored privately. It will not affect the agent until its transcript is reviewed and approved.");
      } else {
        const result = await api<{ source: KnowledgeSource }>(token, "/api/caller/knowledge", { mode: "text", requestId, title: sourceTitle, context: sourceContext, kind: sourceMode, content: sourceContent, authorizationConfirmed: true });
        setSources(previous => [result.source, ...previous]);
        setMessage("Source saved for review. The live agent has not been changed.");
      }
      setSourceTitle(""); setSourceContext(""); setSourceContent(""); setFile(null); setAuthorized(false);
      if (fileInput.current) fileInput.current.value = "";
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The source could not be saved."); }
    finally { setBusy(""); }
  }

  async function syncSource(source: KnowledgeSource): Promise<void> {
    if (disabled || busy) return;
    setBusy(`sync:${source.id}`); setError(""); setMessage("");
    try {
      const result = await api<{ source: KnowledgeSource }>(token, `/api/caller/knowledge/${source.id}/sync`, {});
      setSources(previous => previous.map(item => item.id === source.id ? result.source : item));
      setMessage(result.source.status === "synced" ? "Approved knowledge is now available to the browser caller." : "The source state was refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be synced.");
      void load();
    } finally { setBusy(""); }
  }

  return <section className={styles.lab} aria-labelledby="caller-lab-title">
    <button className={styles.header} type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className={styles.icon}><FlaskConical size={19} /></span>
      <span><strong id="caller-lab-title">Conversation Lab</strong><small>Shape a role-play or organize approved sales knowledge before a voice test.</small></span>
      {activeScenario && <span className={styles.active}><Sparkles size={13} />{activeScenario.title}</span>}
      <ChevronDown size={18} className={open ? styles.chevronOpen : ""} />
    </button>
    {open && <div className={styles.body}>
      <div className={styles.tabs} role="tablist" aria-label="Conversation Lab sections">
        <button type="button" role="tab" aria-selected={view === "scenario"} onClick={() => setView("scenario")}><Sparkles size={15} />Scenario builder</button>
        <button type="button" role="tab" aria-selected={view === "knowledge"} onClick={() => setView("knowledge")}><BookOpen size={15} />Knowledge library <span>{sources.length}</span></button>
        <button type="button" className={styles.refresh} onClick={() => void load()} disabled={Boolean(busy)} aria-label="Refresh Conversation Lab"><RotateCw size={15} /></button>
      </div>
      {!configured && <div className={styles.notice}>The Lab database is prepared in this release and still needs its coordinated database migration before sources can be saved.</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {message && <div className={styles.success} role="status"><Check size={15} />{message}</div>}

      {view === "scenario" ? <div className={styles.scenarioGrid}>
        <div className={styles.formCard}>
          <div className={styles.cardIntro}><span>BUILD THE BRIEF</span><h3>Give your caller the context to respond well.</h3><p>Start with the offer, then add the facts and answers your caller should know. Save a version to select in Make a Call. Editing never changes an ongoing call.</p></div>
          <div className={styles.formGrid}><label className={styles.wide}>Scenario name<input disabled={disabled || Boolean(busy)} value={scenario.title} maxLength={100} onChange={event => update("title", event.target.value)} /></label></div>
          <CallerContextEditor value={scenario} onChange={setScenario} disabled={disabled || Boolean(busy)} />
          {contextError && <p className={styles.error} role="alert">{contextError}</p>}
          <p className={styles.contextHint}>{activeScenario ? (JSON.stringify(activeScenario) === JSON.stringify(scenario) ? "This brief is selected for your next browser test." : "Draft changes are not selected for your browser test yet.") : "Browser tests are using the standard caller until you select this brief."}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={disabled || Boolean(busy) || !scenarioReady || !configured} onClick={() => void saveScenario()}>{busy === "scenario" ? <Loader2 size={15} className={styles.spin} /> : <Plus size={15} />}Save new version</button>
            <button type="button" className={styles.primary} disabled={disabled || !scenarioReady} onClick={() => onUseScenario(scenario)}><Sparkles size={15} />Use for browser test</button>
            {activeScenario && <button type="button" className={styles.clear} disabled={disabled} onClick={() => onUseScenario(null)}>Use standard caller</button>}
          </div>
        </div>
        <aside className={styles.savedCard}><span>SAVED SCENARIOS</span><h3>Your saved versions.</h3>{scenarios.length ? <div className={styles.savedList}>{scenarios.map(saved => <button type="button" key={saved.id} onClick={() => { setScenario(consolidateScenario(saved.brief)); setMessage("Saved version opened for editing. Select it for your browser test when ready."); }} disabled={disabled}><strong>{saved.title}</strong><small>{saved.conversationType.replaceAll("_", " ")} · {new Date(saved.createdAt).toLocaleString("en-US")}</small></button>)}</div> : <div className={styles.empty}><FlaskConical size={22} /><p>Saved versions appear here and in Make a Call.</p></div>}</aside>
      </div> : <div className={styles.knowledgeGrid}>
        <form className={styles.formCard} onSubmit={addKnowledge}>
          <div className={styles.cardIntro}><span>PRIVATE SOURCE INTAKE</span><h3>Add calls and proven sales material.</h3><p>Uploads enter a review queue. Nothing is added to the live caller automatically.</p></div>
          <div className={styles.sourceKinds} role="radiogroup" aria-label="Knowledge source type">
            <button type="button" role="radio" aria-checked={sourceMode === "transcript"} onClick={() => setSourceMode("transcript")}><FileText size={17} />Transcript</button>
            <button type="button" role="radio" aria-checked={sourceMode === "playbook"} onClick={() => setSourceMode("playbook")}><BookOpen size={17} />Playbook</button>
            <button type="button" role="radio" aria-checked={sourceMode === "call_audio"} onClick={() => setSourceMode("call_audio")}><FileAudio size={17} />Call audio</button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.wide}>Source name<input required value={sourceTitle} maxLength={140} onChange={event => setSourceTitle(event.target.value)} placeholder="Anas discovery call — regional bank" /></label>
            <label className={styles.wide}>Context and speakers<textarea rows={2} value={sourceContext} maxLength={1000} onChange={event => setSourceContext(event.target.value)} placeholder="Who is speaking, call stage, outcome, and what this source demonstrates." /></label>
            {sourceMode === "call_audio" ? <label className={`${styles.wide} ${styles.filePicker}`}><Upload size={18} /><span>{file ? file.name : "Choose MP3, M4A, MP4, WAV, WebM or OGG"}<small>{file ? formatBytes(file.size) : "Up to 250 MB · stored privately"}</small></span><input ref={fileInput} required type="file" accept=".mp3,.m4a,.mp4,.wav,.webm,.ogg,audio/*" onChange={chooseFile} /></label> : <label className={styles.wide}>Reviewed source text<textarea required rows={9} minLength={100} maxLength={120000} value={sourceContent} onChange={event => setSourceContent(event.target.value)} placeholder="Paste the reviewed transcript or playbook here…" /></label>}
          </div>
          <label className={styles.consent}><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} /><ShieldCheck size={18} /><span>I confirm NBC is authorized to store and use this material internally for caller training and reference.</span></label>
          <div className={styles.actions}><button className={styles.primary} disabled={disabled || Boolean(busy) || !configured || !authorized || !sourceTitle.trim() || (sourceMode === "call_audio" ? !file : sourceContent.trim().length < 100)}>{busy === "knowledge" ? <Loader2 size={15} className={styles.spin} /> : <Plus size={15} />}Add to review queue</button></div>
        </form>
        <aside className={styles.savedCard}><span>REVIEW QUEUE</span><h3>Every source stays traceable.</h3>{sources.length ? <div className={styles.sourceList}>{sources.map(source => <article key={source.id}><div className={styles.sourceIcon}>{source.kind === "call_audio" ? <FileAudio size={16} /> : <FileText size={16} />}</div><div><strong>{source.title}</strong><small>{kindLabel(source.kind)}{source.sizeBytes ? ` · ${formatBytes(source.sizeBytes)}` : ""}</small></div><span data-status={source.status}>{source.status.replaceAll("_", " ")}</span>{source.kind !== "call_audio" && ["review", "approved", "failed", "sync_unknown"].includes(source.status) && <button type="button" className={styles.syncButton} disabled={disabled || Boolean(busy)} onClick={() => void syncSource(source)}>{busy === `sync:${source.id}` ? <Loader2 size={13} className={styles.spin} /> : <ShieldCheck size={13} />}{source.status === "sync_unknown" ? "Reconcile" : "Approve & sync"}</button>}</article>)}</div> : <div className={styles.empty}><BookOpen size={22} /><p>Authorized source material will appear here after intake.</p></div>}</aside>
      </div>}
    </div>}
  </section>;
}
