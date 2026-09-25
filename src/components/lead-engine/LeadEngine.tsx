"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCheck, FolderOpen, FileSearch, Fingerprint, Globe2, Link2, LockKeyhole, MapPin, Phone, Search, ShieldCheck, SlidersHorizontal, Smartphone, Database, BrainCircuit, X } from "lucide-react";
import { buildLeadPlan, dollarsToCents, isUsState, LANE_BENCHMARKS, type LeadLane } from "@/lib/lead-engine-plan";
import styles from "./LeadEngine.module.css";
import { LeadConfidence } from './LeadConfidence';
import { unscoredLeadConfidence } from '@/lib/lead-engine-confidence';
import { LeadSearchFlow } from "./LeadSearchFlow";
import { LeadLibrary } from "./LeadLibrary";
import { LeadJobs } from "./LeadJobs";
import { LeadRegisters } from "./LeadRegisters";
import { LeadBrain } from "./LeadBrain";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
const researchSteps = [
  { title: 'Discover', detail: 'Businesses in your market', status: 'Awaiting provider setup', copy: 'Search published business listings by industry and city. Keep the website and listing URL with each result.', icon: Globe2 },
  { title: 'Research', detail: 'A person, with evidence', status: 'Owner research not connected', copy: 'Compare the business website with independent public business records. A name or job title alone does not confirm a direct owner contact.', icon: Fingerprint },
  { title: 'Verify', detail: 'Check the phone in batches', status: 'Phone verification not connected', copy: 'Check mobile type, phone status and suppression signals together. A mobile number still needs evidence linking it to the owner.', icon: Phone },
] as const;
const tabs = [{ id: 'jobs', label: 'Owner cells', icon: Smartphone }, { id: 'registers', label: 'Registers', icon: Database }, { id: 'brain', label: 'Brain (admin)', icon: BrainCircuit }, { id: 'search', label: 'Build a search', icon: Search }, { id: 'evidence', label: 'Evidence workspace', icon: Fingerprint }, { id: 'lists', label: 'Lead lists', icon: FolderOpen }] as const;
type View = typeof tabs[number]['id'];
const illustrativeConfidence = { ...unscoredLeadConfidence(), value: 75, status: 'needs_review' as const, checks: unscoredLeadConfidence().checks.map(check => ({ ...check, points: check.key === 'independent_owner' ? 0 : check.maximum, state: check.key === 'independent_owner' ? 'missing' as const : 'passed' as const })) };

