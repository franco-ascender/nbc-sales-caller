"use client";
import { useState } from "react";
import { BookOpen, ChevronDown, MessageCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { callerContextFields, contextCharacterCount, CONTEXT_ANSWER_LIMIT, CONTEXT_CHARACTER_LIMIT, emptyCallerContext, renderCallerContext, type CallerContext } from "@/lib/caller-context";
import styles from "./CallerContextEditor.module.css";

interface Props { value?: CallerContext; onChange: (value: CallerContext) => void; disabled: boolean }
export function CallerContextEditor({ value, onChange, disabled }: Props) {
  const context = value ?? emptyCallerContext();
  const [section, setSection] = useState<"business" | "answers">("business");
  const count = contextCharacterCount(context);
  const completed = callerContextFields.filter(field => context[field.key].trim()).length;
  const preview = renderCallerContext(context);
  return <section className={styles.editor} aria-label="Agent context">
    <div className={styles.heading}><span className={styles.icon}><BookOpen size={20} /></span><div><h3>The knowledge behind the conversation.</h3><p>Give the caller facts it can trust and answers it can make its own.</p></div></div>
    <div className={styles.tabs} role="tablist" aria-label="Agent context sections">
      <button type="button" role="tab" aria-selected={section === "business"} onClick={() => setSection("business")}><BookOpen size={15} />Business context <span>{completed}/6</span></button>
      <button type="button" role="tab" aria-selected={section === "answers"} onClick={() => setSection("answers")}><MessageCircle size={15} />Questions & objections <span>{context.answers.length}</span></button>
    </div>
    {section === "business" ? <div className={styles.fields} role="tabpanel" aria-label="Business context">
      {callerContextFields.map(field => <label key={field.key}><strong>{field.label}</strong><span>{field.hint}</span><textarea rows={3} maxLength={1800} disabled={disabled} value={context[field.key]} placeholder="Add confirmed details…" onChange={event => onChange({ ...context, [field.key]: event.target.value })} /></label>)}
    </div> : <div className={styles.answers} role="tabpanel" aria-label="Questions and objections">
      <p className={styles.guidance}>Write the response you would approve. The caller uses its meaning naturally, answers first, and asks one useful follow-up when needed.</p>
      {context.answers.length === 0 && <div className={styles.empty}><MessageCircle size={24} /><h4>Prepare for the questions that matter.</h4><p>Pricing, previous agency experiences, timelines, or “What makes you different?” — add only what your business can stand behind.</p></div>}
      {context.answers.map((row, index) => <fieldset className={styles.answer} key={index} disabled={disabled}>
        <legend>Answer {index + 1}</legend>
        <div className={styles.answerTop}><select aria-label={`Answer ${index + 1} type`} value={row.kind} onChange={event => onChange({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, kind: event.target.value as "question" | "objection" } : item) })}><option value="question">Question</option><option value="objection">Objection</option></select><button type="button" aria-label={`Remove answer ${index + 1}`} onClick={() => onChange({ ...context, answers: context.answers.filter((_, position) => position !== index) })}><Trash2 size={16} /></button></div>
        <label>What the prospect might say<input maxLength={300} value={row.question} placeholder="e.g. What does your service include?" onChange={event => onChange({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, question: event.target.value } : item) })} /></label>
        <label>Approved answer<textarea rows={3} maxLength={1200} value={row.answer} placeholder="The facts and response you want the caller to use…" onChange={event => onChange({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, answer: event.target.value } : item) })} /></label>
      </fieldset>)}
      <button type="button" className={styles.add} disabled={disabled || context.answers.length >= CONTEXT_ANSWER_LIMIT} onClick={() => onChange({ ...context, answers: [...context.answers, { kind: "question", question: "", answer: "" }] })}><Plus size={16} />Add approved answer <span>{context.answers.length}/{CONTEXT_ANSWER_LIMIT}</span></button>
    </div>}
    <div className={styles.footer}><span><ShieldCheck size={16} />Unknown facts stay unknown. External actions require a connected tool.</span><span data-over={count > CONTEXT_CHARACTER_LIMIT}>{count.toLocaleString("en-US")} / {CONTEXT_CHARACTER_LIMIT.toLocaleString("en-US")}</span></div>
    <details className={styles.preview}><summary><ChevronDown size={15} />Review added context</summary><p>This is the extra context included with your brief. The caller also receives rules for short answers, interruptions, missing facts and opt-outs.</p><pre>{preview || "Add business details or approved answers to preview them here."}</pre></details>
  </section>;
}
