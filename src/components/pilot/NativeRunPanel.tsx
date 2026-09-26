'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Clock3, Phone, RefreshCw, Search, ShieldCheck, Square } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import type { PilotView, PilotSlotView } from '@/lib/live-pilot';
import { excludeBeforeVerification, phoneDecision, reviewConversation, qualifiedRows, runEvidenceCsv } from '@/lib/run-review';
import styles from './NativeRunPanel.module.css';
import {LeadRunControls} from '@/components/lead-engine/LeadRunControls';
import {VerificationRateSetup} from '@/components/lead-engine/VerificationRateSetup';

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const running = (slot: PilotSlotView) => ['dispatching', 'running'].includes(slot.state);
const status: Record<string,string> = {ready:'Not started',dispatching:'Connecting',running:'In progress',completed:'Finished',uncertain:'Needs reconciliation',failed:'Failed',stopped:'Stopped'};
export function NativeRunPanel({ kind, onUnavailable }: { kind: 'phone'|'scrape'; onUnavailable?: () => void }) {
  const {token,user} = useWorkspaceAccess();
  const [data,setData]=useState<PilotView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[selected,setSelected]=useState(kind==='phone'?'caller-2':'chiropractor-miami');
  const [feedback,setFeedback]=useState(''),[saved,setSaved]=useState(false),[filter,setFilter]=useState('all'),[now,setNow]=useState(Date.now()),[verifying,setVerifying]=useState(false),[unavailable,setUnavailable]=useState(false);
  const lock=useRef(false),generation=useRef(0),continueVerification=useRef(false),current=useRef(data);current.current=data;
  const unavailableCallback=useRef(onUnavailable);unavailableCallback.current=onUnavailable;
  const request=useCallback(async(action?:string,key?:string,note?:string):Promise<PilotView|null>=>{
    if(!token||lock.current)return null;lock.current=true;const g=generation.current;setBusy(action??'load');setError('');
    try {
      const response=await fetch('/api/pilot',{method:action?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:JSON.stringify({action,key,...(['start','verify'].includes(action)?{confirmed:true}:{}),...(action==='feedback'?{feedback:note}:{})})}:{}),cache:'no-store',signal:AbortSignal.timeout(60000)});
      const result=await response.json();
      if(response.status===403){if(g===generation.current){setUnavailable(true);unavailableCallback.current?.();}return null;}
      if(!response.ok)throw Error(result.error??'This step could not be confirmed. Refresh the saved result before retrying.');
      if(g===generation.current){setData(result);if(action==='feedback')setSaved(true);}return result as PilotView;
    }catch(e){if(g===generation.current)setError(e instanceof Error?e.message:'Could not load this run.');return null;}
    finally{if(g===generation.current){lock.current=false;setBusy('');}}
  },[token]);
  useEffect(()=>{generation.current++;lock.current=false;void request();return()=>{generation.current++;lock.current=false;continueVerification.current=false;};},[request]);
  useEffect(()=>{const timer=setInterval(()=>{setNow(Date.now());const slot=current.current?.slots.find(s=>running(s)&&!s.key.startsWith('list-'));if(slot&&!lock.current&&!continueVerification.current)void request('sync',slot.key);},5000);return()=>clearInterval(timer);},[request]);
  const slots=data?.slots.filter(s=>s.kind===kind)??[], chosen=slots.find(s=>s.key===selected)??slots[0];
  useEffect(()=>{setFeedback(chosen?.result.feedback??'');},[chosen?.key,chosen?.result.feedback]);
  useEffect(()=>{setSaved(false);setFilter('all');},[chosen?.key]);
  async function verify(){
    if(!chosen||verifying)return;continueVerification.current=true;setVerifying(true);
    try {
      if((chosen.industry==='chiropractor'||chosen.key.startsWith('chiropractor'))&&!chosen.result.ownerEvidence){const evidence=await request('research',chosen.key);if(!evidence)return;}
      while(continueVerification.current){const next=await request('verify',chosen.key);if(!next)break;const slot=next.slots.find(s=>s.key===chosen.key);const checked=new Set(slot?.result.phoneChecks?.map(c=>c.phone10));if(next.pending||!slot?.result.rows?.some(r=>!excludeBeforeVerification(r)&&!checked.has(r.phone10!)))break;}}
    finally{continueVerification.current=false;setVerifying(false);}
  }
  function exportRows(qualifiedOnly=false){
    if(!chosen)return;
    const csv=runEvidenceCsv(chosen.result,qualifiedOnly);
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`nbc-${chosen.key}-${qualifiedOnly?"phone-qualified":"all-evidence"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(user?.role!=='admin'||unavailable)return null;
  if(!data)return <div className={styles.panel}>{error?<p role="alert">{error}</p>:<p role="status">Loading saved runs…</p>}<button onClick={()=>void request()} disabled={Boolean(busy)}>Refresh</button></div>;
  const rows=chosen?.result.rows??[],checks=chosen?.result.phoneChecks??[];
  const filtered=rows.filter(r=>excludeBeforeVerification(r)), eligiblePhones=[...new Set(rows.filter(r=>!excludeBeforeVerification(r)).map(r=>r.phone10!))];
  const checked=checks.filter(c=>c.state==='completed'&&eligiblePhones.includes(c.phone10)),passed=qualifiedRows(chosen?.result??{}),remaining=eligiblePhones.filter(p=>!checks.some(c=>c.phone10===p));
  const managed=chosen?.key.startsWith('list-')??false;
  const findings=chosen?reviewConversation(chosen.result):[];
  const shown=rows.filter(r=>filter==='all'||(filter==='excluded'?Boolean(excludeBeforeVerification(r)):filter==='passed'?passed.includes(r):!excludeBeforeVerification(r)&&!checks.some(c=>c.phone10===r.phone10)));
  const elapsed=chosen?.createdAt?Math.max(0,Math.floor(((running(chosen)?now:Date.parse(chosen.updatedAt??chosen.createdAt))-Date.parse(chosen.createdAt))/1000)):null;
  return <section className={styles.panel} aria-label={kind==='phone'?'Telephone calls':'Lead search runs'}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>{kind==='phone'?'AI CALLER · TELEPHONE':'LEAD ENGINE · RESEARCH'}</span><h2>{kind==='phone'?'Calls & outcomes':'Build a qualified lead list'}</h2><p>{kind==='phone'?'Review the conversation, the objections and what actually happened next.':'Follow each business from discovery to the checks that qualify or exclude it.'}</p></div><button disabled={Boolean(busy)||verifying} onClick={()=>void request()} aria-label="Refresh saved runs"><RefreshCw size={16}/></button></header>
    <div className={styles.budget}><span>Shared allowance <strong>{dollars(data.capCents)}</strong></span><span>Reserved <strong>{dollars(data.reservedCents)}</strong></span><span>Reported so far <strong>${(data.reportedMicrousd/1e6).toFixed(4)}</strong></span><small>Reported costs are partial. Reservations include earlier runs.</small></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{data.paused&&<p className={styles.error}>Spending is paused for this round.</p>}
    {kind==='scrape'&&<LeadRunControls token={token} pilot={data} selectedKey={chosen?.key} onUpdate={(view,key)=>{setData(view);if(key)setSelected(key);}}/>}
    <div className={styles.controls}><label>{kind==='phone'?'Conversation':'Saved lists & markets'}<select value={chosen?.key??''} disabled={verifying} onChange={e=>setSelected(e.target.value)}>{slots.map(s=><option key={s.key} value={s.key}>{s.title} · {status[s.state]}</option>)}</select></label>
      {!managed&&(chosen?.state==='ready'?<button className={styles.primary} disabled={Boolean(busy)||data.pending||data.paused} onClick={()=>void request('start',chosen.key)}>{kind==='phone'?<Phone size={16}/>:<Search size={16}/>} {kind==='phone'?'Call my phone':'Find businesses'} · reserve {dollars(chosen.reserveCents)}</button>:chosen&&<button disabled={Boolean(busy)||verifying} onClick={()=>void request('sync',chosen.key)}><RefreshCw size={15}/>Update result</button>)}
      {!managed&&chosen&&running(chosen)&&<button disabled={Boolean(busy)} onClick={()=>void request('stop',chosen.key)}><Square size={15}/>Stop</button>}
    </div>
    {kind==='phone'&&<p className={styles.subtle}>Nalify · Garage Door Business Owner · phone ending {chosen?.destinationLast4??data.destinationLast4} · ten-minute call limit for this approved round.</p>}
    {!managed&&chosen&&running(chosen)&&<div className={styles.progress} role="status"><span className={styles.pulse}/>{kind==='phone'?'Call is active':'Finding business listings'}{elapsed!==null&&` · ${Math.floor(elapsed/60)}m ${elapsed%60}s elapsed`}<small>{kind==='scrape'?'The source has not provided a completion estimate. Results update every five seconds.':'The saved transcript becomes available after the call ends.'}</small></div>}
    {kind==='phone'&&chosen&&<>
      <div className={styles.outcome}><ShieldCheck size={21}/><div><strong>Appointment not confirmed</strong><p>{data.booking?.reason} Agreement to talk is not a booked appointment. No confirmed invitation or meeting link is recorded for this call.</p></div></div>
      {findings.length>0&&<div className={styles.findings}><h3>Reasons & follow-through</h3><p className={styles.subtle}>Signals from the saved transcript, with the exact words that support them.</p><div>{findings.map((f,i)=><article key={i} data-kind={f.kind}><span>{f.kind==='gap'?'FOLLOW-THROUGH GAP':f.kind.toUpperCase()}</span><h4>{f.label}</h4><blockquote>“{f.quote}”</blockquote><a href={`#phone-turn-${f.turn}`}>Read in conversation ↗</a></article>)}</div></div>}
      {chosen.result.summary&&<details className={styles.details}><summary>Conversation summary</summary><p>{chosen.result.summary}</p></details>}
      <section className={styles.transcript} aria-label="Telephone transcript"><h3>Conversation transcript</h3>{chosen.result.transcript?.length?chosen.result.transcript.map((t,i)=><article id={`phone-turn-${i}`} key={i} data-role={t.role}><span>{t.role==='agent'?'Nalify':'Prospect'}</span><p>{t.message}</p></article>):<p className={styles.subtle}>No saved transcript yet.</p>}</section>
      <details className={styles.details}><summary>Call details & cost</summary><p>Duration: {chosen.result.durationSeconds??'Pending'} seconds. Reported: {chosen.reportedMicrousd===null?'Pending':`$${(chosen.reportedMicrousd/1e6).toFixed(4)}`}.</p><p>{chosen.result.costNote}</p></details>
    </>}
    {kind==='scrape'&&chosen&&<>
      {!managed&&<ol className={styles.pipeline} aria-label="Research stages"><li data-done={rows.length>0}><b>1</b><strong>Discovery</strong><span>{rows.length?`${rows.length} businesses found`:`Up to ${chosen.count} businesses`}</span></li><li data-done={rows.length>0}><b>2</b><strong>Filter</strong><span>{rows.length?`${filtered.length} excluded · ${eligiblePhones.length} unique phones eligible`:'Missing, invalid, duplicate & toll-free checks'}</span></li><li data-done={checked.length>0&&remaining.length===0}><b>3</b><strong>Phone checks</strong><span>{checked.length?`${checked.length} checked · ${passed.length} pass`:'Not verified yet'}</span></li><li><b>4</b><strong>Owner evidence</strong><span>{chosen.result.ownerEvidence?`${chosen.result.ownerEvidence.filter(e=>e.state==='association_found').length} registry associations · review required`:'Identity must be corroborated'}</span></li></ol>}
      {!managed&&<div className={styles.verification}><div><h3>Verify before dialing</h3><p>Check mobile type, reachability, Do Not Call and TCPA signals. Passing these checks does not establish that the phone belongs to the owner. For chiropractors, missing registry research runs first at no charge.</p>{data.verification?.blocker&&<p className={styles.warning}>{data.verification.blocker}</p>}<span className={styles.subtle}>{remaining.length} eligible phones remain. {data.verification?.unitCents?`Reserve up to ${dollars(remaining.length*data.verification.unitCents)} for this step.`:'Unconfirmed costs are never automatically charged.'}</span></div>
        {!managed&&(verifying?<button onClick={()=>{continueVerification.current=false;}}><Square size={14}/>Pause after current check</button>:<button className={styles.primary} disabled={!data.verification?.configured||!remaining.length||Boolean(busy)||data.pending||data.paused||chosen.state!=='completed'} onClick={()=>void verify()}><ShieldCheck size={16}/>Verify eligible phones</button>)}
      </div>}
      {!data.verification?.configured&&<VerificationRateSetup token={token} disabled={Boolean(busy)||verifying} onSaved={setData}/>}
      {verifying&&<p role="status">Verifying one phone at a time · {checked.length} of {eligiblePhones.length} saved. You can pause; finished checks are retained.</p>}
      {checks.some(c=>c.state==='uncertain'||c.state==='dispatching')&&<p className={styles.warning}>A phone check needs reconciliation. It will not be charged again automatically.</p>}
      {!managed&&rows.length>0&&<div className={styles.verification}><div><h3>Research the person behind the business</h3><p>{(chosen.industry==='chiropractor'||chosen.key.startsWith('chiropractor'))?'Compare these clinics with the public NPI registry. Keep the authorized official, role and published registry phone separate from confirmed ownership.':'The owner registry for this industry and market is not connected yet. Phone verification can proceed independently; these rows remain business contacts.'}</p>{chosen.result.registryTruncated&&<p className={styles.warning}>Registry returned its page limit. Unmatched businesses need further research.</p>}</div>{!managed&&(chosen.industry==='chiropractor'||chosen.key.startsWith('chiropractor'))&&<button disabled={Boolean(busy)||verifying} onClick={()=>void request('research',chosen.key)}>Research registry evidence · free</button>}</div>}
      {rows.length>0&&<><div className={styles.tableHeading}><h3>Results & evidence</h3><label>Show<select aria-label="Filter lead results" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All businesses ({rows.length})</option><option value="excluded">Excluded before verification ({filtered.length})</option><option value="pending">Awaiting phone checks</option><option value="passed">Phone checks passed</option></select></label><button onClick={()=>exportRows()}><ArrowDownToLine size={15}/>Export all evidence</button><button disabled={!passed.length} onClick={()=>exportRows(true)}><ArrowDownToLine size={15}/>Export phone-qualified ({passed.length})</button></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Business</th><th>Published phone</th><th>Filtering decision</th><th>Phone checks</th><th>Owner evidence</th></tr></thead><tbody>{shown.map((r,i)=>{const c=checks.find(c=>c.phone10===r.phone10),e=chosen.result.ownerEvidence?.find(e=>e.business===r.name&&e.phone10===r.phone10);return <tr key={i}><td><strong>{r.name}</strong><small>{r.city}, {r.state}</small>{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}</td><td>{r.phone10??'Missing'}</td><td>{excludeBeforeVerification(r)??'Eligible for verification'}</td><td>{c?.state==='uncertain'?'Unconfirmed · held':phoneDecision(c?.verification).label}{c?.verification&&<small>{c.verification.verifiedAt?.slice(0,10)}</small>}</td><td>{e?.person??(e?.state==='ambiguous'?'Ambiguous match':'Not established')}<small>{e?.role??'Business listing alone is insufficient'}</small>{e?.registryPhone&&<small>Registry phone: {e.registryPhone}{e.registryPhone===r.phone10?' · same business line':' · different, unverified'}</small>}{e?.source&&<a href={e.source} target="_blank" rel="noreferrer">Registry evidence ↗</a>}{e&&<small>{e.basis}</small>}</td></tr>;})}</tbody></table>{!shown.length&&<p className={styles.subtle}>No businesses match this filter.</p>}</div></>}
    </>}
    {chosen&&chosen.state!=='ready'&&<div className={styles.feedback}><label>Review notes<textarea rows={3} maxLength={3000} value={feedback} onChange={e=>{setFeedback(e.target.value);setSaved(false);}} placeholder="What needs to improve? Name the business or quote the moment in the call."/></label><button disabled={Boolean(busy)||verifying} onClick={()=>void request('feedback',chosen.key,feedback)}>Save notes</button>{saved&&<span role="status"><Check size={14}/>Saved</span>}</div>}
  </section>;
}
