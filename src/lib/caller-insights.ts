import type { CallSession, CallSessionStatus } from "./caller-types.ts";

export const CALLER_HISTORY_LIMIT = 30;
export type SessionFilter = "all" | CallSessionStatus;

export function sessionInsights(sessions: readonly CallSession[]): {
  total: number; completed: number; failed: number; expired: number; pending: number;
  durationSeconds: number; missingDurations: number;
} {
  const recent = sessions.slice(0, CALLER_HISTORY_LIMIT);
  return {
    total: recent.length,
    completed: recent.filter(session => session.status === "completed").length,
    failed: recent.filter(session => session.status === "failed").length,
    expired: recent.filter(session => session.status === "expired").length,
    pending: recent.filter(session => !["completed", "failed", "expired"].includes(session.status)).length,
    durationSeconds: recent.reduce((total, session) => total + (session.duration_seconds ?? 0), 0),
    missingDurations: recent.filter(session => session.duration_seconds === null).length,
  };
}

export function filterSessions(sessions: readonly CallSession[], query: string, status: SessionFilter): CallSession[] {
  const term = query.trim().toLowerCase();
  return sessions.filter(session => {
    if (status !== "all" && session.status !== status) return false;
    if (!term) return true;
    return [session.id, session.summary ?? "", ...session.transcript.map(turn => turn.message)]
      .some(value => value.toLowerCase().includes(term));
  });
}

export function retainFinalResult(previous: CallSession | null, incoming: CallSession): CallSession {
  if (previous?.id !== incoming.id) return incoming;
  if (["completed", "failed"].includes(previous.status)) {
    const cost = incoming.cost_microusd ?? previous.cost_microusd, scope = incoming.cost_scope ?? previous.cost_scope;
    const analysis = incoming.post_call_analysis ?? previous.post_call_analysis;
    const review = incoming.analysis_review ?? previous.analysis_review;
    if (cost === previous.cost_microusd && scope === previous.cost_scope && analysis === previous.post_call_analysis && review === previous.analysis_review) return previous;
    const merged = { ...previous, cost_microusd: cost, cost_scope: scope };
    if (analysis !== undefined) merged.post_call_analysis = analysis;
    if (review !== undefined) merged.analysis_review = review;
    return merged;
  }
  const final = ["completed", "failed"].includes(incoming.status);
  if (previous.status === "expired" && !final) return previous;
  if (!final && previous.synced_at && (!incoming.synced_at || Date.parse(previous.synced_at) > Date.parse(incoming.synced_at))) return previous;
  const rank = { preparing: 0, ready: 1, active: 2, processing: 3, expired: 4, completed: 5, failed: 5 };
  const textLength = (session: CallSession): number => session.transcript.reduce((total, turn) => total + turn.message.length, 0);
  const merged: CallSession = {
    ...incoming,
    status: rank[previous.status] > rank[incoming.status] ? previous.status : incoming.status,
    transcript: incoming.transcript.length >= previous.transcript.length && textLength(incoming) >= textLength(previous) ? incoming.transcript : previous.transcript,
    summary: incoming.summary || previous.summary,
    started_at: incoming.started_at ?? previous.started_at,
    ended_at: incoming.ended_at ?? previous.ended_at,
    duration_seconds: incoming.duration_seconds ?? previous.duration_seconds,
  };
  const analysis = incoming.post_call_analysis ?? previous.post_call_analysis, review = incoming.analysis_review ?? previous.analysis_review;
  if (analysis !== undefined) merged.post_call_analysis = analysis;
  if (review !== undefined) merged.analysis_review = review;
  return merged;
}

export function mergeSessionHistory(previous: readonly CallSession[], incoming: readonly CallSession[], mode: "append" | "replace" | "update" = "append"): CallSession[] {
  const existing = new Map(previous.map(session => [session.id, session]));
  const rows = mode === "replace" ? new Map<string, CallSession>() : new Map(existing);
  for (const session of incoming) {
    if (mode === "update" && !existing.has(session.id)) continue;
    rows.set(session.id, retainFinalResult(existing.get(session.id) ?? null, session));
  }
  const dateKey = (value: string): string => {
    const [seconds, fraction = ""] = value.replace(/(?:Z|\+00:00)$/, "").split(".");
    return `${seconds}.${fraction.padEnd(6, "0")}`;
  };
  return [...rows.values()].sort((a, b) => dateKey(b.created_at).localeCompare(dateKey(a.created_at)) || b.id.localeCompare(a.id));
}

export function canExportSession(session: CallSession): boolean {
  return !session.is_demo && ["completed", "failed"].includes(session.status) && Boolean(session.synced_at) && session.transcript.length > 0;
}

export function formatCallTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function exportSessionTranscript(session: CallSession): { filename: string; text: string } {
  if (!canExportSession(session)) throw new Error("A finalized, provider-verified transcript is required before export.");
  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    filename: `nbc-caller-${safeId}.txt`,
    text: [
      "NBC Sales | Caller test transcript",
      `Session: ${session.id}`,
      `Created: ${session.created_at}`,
      `Channel: ${session.channel === "web" ? "Browser voice test" : "Phone call"}`,
      `Status: ${session.status}`,
      `Duration: ${session.duration_seconds === null ? "Not provided" : `${session.duration_seconds} seconds`}`,
      `Verified with voice provider: ${session.synced_at}`,
      "", "SUMMARY", session.summary ?? "No summary was returned.",
      "", "SAVED TRANSCRIPT",
      ...session.transcript.map(turn => `[${formatCallTime(turn.time_in_call_secs)}] ${turn.role === "agent" ? "NBC agent" : "You"}: ${turn.message}`),
      "",
    ].join("\n"),
  };
}
