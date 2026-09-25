"use client";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Coins, MessageCircle, LifeBuoy, Footprints, Map as MapIcon, ArrowUpRight } from "lucide-react";
import type { MemberSection, MemberWorkspaceData } from "@/lib/member-types";
import styles from "./Members.module.css";
import { MemberRoadmapPreview } from "./MemberRoadmapPreview";

interface Props { section: MemberSection; data: MemberWorkspaceData; busy: boolean; save: (body: Record<string, unknown>) => Promise<boolean>; older: (before: string) => void }
export function MemberPanels({ section, data, busy, save, older }: Props): ReactNode {
  const tab = section === "journey" ? "onboarding" : section;
  const [business, setBusiness] = useState(data.onboarding?.business ?? "");
  const zone = data.onboarding?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [goal, setGoal] = useState(data.onboarding?.goal ?? "");
  const questions = data.onboarding?.questions ?? "";
  const [message, setMessage] = useState(""); const [ticketTitle, setTicketTitle] = useState(""); const [ticketBody, setTicketBody] = useState("");
  const [eventTitle, setEventTitle] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [joinUrl, setJoinUrl] = useState("");
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [coach, setCoach] = useState(data.subject.coach_id ?? "");
  const requestIds = useRef(new Map<string, string>()); const sending = useRef(false);
  const own = data.subject.id === data.member.id;
  const date = (value: string): string => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: data.onboarding?.timezone || "America/New_York" }).format(new Date(value));
  async function submit(body: Record<string, unknown>): Promise<boolean> {
    if (sending.current) return false; sending.current = true;
    const key = JSON.stringify(body); let id = typeof body.id === "string" ? body.id : requestIds.current.get(key); if (!id) { id = crypto.randomUUID(); requestIds.current.set(key, id); }
    try { const ok = await save({ ...body, id }); if (ok) requestIds.current.delete(key); return ok; } finally { sending.current = false; }
  }
  function onboarding(complete: boolean): void { void submit({ action: "onboarding", business, timezone: zone, goal, questions, complete }); }
  return <>
    <section className={styles.panel} aria-label={section === "journey" ? (data.onboarding?.completed_at ? "Your Roadmap" : "Start Here") : {calendar:"Calendar",chat:"Mentor Chat",tickets:"Support",credits:"NBC Credits"}[section]}>
      {tab === "onboarding" && <>
        {data.onboarding?.completed_at ? <MemberRoadmapPreview /> : <>
          <div className={styles.panelTitle}><span className={styles.journeyIcon}><Footprints size={30} aria-hidden="true" /></span><p className={styles.eyebrow}>YOUR FIRST STEP</p><h2>Let’s get to know you.</h2><p>A couple of quick questions to begin your journey.</p></div>
          {own ? <><p className={styles.placeholderNote}>Temporary onboarding · The full NBC onboarding form is coming soon.</p>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); onboarding(true); }}>
              <label>What are you working on right now?<input required maxLength={200} value={business} onChange={event => setBusiness(event.target.value)} placeholder="Your business, role or current project" /></label>
              <label>What would you like to achieve next?<textarea required maxLength={2000} value={goal} onChange={event => setGoal(event.target.value)} placeholder="Tell us one goal you are excited to work toward." /></label>
              <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => onboarding(false)}>Save for later</button><button type="submit" className={styles.primary} disabled={busy || !business.trim() || !goal.trim()}>Complete onboarding<ArrowUpRight size={17} /></button></div>
            </form>
          </> : <div className={styles.summary}><h3>{data.subject.display_name}’s onboarding</h3><p>{data.onboarding?.business || "No answers yet."}</p><p>{data.onboarding?.goal || "Onboarding in progress."}</p></div>}
        </>}
        {data.member.role === "admin" && data.subject.role === "student" && <form className={styles.form} onSubmit={event => { event.preventDefault(); void submit({action:"assignCoach",memberId:data.subject.id,coachId:coach}); }}><label>Assigned coach<select required value={coach} onChange={event => setCoach(event.target.value)}><option value="">Choose a coach</option>{data.people.filter(person => person.role === "coach").map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><button className={styles.secondary} disabled={busy || !coach}>Assign coach</button></form>}
      </>}
      {tab === "calendar" && <>
        <div className={styles.panelTitle}><p className={styles.eyebrow}>SHOW UP. MOVE FORWARD.</p><h2>Your coaching calendar.</h2><p>Upcoming program calls and private sessions. Times shown in {data.onboarding?.timezone || "America/New_York"}.</p></div>
        {data.events.length ? <div className={styles.list}>{data.events.map(item => <article className={styles.listItem} key={item.id}><CalendarDays size={23} /><div><h3>{item.title}</h3><p>{date(item.starts_at)} — {date(item.ends_at)}</p><span>{item.student_id ? "Private session" : "Program session"}</span></div><a className={styles.primary} href={item.join_url} target="_blank" rel="noopener noreferrer">Join session<ArrowUpRight size={16} /></a></article>)}</div> : <div className={styles.empty}><CalendarDays size={32} /><h3>Your next session will appear here.</h3><p>Your coaching team will add the schedule and joining links.</p></div>}
        {data.member.role !== "student" && (data.member.role === "admin" || data.subject.role === "student") && <details className={styles.details}><summary>Add a session</summary><form className={styles.form} onSubmit={event => { event.preventDefault(); void submit({action:"event",memberId:data.subject.role === "student" ? data.subject.id : undefined,title:eventTitle,startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),joinUrl}).then(ok => { if(ok){setEventTitle("");setStart("");setEnd("");setJoinUrl("");} }); }}><p>{data.subject.role === "student" ? `Private session for ${data.subject.display_name}` : "Program-wide session for all active members"}. Enter times in your device’s local time zone.</p><label>Session title<input required maxLength={160} value={eventTitle} onChange={event => setEventTitle(event.target.value)} /></label><div className={styles.twoColumns}><label>Starts<input type="datetime-local" required value={start} onChange={event => setStart(event.target.value)} /></label><label>Ends<input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)} /></label></div><label>Meeting link<input type="url" required value={joinUrl} onChange={event => setJoinUrl(event.target.value)} placeholder="https://" /></label><button disabled={busy} className={styles.primary}>Add session</button></form></details>}
      </>}
      {tab === "chat" && <>
        <div className={styles.panelTitle}><p className={styles.eyebrow}>A DIRECT LINE TO YOUR COACH</p><h2>Keep the conversation going.</h2><p>Share a question, a challenge or an update. Use Refresh to check for new replies.</p></div>
        {data.subject.role === "student" && data.subject.coach_id ? <><div className={styles.messages}>{data.nextMessages && <button className={styles.secondary} disabled={busy} onClick={() => older(data.nextMessages!)}>Older messages</button>}{data.messages.length ? data.messages.map(item => <article className={item.author_id === data.member.id ? styles.ownMessage : styles.message} key={item.id}><strong>{item.author_id === data.member.id ? "You" : item.author_id === data.subject.id ? data.subject.display_name : "NBC coaching team"}</strong><p>{item.body}</p><small>{date(item.created_at)}</small></article>) : <p className={styles.empty}>Start with the question that matters most to you.</p>}</div><form className={styles.form} onSubmit={event => {event.preventDefault(); void submit({action:"message",memberId:data.subject.id,body:message}).then(ok => {if(ok)setMessage("");});}}><label>Your message<textarea required maxLength={3000} value={message} onChange={event => setMessage(event.target.value)} /></label><button className={styles.primary} disabled={busy || !message.trim()}>Send message</button></form></> : <div className={styles.empty}><MessageCircle size={32}/><h3>{data.member.role === "student" ? "Your coach connection is on its way." : "Choose a student to open their conversation."}</h3><p>{data.member.role === "student" ? "Once your coach is assigned, you can message them here. Support is available in the meantime." : "Student conversations open once an active coach is assigned."}</p></div>}
      </>}
      {tab === "tickets" && <>
        <div className={styles.panelTitle}><p className={styles.eyebrow}>WE ARE HERE TO HELP</p><h2>A clear path to getting unstuck.</h2><p>Open a ticket for a specific issue. Your NBC team can review it and mark it resolved.</p></div>
        {own && <form className={styles.form} onSubmit={event => {event.preventDefault();void submit({action:"ticket",title:ticketTitle,body:ticketBody}).then(ok => {if(ok){setTicketTitle("");setTicketBody("");}});}}><label>What do you need help with?<input required maxLength={160} value={ticketTitle} onChange={event => setTicketTitle(event.target.value)} /></label><label>Details<textarea required maxLength={3000} value={ticketBody} onChange={event => setTicketBody(event.target.value)} /></label><button className={styles.primary} disabled={busy}>Open ticket</button></form>}
        <div className={styles.list}>{data.tickets.length ? data.tickets.map(item => <article className={styles.ticket} key={item.id}><div className={styles.memberBar}><h3>{item.title}</h3><span className={styles.badge}>{item.status}</span></div><p>{item.body}</p><small>{date(item.created_at)}</small><button disabled={busy} className={styles.secondary} onClick={() => void submit({action:"ticketStatus",memberId:data.subject.id,id:item.id,status:item.status === "open" ? "resolved" : "open"})}>{item.status === "open" ? "Mark resolved" : "Reopen ticket"}</button></article>) : <div className={styles.empty}><LifeBuoy size={32}/><h3>No tickets yet.</h3><p>When you need help, your requests will stay organized here.</p></div>}</div>
      </>}
      {tab === "credits" && <>
        <div className={styles.panelTitle}><p className={styles.eyebrow}>YOUR NBC CREDITS</p><h2>Know what is available. See where it goes.</h2><p>Credits will power eligible NBC tools. Paid usage and purchases are not active yet.</p></div>
        <div className={styles.creditHero}><div><span>Available credits</span><strong>{data.credits.available.toLocaleString("en-US")}</strong></div><div><span>Reserved for activity</span><strong>{data.credits.reserved.toLocaleString("en-US")}</strong></div></div>
        <p className={styles.note}>Included credits, action costs and top-up options will appear when the program’s credit policy is ready. No credits are consumed by browsing this workspace.</p>
        <h3>Recent activity</h3>{data.credits.entries.length ? <ul className={styles.ledger}>{data.credits.entries.map(item => <li key={item.id}><div><strong>{item.reason}</strong><small>{date(item.created_at)}</small></div><span>{item.amount > 0 ? "+" : ""}{item.amount} credits</span></li>)}</ul> : <div className={styles.empty}><Coins size={32}/><h3>A fresh start.</h3><p>No credit activity has been recorded.</p></div>}
        {data.member.role === "admin" && <details className={styles.details}><summary>Add credits to {data.subject.display_name}</summary><form className={styles.form} onSubmit={event => {event.preventDefault();void submit({action:"grant",memberId:data.subject.id,amount:Number(amount),reason}).then(ok => {if(ok){setAmount("");setReason("");}});}}><label>Credits<input type="number" min="1" max="1000000" step="1" required value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Reason shown in the member’s history<input required maxLength={160} value={reason} onChange={event => setReason(event.target.value)} /></label><p>This records a manual credit allocation, not a payment.</p><button disabled={busy} className={styles.primary}>Record credit allocation</button></form></details>}
      </>}
    </section>
  </>;
}
