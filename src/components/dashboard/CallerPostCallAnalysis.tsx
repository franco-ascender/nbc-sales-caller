"use client";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { CallSession } from "@/lib/caller-types";
import { salesRequest } from "@/lib/caller-request";
import styles from "./CallerPostCallAnalysis.module.css";

const labels: Record<string, string> = {
  none: "None", unknown: "Unknown", other: "Other", budget_or_price: "Budget or price", timing_or_priority: "Timing or priority", authority_or_decision_process: "Decision process", trust_or_past_bad_experience: "Trust or past experience", value_or_roi: "Value or ROI", fit_or_need: "Fit or need", internal_capacity: "Internal capacity", competition_or_existing_solution: "Existing solution", risk_or_compliance: "Risk or compliance",
  billing: "Billing", access_or_account: "Access or account", product_or_service: "Product or service", complaint: "Complaint", appointment_change: "Appointment change",
  booked_or_agreed: "Booked or agreed", follow_up_requested: "Follow-up requested", information_requested: "Information requested", no_next_step: "No next step", do_not_contact: "Do not contact",
};
const objectionOptions = ["none", "budget_or_price", "timing_or_priority", "authority_or_decision_process", "trust_or_past_bad_experience", "value_or_roi", "fit_or_need", "internal_capacity", "competition_or_existing_solution", "risk_or_compliance", "other", "unknown"];
const careOptions = ["none", "billing", "access_or_account", "product_or_service", "complaint", "appointment_change", "other", "unknown"];
const nextOptions = ["booked_or_agreed", "follow_up_requested", "information_requested", "no_next_step", "do_not_contact", "unknown"];

export function CallerPostCallAnalysis({ token, session, onSaved }: { token: string; session: CallSession; onSaved(session: CallSession): void }) {
  const analysis = session.post_call_analysis;
  const [primary, setPrimary] = useState("unknown"), [care, setCare] = useState("unknown"), [next, setNext] = useState("unknown"), [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    const data = analysis?.data, review = session.analysis_review;
    setPrimary(review?.primary_objection || String(data?.primary_objection ?? "unknown")); setCare(review?.customer_issue_category || String(data?.customer_issue_category ?? "unknown")); setNext(review?.next_step || String(data?.next_step ?? "unknown")); setNote(review?.note || ""); setMessage("");
  }, [session.id, session.analysis_review, analysis]);
  if (!analysis) return <section className={styles.empty}><strong>Post-call intelligence</strong><p>Structured analysis begins with conversations completed after NBC Analysis v1 was activated. This result still uses the local scorecard and transcript evidence.</p></section>;
  const evaluations = Object.entries(analysis.evaluations);
  async function save() {
    setBusy(true); setMessage("");
    try { const result = await salesRequest<{ session: CallSession }>(token, `/api/caller/sessions/${session.id}/review`, "PATCH", { primary_objection: primary, customer_issue_category: care, next_step: next, note }); onSaved(result.session); setMessage("Review saved. Insights now use your corrections."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  return <section className={styles.analysis}>
    <header><div><span>POST-CALL INTELLIGENCE</span><h3>What the conversation produced</h3></div>{analysis.sentiment && <b data-tone={analysis.sentiment.label}>{labels[analysis.sentiment.label] || analysis.sentiment.label} sentiment</b>}</header>
    <div className={styles.fields}><label>Primary objection<select value={primary} onChange={event => setPrimary(event.target.value)}>{objectionOptions.map(value => <option value={value} key={value}>{labels[value]}</option>)}</select></label><label>Customer-care issue<select value={care} onChange={event => setCare(event.target.value)}>{careOptions.map(value => <option value={value} key={value}>{labels[value]}</option>)}</select></label><label>Agreed next step<select value={next} onChange={event => setNext(event.target.value)}>{nextOptions.map(value => <option value={value} key={value}>{labels[value]}</option>)}</select></label></div>
    {evaluations.length > 0 && <div className={styles.evaluations}>{evaluations.map(([key, item]) => <article key={key}><span>{labels[key] || key.replaceAll("_", " ")}</span><strong data-result={item.result}>{item.score === null ? item.result : `${item.score}/${item.maxScore ?? 100}`}</strong><p>{item.rationale}</p></article>)}</div>}
    <label className={styles.note}>Reviewer note<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} placeholder="Optional context for the next playbook review." /></label>
    <div className={styles.actions}><button disabled={busy} onClick={() => void save()}>{busy ? <Loader2 size={14} className={styles.spin} /> : <Check size={14} />}Save reviewed classifications</button>{message && <p role="status">{message}</p>}</div>
  </section>;
}
