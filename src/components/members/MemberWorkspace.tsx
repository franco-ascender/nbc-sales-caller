"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import { Sparkles } from "lucide-react";
import type { MemberSection, MemberWorkspaceData } from "@/lib/member-types";
import { MemberPanels } from "./MemberPanels";
import styles from "./Members.module.css";

class WorkspaceRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function MemberWorkspace({ section = "journey" }: { section?: MemberSection }): ReactNode {
  const access = useWorkspaceAccess();
  const [token, setToken] = useState(access.token); const [data, setData] = useState<MemberWorkspaceData | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const epoch = useRef(0); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; }; }, []);
  useEffect(() => {
    if (!access.token) return;
    setToken(access.token);
    const turn = ++epoch.current; setBusy(true);
    void load(access.token).then(workspace => { if (mounted.current && turn === epoch.current) setData(workspace); }).catch(failure => { if (mounted.current && turn === epoch.current) setError(failure instanceof Error ? failure.message : "Try loading again."); }).finally(() => { if (mounted.current && turn === epoch.current) setBusy(false); });
  }, [access.token]);
  function clearSession(): void { epoch.current++; setData(null); setBusy(false); setSuccess(""); }
  function handleFailure(failure: unknown, turn: number): void {
    if (!mounted.current || turn !== epoch.current) return;
    if (failure instanceof WorkspaceRequestError && (failure.status === 401 || failure.status === 403)) clearSession();
    setError(failure instanceof Error ? failure.message : "Please try again.");
  }
  async function load(accessToken: string, memberId?: string, before?: string): Promise<MemberWorkspaceData> {
    const query = new URLSearchParams(); if (memberId) query.set("member", memberId); if (before) query.set("before", before);
    const response = await fetch(`/api/members?${query}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new WorkspaceRequestError(response.status, body.error || "Your workspace could not be loaded.");
    return body as MemberWorkspaceData;
  }
  async function refresh(memberId = data?.subject.id, before?: string): Promise<void> {
    const turn = ++epoch.current; setBusy(true); setError(""); setSuccess(""); if (memberId !== data?.subject.id) setData(null);
    try { const workspace = await load(token, memberId, before); if (mounted.current && turn === epoch.current) setData(workspace); }
    catch (failure) { handleFailure(failure, turn); }
    finally { if (mounted.current && turn === epoch.current) setBusy(false); }
  }
  async function save(payload: Record<string, unknown>): Promise<boolean> {
    const turn = epoch.current; setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/members", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!mounted.current || turn !== epoch.current) return false;
      if (!response.ok) throw new WorkspaceRequestError(response.status, body.error || "Your changes could not be saved.");
      const workspace = await load(token, data?.subject.id);
      if (!mounted.current || turn !== epoch.current) return false;
      setData(workspace); window.dispatchEvent(new Event("nbc-members-updated")); setSuccess("Saved to your workspace."); return true;
    } catch (failure) { handleFailure(failure, turn); return false; }
    finally { if (mounted.current && turn === epoch.current) setBusy(false); }
  }
  return <div className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>NBC WORKSPACE</p><h1>{section === "journey" ? (data?.onboarding?.completed_at ? "Your Roadmap" : "Start Here") : {calendar:"Calendar",chat:"Mentor Chat",tickets:"Support",credits:"NBC Credits"}[section]}</h1></div>{data && <button className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Refresh</button>}</div>
    <>
      {data && <>
      {data.member.role !== "student" && <details className={styles.staffReview}><summary>Review a member</summary><label className={styles.memberSelect}>Workspace to review<select disabled={busy} value={data.subject.id} onChange={event => void refresh(event.target.value)}><option value={data.member.id}>My workspace</option>{data.people.filter(person => person.id !== data.member.id).map(person => <option value={person.id} key={person.id}>{person.display_name} · {person.role}</option>)}</select><small>Coaches see their assigned students. Up to 100 active members.</small></label></details>}
      <MemberPanels key={data.subject.id} section={section} data={data} busy={busy} save={save} older={before => void refresh(data.subject.id, before)} /></>}
      {!data && busy && <div className={styles.card} role="status"><Sparkles size={24} /> Preparing your workspace…</div>}
      {!data && !busy && <button className={styles.secondary} onClick={() => void refresh()}>Try loading again</button>}
    </>
    {error && <p className={styles.error} role="alert">{error}</p>}{success && <p className={styles.success} role="status">{success}</p>}
  </div>;
}
