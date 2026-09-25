"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AudioLines, Check, Plus, RefreshCw } from "lucide-react";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import { salesRequest } from "./CallerSalesPanels";
import type { ManagedVoice } from "@/services/caller-voices.service";
import styles from "./CallerSales.module.css";
import studio from "./CallerVoiceStudio.module.css";
import { CallerOwnVoice } from "./CallerOwnVoice";
import type { VoiceCapabilities } from "@/services/caller-voices.service";
interface VoicePage { voices: ManagedVoice[]; nextCursor: string | null; currentVoiceId: string | null }
export function CallerVoices({ active = true }: { active?: boolean }): ReactNode {
  const [cloneOpen, setCloneOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);
  const { token, user } = useWorkspaceAccess();
  const [voices, setVoices] = useState<ManagedVoice[]>([]), [cursor, setCursor] = useState<string | null>(null), [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(""), [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [accepted, setAccepted] = useState(false), [pendingId, setPendingId] = useState("");
  const lock = useRef(false), alive = useRef(true), generation = useRef(0);
  const key = `nbc.voice-request.${user?.id}`;
  useEffect(() => { alive.current = true; try { const saved = JSON.parse(sessionStorage.getItem(key) || "null"); if (saved?.id && saved?.name && saved?.description) { setPendingId(saved.id); setName(saved.name); setDescription(saved.description); setAccepted(true); setShowForm(true); } } catch { /* Storage is optional; server idempotency remains authoritative. */ } return () => { alive.current = false; generation.current++; }; }, [key]);
  async function refresh(next?: string): Promise<void> {
    const turn = ++generation.current;
    const [pageResult, capabilityResult] = await Promise.allSettled([salesRequest<VoicePage>(token, `/api/caller/voices${next ? `?cursor=${encodeURIComponent(next)}` : ""}`), next ? Promise.resolve(null) : salesRequest<VoiceCapabilities>(token, "/api/caller/voices/capabilities")]);
    if (!alive.current || turn !== generation.current) return;
    if (capabilityResult.status==='fulfilled'&&capabilityResult.value) setCapabilities(capabilityResult.value);else if(capabilityResult.status==='rejected')setCapabilities(null);
    if(pageResult.status==='rejected')throw pageResult.reason;const page=pageResult.value;
    setVoices(previous => next ? [...new Map([...previous,...page.voices].map(voice => [voice.id,voice])).values()] : page.voices); setCursor(page.nextCursor); setCurrent(page.currentVoiceId);if(capabilityResult.status==='rejected')throw capabilityResult.reason;
  }
  async function run(work: () => Promise<void>): Promise<void> {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { await work(); } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "The voice action could not finish."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => { if (token) void run(() => refresh()); }, [token]);
  function clearRequest(): void { setPendingId(""); setName(""); setDescription(""); setAccepted(false); try { sessionStorage.removeItem(key); } catch { /* Optional browser memory. */ } }
  async function create(): Promise<void> {
    const id = pendingId || crypto.randomUUID(); setPendingId(id);
    try { sessionStorage.setItem(key, JSON.stringify({ id, name, description })); } catch { /* The visible reference can still be reviewed. */ }
    const result = await salesRequest<{ voiceId: string }>(token, "/api/caller/voices", "POST", { requestId: id, name, description, acceptServiceUsage: accepted });
    if (!alive.current) return;
    clearRequest(); setShowForm(false); setSuccess(`Original voice saved. Choose Use for next tests to activate it.`);
    await refresh();
    if (!voices.some(voice => voice.id === result.voiceId)) setSuccess("Original voice saved. Refresh or load more voices to find it; the active agent voice has not changed.");
  }
  return <div className={`${styles.stack} ${studio.studio}`}><header className={styles.sectionHead}><div><span className={styles.kicker}>ADMIN VOICE STUDIO</span><h2>A voice that feels like NBC.</h2><p>Listen, choose, or design an original voice for your next conversations.</p></div><div className={styles.row}><button className={`${styles.primary} ${studio.cloneAction}`} onClick={() => setCloneOpen(value => !value)}>Clone a voice</button><button className={styles.secondary} disabled={busy} onClick={() => setShowForm(value => !value)}><Plus size={17} />Design a voice</button></div></header><p className={styles.notice}>Voice changes apply to future tests for everyone using the shared NBC agent. Saved previews can be played below. Creating an original voice uses your connected ElevenLabs plan; no NBC credit price has been assigned.</p>{error && <p className={styles.error} role="alert">{error}</p>}{success && <p className={styles.success} role="status"><Check size={16} />{success}</p>}
    {capabilities&&<section className={styles.card} aria-label="Connected voice account"><div className={styles.row}><h3>Connected plan: {capabilities.plan}</h3><button className={styles.secondary} disabled={busy} onClick={()=>void run(()=>refresh())}><RefreshCw size={15}/>Check connection</button></div><p>{capabilities.slotsRemaining===null||capabilities.slotsRemaining===undefined?'Voice slot availability not reported.':`${capabilities.slotsRemaining} custom voice slots available.`} Voice design: {capabilities.designAllowed?'available':'unavailable'}. Instant cloning: {capabilities.cloneAllowed?'available':'unavailable'}.</p>{capabilities.cloneReason&&<p className={styles.notice}>{capabilities.cloneReason}</p>}<p className={styles.scope}>This checks the ElevenLabs account connected to this deployment. NBC credits do not change its subscription. {capabilities.checkedAt?`Checked ${new Date(capabilities.checkedAt).toLocaleTimeString()}.`:''}</p></section>}
    {cloneOpen && <CallerOwnVoice recheck={()=>void run(()=>refresh())} checking={busy} reason={capabilities?.cloneReason} active={active} allowed={Boolean(capabilities?.cloneAllowed)} created={() => void run(() => refresh())} />}
    {showForm && <section className={styles.card}><h3>Give your voice a direction.</h3>{capabilities && !capabilities.designAllowed && <p className={styles.notice}>{capabilities.designReason||`Voice design is unavailable on the connected ${capabilities.plan} plan.`} No generation has been requested.</p>}<p>Describe an original voice: accent, energy, pace and character. This creates and saves the first generated option. It does not clone a person.</p><form className={styles.designForm} onSubmit={event => { event.preventDefault(); void run(create); }}><label>Voice name<input value={name} maxLength={80} required disabled={busy || Boolean(pendingId)} onChange={event => setName(event.target.value)} placeholder="NBC — Warm & confident" /></label><label>Original voice description<textarea rows={4} minLength={20} maxLength={1000} value={description} required disabled={busy || Boolean(pendingId)} onChange={event => setDescription(event.target.value)} placeholder="A warm, confident adult voice with a natural American accent, conversational pacing and a calm, approachable tone." /></label><label><span><input type="checkbox" checked={accepted} required disabled={busy || Boolean(pendingId)} onChange={event => setAccepted(event.target.checked)} /> I want to create this original voice using the connected service plan.</span></label><button className={styles.primary} disabled={(!capabilities?.designAllowed&&!pendingId) || busy || !accepted || !name.trim() || description.trim().length < 20}>{busy ? "Checking voice request…" : pendingId ? "Check this creation request" : "Create and save original voice"}<AudioLines size={16} /></button>{pendingId && <><p className={styles.scope}>Creation reference: {pendingId}. Checking this request does not generate another voice.</p><button type="button" className={styles.secondary} disabled={busy} onClick={clearRequest}>Start a separate creation request</button><small>Use a separate request only after reviewing the existing voice list and any uncertain request. It can incur additional service usage.</small></>}</form></section>}
    <section className={styles.card}><div className={styles.row}><h3>Available voices</h3><button className={styles.secondary} disabled={busy} onClick={() => void run(() => refresh())}><RefreshCw size={15} />Refresh voices</button></div>{busy && !voices.length ? <div className={styles.empty} role="status">Loading available voices…</div> : !voices.length ? <div className={styles.empty}><AudioLines size={28} /><h3>No voices loaded yet.</h3><p>Refresh the catalog once the voice service is connected.</p></div> : <div className={styles.voiceList}>{voices.map(voice => <article className={styles.voiceTile} data-selected={current === voice.id} key={voice.id}><AudioLines size={22} /><h3>{voice.name}</h3><p>{voice.description || "Listen to the preview to explore this voice."}</p>{voice.previewUrl ? <audio controls preload="none" src={voice.previewUrl} aria-label={`Preview ${voice.name}`} /> : <p className={styles.scope}>No saved preview available.</p>}<button className={current === voice.id ? styles.secondary : styles.primary} disabled={busy || current === voice.id || voice.needsVerification} onClick={() => void run(async () => { await salesRequest(token, "/api/caller/voices", "PATCH", { voiceId: voice.id }); if (alive.current) { setCurrent(voice.id); setSuccess(`${voice.name} will be used for the next voice tests.`); } })}>{voice.needsVerification ? "Owner verification required" : current === voice.id ? "Current agent voice" : "Use for next tests"}</button></article>)}</div>}{cursor && <button className={styles.secondary} disabled={busy} onClick={() => void run(() => refresh(cursor))}>Load more voices</button>}</section></div>;
}
