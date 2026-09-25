export type CallSessionStatus = "preparing" | "ready" | "active" | "processing" | "completed" | "failed" | "expired";
export interface TranscriptTurn { role: "agent" | "user"; message: string; time_in_call_secs: number }
export type AnalysisValue = string | number | boolean | null;
export interface CallEvaluation {
  result: "success" | "failure" | "unknown";
  rationale: string;
  score: number | null;
  maxScore: number | null;
}
export interface PostCallAnalysis {
  version: "nbc-analysis-v1";
  data: Record<string, AnalysisValue>;
  evaluations: Record<string, CallEvaluation>;
  sentiment: {
    label: "positive" | "neutral" | "negative" | "mixed" | "unknown";
    score: number | null;
    frustration: number | null;
  } | null;
}
export interface PostCallReview {
  primary_objection: string;
  customer_issue_category: string;
  next_step: string;
  note: string;
  reviewed_at: string;
}
export interface CallSession {
  id: string;
  is_demo?: boolean;
  lead_id?: string | null;
  provider: "elevenlabs" | "retell";
  provider_call_id: string | null;
  channel: "web" | "phone";
  status: CallSessionStatus;
  scenario_title?: string | null;
  scenario_type?: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  cost_microusd?: number | null;
  cost_scope?: "unknown" | "llm_only" | "total";
  transcript: TranscriptTurn[];
  summary: string | null;
  post_call_analysis?: PostCallAnalysis | null;
  analysis_review?: PostCallReview | null;
  failure_code: string | null;
  synced_at: string | null;
}

export interface SessionPage { sessions: CallSession[]; nextCursor: string | null }
export interface ReconcileResult {
  sessionId: string;
  outcome: "completed" | "failed" | "expired" | "pending" | "retry";
  session?: CallSession;
  error?: string;
}
export interface ReconcilePage { results: ReconcileResult[]; nextCursor: string | null }
