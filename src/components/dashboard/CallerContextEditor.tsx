"use client";
import { useId, useState } from "react";
import { ChevronDown, MessageCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { ConversationScenario } from "@/lib/caller-knowledge";
import { CONTEXT_ANSWER_LIMIT, emptyCallerContext, type CallerContext } from "@/lib/caller-context";
import { briefCharacterCount, briefLimits, BRIEF_CHARACTER_LIMIT, renderScenarioBrief } from "@/lib/caller-brief";
import styles from "./CallerContextEditor.module.css";

interface Props { value: ConversationScenario; onChange: (value: ConversationScenario) => void; disabled: boolean }
const sections = ["Business & offer", "Lead context", "Conversation goal", "Questions & objections"] as const;
export function CallerContextEditor({ value: scenario, onChange, disabled }: Props) {
  const context = scenario.context ?? emptyCallerContext();
  const [section, setSection] = useState(0);
  const id = useId();
  const update = <K extends keyof ConversationScenario>(key: K, value: ConversationScenario[K]) => onChange({ ...scenario, [key]: value });
  const updateContext = (value: CallerContext) => update("context", value);
  const count = briefCharacterCount(scenario);
  const field = (key: keyof typeof briefLimits, label: string, hint: string, required = false) => <label><strong>{label}{!required && <small>Optional</small>}</strong><span>{hint}</span><textarea aria-label={label} rows={3} maxLength={briefLimits[key]} disabled={disabled} value={scenario[key]} onChange={event => update(key, event.target.value)} /></label>;
  const contextField = (key: "proof" | "qualification", label: string, hint: string) => <label><strong>{label}<small>Optional</small></strong><span>{hint}</span><textarea aria-label={label} rows={3} maxLength={1800} disabled={disabled} value={context[key]} onChange={event => updateContext({ ...context, [key]: event.target.value })} /></label>;
  return <section className={styles.editor} aria-label="Agent brief">
    <div className={styles.heading}><div><h3>One brief. Everything the caller needs.</h3><p>Enter each fact once. The same brief is used for browser tests and selected phone calls.</p></div></div>
    <div className={styles.tabs} role="tablist" aria-label="Agent brief sections">
      {sections.map((label, index) => <button key={label} id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} type="button" role="tab" aria-selected={section === index} tabIndex={section === index ? 0 : -1} onClick={() => setSection(index)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (section + 1) % 4 : event.key === "ArrowLeft" ? (section + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null; if (next !== null) { event.preventDefault(); setSection(next); document.getElementById(`${id}-tab-${next}`)?.focus(); } }}><span>{String(index + 1).padStart(2, "0")}</span>{label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${section}`}>
    {section === 0 && <div className={styles.fields}>
      {field("agentRole", "Business & representation", "Who is the caller representing, what does the business do, and where does it operate?", true)}
      {field("offer", "Offer & deliverables", "What do customers receive, what problem does it solve, and what is included? Keep this to confirmed facts.", true)}
      {field("ticket", "Pricing & terms", "Price, ad spend, contract length, exclusions and limits on promises. Mark unconfirmed terms as unknown.")}
      {contextField("proof", "Evidence & differentiators", "Approved results or specific reasons to choose you. This helps answer ‘Why you?’ without invented claims.")}
    </div>}
    {section === 1 && <div className={styles.fields}>
      {field("prospectProfile", "Prospect & lead origin", "Who is this conversation for? Include their situation, where the lead came from and what they actually requested.", true)}
      {contextField("qualification", "Fit criteria & disqualifiers", "Which facts determine a good fit? List the few things to learn, plus conditions that mean the offer is unsuitable.")}
    </div>}
    {section === 2 && <div className={styles.fields}>
      {field("objective", "Goal & next step", "What should this call achieve, and what should happen if the prospect is a good fit? Booking and sending require connected tools.", true)}
      <div className={styles.selects}>
        <label><strong>Conversation type</strong><select disabled={disabled} aria-label="Conversation type" value={scenario.conversationType} onChange={event => update("conversationType", event.target.value as ConversationScenario["conversationType"])}>{["outbound_prospecting", "inbound_sales", "discovery", "closing", "follow_up", "objection_practice", "custom"].map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
        <label><strong>Tone</strong><select disabled={disabled} aria-label="Tone" value={scenario.tone} onChange={event => update("tone", event.target.value as ConversationScenario["tone"])}>{["consultative", "direct", "warm", "challenger"].map(tone => <option key={tone} value={tone}>{tone}</option>)}</select></label>
      </div>
      <details className={styles.prior}><summary>Additional direction{scenario.instructions ? " · saved notes" : " · optional"}</summary>{field("instructions", "Additional direction", "Only special conversation instructions. Business facts and answers belong in their own sections.")}</details>
    </div>}
    {section === 3 && <div className={styles.answers}>
      <p className={styles.guidance}>Prepare answers to real questions or concerns. Pricing, the offer and terms already come from Business & offer; you do not need to repeat them here.</p>
      {scenario.objections && <details className={styles.prior}><summary>Earlier concern notes · preserved</summary>{field("objections", "Earlier concern notes", "These were saved without answers. They stay in the brief as preparation notes; add an approved response below when you have one.")}</details>}
      {context.answers.length === 0 && <div className={styles.empty}><MessageCircle size={24} /><h4>Prepare for the questions that matter.</h4><p>Pricing, previous agency experiences, timelines, or “What makes you different?” — add only what your business can stand behind.</p></div>}
      {context.answers.map((row, index) => <fieldset className={styles.answer} key={index} disabled={disabled}>
        <legend>Answer {index + 1}</legend>
        <div className={styles.answerTop}><select aria-label={`Answer ${index + 1} type`} value={row.kind} onChange={event => updateContext({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, kind: event.target.value as "question" | "objection" } : item) })}><option value="question">Question</option><option value="objection">Objection</option></select><button type="button" aria-label={`Remove answer ${index + 1}`} onClick={() => updateContext({ ...context, answers: context.answers.filter((_, position) => position !== index) })}><Trash2 size={16} /></button></div>
        <label>What the prospect might say<input maxLength={300} value={row.question} placeholder="e.g. What does your service include?" onChange={event => updateContext({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, question: event.target.value } : item) })} /></label>
        <label>Approved answer<textarea rows={3} maxLength={1200} value={row.answer} placeholder="The facts and response you want the caller to use…" onChange={event => updateContext({ ...context, answers: context.answers.map((item, position) => position === index ? { ...item, answer: event.target.value } : item) })} /></label>
      </fieldset>)}
      <button type="button" className={styles.add} disabled={disabled || context.answers.length >= CONTEXT_ANSWER_LIMIT} onClick={() => updateContext({ ...context, answers: [...context.answers, { kind: "question", question: "", answer: "" }] })}><Plus size={16} />Add approved answer <span>{context.answers.length}/{CONTEXT_ANSWER_LIMIT}</span></button>
    </div>}
    </div>
    <div className={styles.footer}><span><ShieldCheck size={16} />Answers stay short. Unknown facts stay unknown. Actions require connected tools.</span><span data-over={count > BRIEF_CHARACTER_LIMIT}>{count.toLocaleString("en-US")} / {BRIEF_CHARACTER_LIMIT.toLocaleString("en-US")}</span></div>
    <details className={styles.preview}><summary><ChevronDown size={15} />Review complete brief</summary><p>This is the business context sent with the caller’s response rules. Changes apply only after you select the brief for a test or save and select a phone scenario.</p><pre>{renderScenarioBrief(scenario)}</pre></details>
  </section>;
}
