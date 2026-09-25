import type { AnalysisValue, CallEvaluation, CallSessionStatus, PostCallAnalysis, TranscriptTurn } from "./caller-types.ts";
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const collectedIds = new Set(["call_intent", "primary_objection", "objection_detail", "buyer_stage", "next_step", "human_follow_up_needed", "customer_issue_category"]);
const evaluationIds = new Set(["discovery_quality", "objection_handling", "next_step_quality", "trust_and_customer_care"]);
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
function analysisValue(value: unknown): AnalysisValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value.slice(0, 1000);
}
function normalizeAnalysis(value: unknown): PostCallAnalysis | null {
  if (!record(value)) return null;
  const dataSource = record(value.data_collection_results) ? value.data_collection_results : {};
  const evaluationSource = record(value.evaluation_criteria_results) ? value.evaluation_criteria_results : {};
  const data: Record<string, AnalysisValue> = {};
  for (const [id, raw] of Object.entries(dataSource)) {
    if (!collectedIds.has(id)) continue;
    const item = record(raw) ? raw : null;
    const normalized = analysisValue(item && "value" in item ? item.value : raw);
    if (normalized !== undefined) data[id] = normalized;
  }
  const evaluations: Record<string, CallEvaluation> = {};
  for (const [id, raw] of Object.entries(evaluationSource)) {
    if (!evaluationIds.has(id) || !record(raw) || !["success", "failure", "unknown"].includes(String(raw.result))) continue;
    evaluations[id] = { result: raw.result as CallEvaluation["result"], rationale: typeof raw.rationale === "string" ? raw.rationale.slice(0, 2000) : "", score: finite(raw.score), maxScore: finite(raw.max_score) };
  }
  const source = record(value.sentiment_analysis) ? value.sentiment_analysis : null;
  const rawLabel = source?.overall_label;
  const label: "positive" | "neutral" | "negative" | "mixed" | "unknown" = ["positive", "neutral", "negative", "mixed"].includes(String(rawLabel)) ? rawLabel as "positive" | "neutral" | "negative" | "mixed" : "unknown";
  const sentiment = source ? { label, score: finite(source.overall_sentiment_score), frustration: finite(source.overall_frustration_score) } : null;
  return Object.keys(data).length || Object.keys(evaluations).length || sentiment ? { version: "nbc-analysis-v1", data, evaluations, sentiment } : null;
}
export const validSessionId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const reviewValues = {
  primary_objection: new Set(["none", "budget_or_price", "timing_or_priority", "authority_or_decision_process", "trust_or_past_bad_experience", "value_or_roi", "fit_or_need", "internal_capacity", "competition_or_existing_solution", "risk_or_compliance", "other", "unknown"]),
  customer_issue_category: new Set(["none", "billing", "access_or_account", "product_or_service", "complaint", "appointment_change", "other", "unknown"]),
  next_step: new Set(["booked_or_agreed", "follow_up_requested", "information_requested", "no_next_step", "do_not_contact", "unknown"]),
};
export function parseAnalysisReview(value: unknown): { primary_objection: string; customer_issue_category: string; next_step: string; note: string } {
  if (!record(value)) throw new Error("Invalid analysis review");
  const keys = Object.keys(value); if (keys.some(key => !["primary_objection", "customer_issue_category", "next_step", "note"].includes(key))) throw new Error("Invalid analysis review");
  const primary = value.primary_objection, issue = value.customer_issue_category, next = value.next_step, note = value.note;
  if (typeof primary !== "string" || !reviewValues.primary_objection.has(primary) || typeof issue !== "string" || !reviewValues.customer_issue_category.has(issue) || typeof next !== "string" || !reviewValues.next_step.has(next) || typeof note !== "string" || note.trim().length > 500) throw new Error("Invalid analysis review");
  return { primary_objection: primary, customer_issue_category: issue, next_step: next, note: note.trim() };
}

export function parseSignedSession(value: unknown): { signedUrl: string; conversationId: string } {
  if (!record(value) || typeof value.signed_url !== "string") throw new Error("Invalid session authorization");
  const url = new URL(value.signed_url);
  const conversationId = url.searchParams.get("conversation_id");
  if (url.protocol !== "wss:" || url.hostname !== "api.elevenlabs.io" || url.pathname !== "/v1/convai/conversation" || !conversationId || !/^[A-Za-z0-9_-]{8,100}$/.test(conversationId)) throw new Error("Invalid session authorization");
  return { signedUrl: value.signed_url, conversationId };
}

export function normalizeConversation(value: unknown, expected: { agentId: string; conversationId: string }): { status: CallSessionStatus; started_at: string | null; ended_at: string | null; duration_seconds: number | null; transcript: TranscriptTurn[]; summary: string | null; post_call_analysis: PostCallAnalysis | null; failure_code: string | null } {
  if (!record(value) || value.agent_id !== expected.agentId || value.conversation_id !== expected.conversationId) throw new Error("Conversation identity mismatch");
  const statusMap: Record<string, CallSessionStatus> = { initiated: "ready", "in-progress": "active", processing: "processing", done: "completed", failed: "failed" };
  const status = typeof value.status === "string" ? statusMap[value.status] : undefined;
  if (!status) throw new Error("Unsupported conversation status");
  const metadata = record(value.metadata) ? value.metadata : {};
  const duration = typeof metadata.call_duration_secs === "number" && Number.isFinite(metadata.call_duration_secs) && metadata.call_duration_secs >= 0 && metadata.call_duration_secs <= 86_400 ? Math.round(metadata.call_duration_secs) : null;
  const start = typeof metadata.start_time_unix_secs === "number" && Number.isFinite(metadata.start_time_unix_secs) && metadata.start_time_unix_secs > 0 && metadata.start_time_unix_secs < 100000000000 ? metadata.start_time_unix_secs * 1000 : null;
  const transcript: TranscriptTurn[] = [];
  if (Array.isArray(value.transcript)) for (const turn of value.transcript.slice(0, 300)) {
    if (!record(turn) || !["agent", "user"].includes(String(turn.role)) || typeof turn.message !== "string") continue;
    transcript.push({ role: turn.role as "agent" | "user", message: turn.message.slice(0, 6000), time_in_call_secs: typeof turn.time_in_call_secs === "number" && Number.isFinite(turn.time_in_call_secs) ? Math.max(0, Math.min(86_400, turn.time_in_call_secs)) : 0 });
  }
  const analysis = record(value.analysis) ? value.analysis : {};
  return { status, started_at: start ? new Date(start).toISOString() : null, ended_at: start && duration !== null && ["completed", "failed"].includes(status) ? new Date(start + duration * 1000).toISOString() : null, duration_seconds: duration, transcript, summary: typeof analysis.transcript_summary === "string" ? analysis.transcript_summary.slice(0, 12000) : null, post_call_analysis: normalizeAnalysis(analysis), failure_code: status === "failed" ? "provider_failed" : null };
}
