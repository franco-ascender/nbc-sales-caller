import type { CallSession } from "./caller-types.ts";

export interface ReasonEvidence { sessionId: string; quote: string; seconds: number; createdAt: string; source: "structured" | "phrase" }
export interface ReasonSignal { key: string; label: string; category: "Objections" | "Customer care" | "Next steps"; evidence: ReasonEvidence[]; recurring: boolean }
export interface QualityMetric { key: string; label: string; value: number | null; unit: "%" | "/100"; measured: number }

type Rule = { key: string; label: string; category: ReasonSignal["category"]; pattern: RegExp; exclude?: RegExp };
const rules: Rule[] = [
  { key: "budget_or_price", label: "Budget or price", category: "Objections", pattern: /too expensive|can'?t afford|cannot afford|out of (?:my|our|the) budget|don'?t have (?:the )?(?:budget|money)|price is (?:too )?high|costs? too much|can'?t justify (?:the )?(?:price|cost)/i },
  { key: "timing_or_priority", label: "Timing or priority", category: "Objections", pattern: /bad time|not (?:right )?now|maybe (?:next|later)|too busy|not a priority|circle back (?:next|later)/i },
  { key: "authority_or_decision_process", label: "Decision process", category: "Objections", pattern: /(?:talk|speak|check|discuss|consult|run it by).{0,45}(?:partner|spouse|boss|manager|team|board|owner|wife|husband)/i },
  { key: "trust_or_past_bad_experience", label: "Trust or past experience", category: "Objections", pattern: /don'?t trust|hard to trust|skeptical|been burned|bad experience|previous agency|last agency|tried (?:an agency|this) before/i },
  { key: "value_or_roi", label: "Value or ROI", category: "Objections", pattern: /don'?t see (?:the )?value|not worth|return on investment|roi|how (?:would|will) (?:this|that) pay|prove (?:the )?(?:value|results)/i },
  { key: "internal_capacity", label: "Internal capacity", category: "Objections", pattern: /don'?t have (?:the )?(?:time|team|staff|capacity)|too much to implement|can'?t implement|cannot implement|overwhelmed/i },
  { key: "competition_or_existing_solution", label: "Existing solution", category: "Objections", pattern: /already (?:have|use|work with)|current (?:agency|provider|vendor|team)|doing it in[- ]house|under contract/i },
  { key: "risk_or_compliance", label: "Risk or compliance", category: "Objections", pattern: /compliance|legal (?:won'?t|will not)|security concern|privacy concern|too risky|regulatory/i },
  { key: "fit_or_need", label: "Fit or need", category: "Objections", pattern: /not (?:a good )?fit|not interested|don'?t need (?:it|this|that)|happy with what we have/i },
  { key: "billing", label: "Billing or charge", category: "Customer care", pattern: /billing issue|charged (?:me|us)|wrong charge|invoice (?:is|was)|refund|payment (?:failed|issue)/i },
  { key: "access_or_account", label: "Access or account", category: "Customer care", pattern: /can'?t (?:log in|login|access)|locked out|account (?:issue|problem)|password (?:issue|reset)/i },
  { key: "product_or_service", label: "Service problem", category: "Customer care", pattern: /not working|stopped working|service (?:issue|problem)|technical (?:issue|problem)|bug|broken/i },
  { key: "complaint", label: "Complaint or escalation", category: "Customer care", pattern: /unhappy|frustrated|disappointed|complaint|speak to (?:a )?(?:manager|supervisor)|this is unacceptable/i },
  { key: "appointment_change", label: "Cancel or reschedule", category: "Customer care", pattern: /(?:want|need|have|like) to (?:cancel|reschedule)|can we (?:reschedule|move)|cancel (?:my|our|the) (?:appointment|meeting|call|subscription)/i, exclude: /(?:don'?t|do not|won'?t|not going to).{0,25}cancel/i },
  { key: "follow_up_requested", label: "Follow up requested", category: "Next steps", pattern: /call (?:me|us) (?:back|tomorrow|next|later)|reach (?:me|us) (?:tomorrow|next)|follow up (?:with me|tomorrow|next|later)/i },
  { key: "information_requested", label: "Information requested", category: "Next steps", pattern: /(?:send|email) (?:me|us).{0,35}(?:information|details|proposal|brochure|case stud)/i },
  { key: "booked_or_agreed", label: "Meeting or action agreed", category: "Next steps", pattern: /let'?s (?:book|schedule|do it|move forward)|that (?:time|day) works|schedule (?:a|the) (?:call|meeting|demo)/i },
  { key: "do_not_contact", label: "Do not contact", category: "Next steps", pattern: /stop calling|do not call|don'?t call|remove (?:me|us) from/i },
];

const providerLabels: Record<string, Pick<ReasonSignal, "label" | "category">> = {
  budget_or_price: { label: "Budget or price", category: "Objections" }, timing_or_priority: { label: "Timing or priority", category: "Objections" }, authority_or_decision_process: { label: "Decision process", category: "Objections" }, trust_or_past_bad_experience: { label: "Trust or past experience", category: "Objections" }, value_or_roi: { label: "Value or ROI", category: "Objections" }, internal_capacity: { label: "Internal capacity", category: "Objections" }, competition_or_existing_solution: { label: "Existing solution", category: "Objections" }, risk_or_compliance: { label: "Risk or compliance", category: "Objections" }, fit_or_need: { label: "Fit or need", category: "Objections" }, other: { label: "Other objection", category: "Objections" },
  billing: { label: "Billing or charge", category: "Customer care" }, access_or_account: { label: "Access or account", category: "Customer care" }, product_or_service: { label: "Service problem", category: "Customer care" }, complaint: { label: "Complaint or escalation", category: "Customer care" }, appointment_change: { label: "Cancel or reschedule", category: "Customer care" },
  follow_up_requested: { label: "Follow up requested", category: "Next steps" }, information_requested: { label: "Information requested", category: "Next steps" }, booked_or_agreed: { label: "Meeting or action agreed", category: "Next steps" }, do_not_contact: { label: "Do not contact", category: "Next steps" },
};

function evidence(session: CallSession, quote: string, source: ReasonEvidence["source"]): ReasonEvidence {
  const matching = session.transcript.find(turn => turn.role === "user" && (source === "phrase" || turn.message.toLowerCase().includes(quote.toLowerCase().slice(0, 24))));
  return { sessionId: session.id, quote: matching?.message ?? quote, seconds: matching?.time_in_call_secs ?? 0, createdAt: session.created_at, source };
}

export function conversationSignals(sessions: readonly CallSession[]): { analyzed: number; analyzedByProvider: number; recurring: number; signals: ReasonSignal[] } {
  const verified = [...new Map(sessions.map(session => [session.id, session])).values()].filter(session => ["completed", "failed"].includes(session.status) && session.synced_at && session.transcript.length);
  const grouped = new Map<string, ReasonSignal>();
  const add = (key: string, label: string, category: ReasonSignal["category"], item: ReasonEvidence) => {
    const signal = grouped.get(key) ?? { key, label, category, evidence: [], recurring: false };
    if (!signal.evidence.some(existing => existing.sessionId === item.sessionId)) signal.evidence.push(item);
    grouped.set(key, signal);
  };
  for (const session of verified) {
    const data: Record<string, unknown> = { ...session.post_call_analysis?.data, ...session.analysis_review };
    const objection = typeof data?.primary_objection === "string" ? data.primary_objection : "";
    if (objection && !["none", "unknown"].includes(objection) && providerLabels[objection]) {
      const detail = typeof data?.objection_detail === "string" && data.objection_detail.trim() ? data.objection_detail.trim() : providerLabels[objection].label;
      add(objection, providerLabels[objection].label, "Objections", evidence(session, detail, "structured"));
    }
    const issue = typeof data?.customer_issue_category === "string" ? data.customer_issue_category : "";
    if (issue && !["none", "unknown", "other"].includes(issue) && providerLabels[issue]) add(issue, providerLabels[issue].label, "Customer care", evidence(session, providerLabels[issue].label, "structured"));
    const next = typeof data?.next_step === "string" ? data.next_step : "";
    if (next && !["no_next_step", "unknown"].includes(next) && providerLabels[next]) add(next, providerLabels[next].label, "Next steps", evidence(session, providerLabels[next].label, "structured"));
    for (const rule of rules) {
      const turn = session.transcript.find(item => item.role === "user" && rule.pattern.test(item.message) && !rule.exclude?.test(item.message) && !/\b(?:not|never|don'?t|do not|no need to).{0,18}(?:too expensive|need more time|need to think|talk to|speak to|reschedule)/i.test(item.message));
      if (turn) add(rule.key, rule.label, rule.category, evidence(session, turn.message, "phrase"));
    }
  }
  const signals = [...grouped.values()].map(signal => ({ ...signal, recurring: signal.evidence.length >= 2 })).sort((a, b) => b.evidence.length - a.evidence.length || a.label.localeCompare(b.label));
  return { analyzed: verified.length, analyzedByProvider: verified.filter(session => Boolean(session.post_call_analysis)).length, recurring: signals.filter(signal => signal.recurring).length, signals };
}

export function conversationQuality(sessions: readonly CallSession[]): { enriched: number; metrics: QualityMetric[] } {
  const enriched = [...new Map(sessions.map(session => [session.id, session])).values()].filter(session => ["completed", "failed"].includes(session.status) && session.synced_at && session.post_call_analysis);
  const discoveryScores = enriched.map(session => session.post_call_analysis?.evaluations.discovery_quality?.score).filter((score): score is number => typeof score === "number");
  const rate = (key: string): Pick<QualityMetric, "value" | "measured"> => {
    const results = enriched.map(session => session.post_call_analysis?.evaluations[key]?.result).filter(result => result === "success" || result === "failure");
    return { value: results.length ? Math.round(results.filter(result => result === "success").length / results.length * 100) : null, measured: results.length };
  };
  const sentiment = enriched.map(session => session.post_call_analysis?.sentiment?.label).filter(label => label && label !== "unknown");
  return { enriched: enriched.length, metrics: [
    { key: "discovery_quality", label: "Discovery quality", value: discoveryScores.length ? Math.round(discoveryScores.reduce((sum, score) => sum + score, 0) / discoveryScores.length) : null, unit: "/100", measured: discoveryScores.length },
    { key: "objection_handling", label: "Objections handled", ...rate("objection_handling"), unit: "%" },
    { key: "next_step_quality", label: "Clear next step", ...rate("next_step_quality"), unit: "%" },
    { key: "trust_and_customer_care", label: "Trust & care", ...rate("trust_and_customer_care"), unit: "%" },
    { key: "positive_sentiment", label: "Positive sentiment", value: sentiment.length ? Math.round(sentiment.filter(label => label === "positive").length / sentiment.length * 100) : null, unit: "%", measured: sentiment.length },
  ] };
}
