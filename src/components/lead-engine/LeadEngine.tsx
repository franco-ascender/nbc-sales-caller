"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FolderOpen, FileSearch, Fingerprint, Link2, Phone, Search, ShieldCheck, SlidersHorizontal, Smartphone, Database, BrainCircuit, X } from "lucide-react";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import styles from "./LeadEngine.module.css";
import { LeadConfidence } from './LeadConfidence';
import { unscoredLeadConfidence } from '@/lib/lead-engine-confidence';
import { LeadSearchFlow } from "./LeadSearchFlow";
import { LeadLibrary } from "./LeadLibrary";
import { LeadJobs } from "./LeadJobs";
import { LeadRegisters } from "./LeadRegisters";
import { OperationCosts } from "@/components/account/OperationCosts";
import { LeadBrain } from "./LeadBrain";

const primaryTabs = [{ id: 'search', label: 'Build Search', icon: Search }, { id: 'lists', label: 'Lead Lists', icon: FolderOpen }] as const;
const advancedTabs = [{ id: 'jobs', label: 'Owner research', icon: Smartphone }, { id: 'registers', label: 'Business registers', icon: Database }, { id: 'evidence', label: 'Evidence guide', icon: Fingerprint }, { id: 'brain', label: 'Research settings', icon: BrainCircuit }] as const;
type View = 'costs' | typeof primaryTabs[number]['id'] | typeof advancedTabs[number]['id'];
const illustrativeConfidence = { ...unscoredLeadConfidence(), value: 75, status: 'needs_review' as const, checks: unscoredLeadConfidence().checks.map(check => ({ ...check, points: check.key === 'independent_owner' ? 0 : check.maximum, state: check.key === 'independent_owner' ? 'missing' as const : 'passed' as const })) };

export function LeadEngine() {
  const {user,token} = useWorkspaceAccess();
  const [view, setView] = useState<View>('search');
  const [advanced, setAdvanced] = useState(false);
  const [example, setExample] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = [...primaryTabs, ...(user?.role==='admin'?[{id:'costs' as const,label:'Costs & yield',icon:ShieldCheck}]:[]), ...(advanced ? advancedTabs.filter(t=>t.id!=='brain'||user?.role==='admin') : [])];
  useEffect(()=>{const sync=()=>{const id=window.location.hash.slice(1);if([...primaryTabs,...advancedTabs,...(user?.role==='admin'?[{id:'costs'}]:[])].some(t=>t.id===id)&& (id!=='brain'||user?.role==='admin')){setView(id as View);if(advancedTabs.some(t=>t.id===id))setAdvanced(true);}};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[user?.role]);
  function changeView(next: View): void { setView(next);window.history.replaceState(null,'','#'+next); }

  return <div className={styles.workspace}>
    <header className={styles.heading}>
      <div className={styles.identity}><span className={styles.brandMark} aria-hidden="true"><Search size={23} /></span><div><span className={styles.eyebrow}>Prospecting</span><h1>Lead Engine</h1></div></div>
      <p className={styles.mode}>Find your market. Check the numbers. Build your next list.</p>
    </header>

    <div className={styles.navigationRow}><div className={styles.navigation} role="tablist" aria-label="Lead Engine workspace">{tabs.map((tab, index) => <button type="button" ref={element => { tabRefs.current[index] = element; }} id={`tab-${tab.id}`} key={tab.id} role="tab" aria-controls={`panel-${tab.id}`} aria-selected={view === tab.id} tabIndex={view === tab.id ? 0 : -1} className={view === tab.id ? styles.activeTab : ''} onClick={() => changeView(tab.id)} onKeyDown={event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); changeView(tabs[next].id); tabRefs.current[next]?.focus();
    }}><tab.icon size={16} />{tab.label}</button>)}</div><button className={styles.advancedToggle} aria-expanded={advanced} onClick={()=>{setAdvanced(!advanced);if(advanced&&advancedTabs.some(t=>t.id===view))changeView('search');}}><SlidersHorizontal size={15}/>Advanced tools</button></div>

    {view==='costs'&&user?.role==='admin'&&<section id="panel-costs" role="tabpanel" aria-labelledby="tab-costs"><OperationCosts token={token} initialKind="Scraper"/></section>}
    <section id="panel-jobs" role="tabpanel" aria-labelledby="tab-jobs" hidden={view !== 'jobs'}>
      {view==='jobs'&&<LeadJobs />}
    </section>

    <section id="panel-registers" role="tabpanel" aria-labelledby="tab-registers" hidden={view !== 'registers'}>
      {view==='registers'&&<LeadRegisters />}
    </section>

    <section id="panel-brain" role="tabpanel" aria-labelledby="tab-brain" hidden={view !== 'brain'}>
      {view==='brain'&&user?.role==='admin'&&<LeadBrain />}
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

    <section hidden={view !== 'lists'} id="panel-lists" role="tabpanel" aria-labelledby="tab-lists">{view==='lists'&&<LeadLibrary />}</section>
    
    <footer className={styles.workspaceFooter}><span><ShieldCheck size={14} />Verified mobile export · Review evidence · Send selected results to Caller</span></footer>
  </div>;
}