export function LeadEngine() {
  const [industry, setIndustry] = useState("Roofing");
  const [metro, setMetro] = useState("Charlotte, NC");
  const [target, setTarget] = useState("50");
  const [budget, setBudget] = useState("10");
  const [exclusions, setExclusions] = useState("");
  const [operation, setOperation] = useState<LeadLane | "">("");
  const [downloaded, setDownloaded] = useState(false);
  const [view, setView] = useState<View>('jobs');
  const [example, setExample] = useState(false);
  const [researchStep, setResearchStep] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const plan = useMemo(() => buildLeadPlan({ industry, metro, target: Number(target), hardBudgetCents: dollarsToCents(budget) ?? 0, exclusions: exclusions.split(",").map(item => item.trim()).filter(Boolean), operation: operation || undefined }), [industry, metro, target, budget, exclusions, operation]);
  const benchmark = plan.lane ? LANE_BENCHMARKS[plan.lane] : null;
  const valid = plan.errors.length === 0 && plan.lane !== null;
  // Shown on the field itself: the whole-form error list sits far below and reads as unrelated.
  const metroEntry = metro.trim(), metroParts = /^(.{2,}),\s*([A-Za-z]{2})$/.exec(metroEntry);
  const metroInvalid = metroEntry.length > 0 && (!metroParts || !isUsState(metroParts[2].toUpperCase()));
  function download(): void {
    const file = new Blob([JSON.stringify({ ...plan, createdAt: new Date().toISOString(), status: "draft", pilot: { maxBusinesses: 300, maxCostCents: 1000, completed: false }, executionBlockers: ["Provider pricing and access not verified", "Global ledger and suppression integration required", "Pilot budget approval required"], containsContactData: false }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file); const link = document.createElement("a");
    link.href = url; link.download = "nbc-lead-engine-plan.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  function changeView(next: View): void { setView(next); }

  return <div className={styles.workspace}>
    <header className={styles.heading}>
      <div className={styles.identity}><span className={styles.brandMark} aria-hidden="true"><Search size={23} /></span><div><span className={styles.eyebrow}>Prospecting</span><h1>Lead Engine</h1></div></div>
      <div className={styles.mode}><span />Setup in progress<LockKeyhole size={12} /></div>
    </header>

    <div className={styles.navigation} role="tablist" aria-label="Lead Engine workspace">{tabs.map((tab, index) => <button type="button" ref={element => { tabRefs.current[index] = element; }} id={`tab-${tab.id}`} key={tab.id} role="tab" aria-controls={`panel-${tab.id}`} aria-selected={view === tab.id} tabIndex={view === tab.id ? 0 : -1} className={view === tab.id ? styles.activeTab : ''} onClick={() => changeView(tab.id)} onKeyDown={event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); changeView(tabs[next].id); tabRefs.current[next]?.focus();
    }}><tab.icon size={15} />{tab.label}</button>)}</div>

    <section id="panel-jobs" role="tabpanel" aria-labelledby="tab-jobs" hidden={view !== 'jobs'}>
      <LeadJobs />
    </section>

    <section id="panel-registers" role="tabpanel" aria-labelledby="tab-registers" hidden={view !== 'registers'}>
      <LeadRegisters />
    </section>

    <section id="panel-brain" role="tabpanel" aria-labelledby="tab-brain" hidden={view !== 'brain'}>
      <LeadBrain />
    </section>

    <section id="panel-search" role="tabpanel" aria-labelledby="tab-search" hidden={view !== 'search'}>
      <LeadSearchFlow />
    </section>

    <section id="panel-evidence" role="tabpanel" aria-labelledby="tab-evidence" hidden={view !== 'evidence'}>
      <div className={styles.sectionTitle}><div><span className={styles.sectionNumber}>02 / EVIDENCE & REVIEW</span><h2>Know why a lead earns its score.</h2></div><span className={styles.softLabel}>No results loaded</span></div>
      <div className={styles.evidenceBoard}><div className={styles.tableHeading}><span>Business & person</span><span>Owner evidence</span><span>Phone verification</span><span>Decision</span></div>
        <div className={styles.emptyState}><div className={styles.emptyGraphic}><FileSearch size={34} /><span><Fingerprint size={18} /></span></div><h3>Your research will land here.</h3><p>Each lead will carry a confidence score from 0 to 100, its sources and the checks behind it. Open the score in a lead list to see what is confirmed and what is missing.</p><div><button type="button" className={styles.primary} onClick={() => changeView('search')}>Build a search<ArrowRight size={16} /></button><button type="button" className={styles.secondary} onClick={() => setExample(true)}>Preview the evidence format</button></div></div>
      </div>
      {example && <section className={styles.example} aria-label="Illustrative evidence example"><div className={styles.exampleHeader}><span>ILLUSTRATIVE FORMAT · NOT A LIVE BUSINESS</span><button type="button" aria-label="Close example" onClick={() => setExample(false)}><X size={18} /></button></div><div className={styles.exampleGrid}><div><span className={styles.companyAvatar}>EX</span><h3>Example service company</h3><LeadConfidence confidence={illustrativeConfidence} example /><p>Business contact record</p><span className={styles.reviewBadge}>Owner unconfirmed</span></div><div><h4><Link2 size={16} />Evidence to collect</h4><ul><li>Official website: name, role and published contact</li><li>Independent business record: corroborating role</li><li>Conflicting sources: retained for review</li></ul></div><div><h4><Phone size={16} />Separate phone checks</h4><dl><div><dt>Mobile / landline</dt><dd>Illustrative mobile result</dd></div><div><dt>Phone status</dt><dd>Illustrative active result</dd></div><div><dt>DNC / TCPA signals</dt><dd>Not checked</dd></div></dl></div></div></section>}
      <div className={styles.evidencePrinciple}><ShieldCheck size={21} /><p><strong>Mobile does not automatically mean owner.</strong>100 is the highest evidence score, not a guarantee that the number belongs to the owner. Sources can be outdated, and numbers can change hands.</p></div>
    </section>

    <section hidden={view !== 'lists'} id="panel-lists" role="tabpanel" aria-labelledby="tab-lists"><div className={styles.sectionTitle}><div><span className={styles.sectionNumber}>YOUR LEAD LIBRARY</span><h2>Every market. Its own folder.</h2></div><span className={styles.softLabel}>Private lists · Shared duplicate protection</span></div><LeadLibrary /></section>
    
    <footer className={styles.workspaceFooter}><span><ShieldCheck size={14} />Published business contacts · Human review · No automatic Caller handoff</span></footer>
  </div>;
}
