import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, CalendarDays, Check, Globe2, MessageSquare, ShieldCheck, Users, Zap } from "lucide-react";
import styles from "./AgentShowcase.module.css";

const playbook = [
  { icon: Zap, title: "Start the conversation", text: "A warm introduction, right when a new lead shows interest.", tag: "01 / CONNECT" },
  { icon: MessageSquare, title: "Understand the opportunity", text: "Explore their goals, qualify the fit, and work through questions.", tag: "02 / QUALIFY" },
  { icon: CalendarDays, title: "Make the next step happen", text: "Find the right time for an appointment or bring in your team.", tag: "03 / BOOK" },
];

export function AgentShowcase({ onOpenIntegrations }: { onOpenIntegrations: () => void }): ReactNode {
  return <div className={styles.layout}>
    <section className={styles.voiceCard}>
      <div className={styles.voiceHeader}><span><AudioLines size={16} /> NBC VOICE INTELLIGENCE</span><span className={styles.preview}>CONCEPT PREVIEW</span></div>
      <div className={styles.orb} aria-hidden="true"><div><AudioLines size={64} strokeWidth={1.2} /></div><span className={styles.orbitDot} /></div>
      <div className={styles.voiceTitle}><span>YOUR AI SALES AGENT</span><h2>Anas<span>.</span></h2><p>Your methodology.<br />Every conversation.</p></div>
      <div className={styles.waveform} aria-hidden="true">{Array.from({ length: 57 }, (_, i) => <i key={i} style={{ height: `${10 + Math.abs(Math.sin(i * .73)) * (1 - Math.abs(i - 28) / 34) * 68}px` }} />)}</div>
      <div className={styles.voiceFooter}><span><Globe2 size={14} /> English · United States</span><span>Voice not connected</span></div>
    </section>
    <div className={styles.rightColumn}>
      <section className={styles.profileCard}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>AGENT PROFILE</span><h2>A setter built around your business.</h2></div><span className={styles.draft}>Draft</span></div>
        <p className={styles.intro}>A consistent sales approach, from the first hello to the booked appointment.</p>
        <div className={styles.properties}>{[["Role", "Inbound appointment setter"], ["Sales methodology", "Anas's playbook · Pending training"], ["CRM destination", "GoHighLevel"], ["Voice identity", "To be selected & connected"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className={styles.capabilities}><span><Check size={13} /> Lead qualification</span><span><Check size={13} /> Appointment setting</span><span><Users size={13} /> Human handoff</span></div>
      </section>
      <section className={styles.playbook}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>THE CONVERSATION PLAYBOOK</span><h2>One conversation. A clear next step.</h2></div><ArrowUpRight size={21} /></div><div className={styles.steps}>{playbook.map(step => <article key={step.title}><div className={styles.stepIcon}><step.icon size={20} strokeWidth={1.6} /></div><div><small>{step.tag}</small><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div><div className={styles.playbookFooter}><ShieldCheck size={15} /><span>Proposed workflow · Training and live testing come next.</span></div></section>
    </div>
    <section className={styles.nextMilestone}><div className={styles.milestoneIcon}><CalendarDays size={24} /></div><div><span className={styles.eyebrow}>FROM PREVIEW TO FIRST CALL</span><h3>The next chapter starts with a connection.</h3><p>Connect your CRM, train the agent, then test the full conversation.</p></div><button onClick={onOpenIntegrations}>Explore integrations <ArrowRight size={16} /></button></section>
  </div>;
}
