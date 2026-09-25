'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Phone, Search, RefreshCw, Square, Wallet, CheckCircle2 } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import type { PilotView, PilotSlotView } from '@/lib/live-pilot';
import styles from './TestCenter.module.css';
const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
const usage=(micro:number|null)=>micro===null?'Pending':`$${(micro/1e6).toFixed(4)}`;
const active=(s:PilotSlotView)=>['dispatching','running'].includes(s.state);
const labels:Record<string,string>={ready:'Ready to start',dispatching:'Connecting',running:'In progress',uncertain:'Needs reconciliation',completed:'Completed',failed:'Ended without success',stopped:'Stopped'};
export function TestCenter(){
  const {token,user}=useWorkspaceAccess();const [data,setData]=useState<PilotView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[selected,setSelected]=useState('roofing-miami'),[feedback,setFeedback]=useState(''),[saved,setSaved]=useState(false);
  const lock=useRef(''),seq=useRef(0),current=useRef<PilotView|null>(null);current.current=data;
  const run=useCallback(async(action?:string,key?:string,note?:string)=>{
    if(!token||(lock.current&&action!=='stop'))return;
    const id=++seq.current;lock.current=action??'load';setBusy(lock.current);setError('');
    try{
      const r=await fetch('/api/pilot',{method:action?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:JSON.stringify({action,key,...(action==='start'?{confirmed:true}:{}),...(action==='feedback'?{feedback:note}:{})})}:{}),cache:'no-store',signal:AbortSignal.timeout(65000)});
      const body=await r.json() as PilotView&{error?:string};if(!r.ok)throw Error(body.error??'This step could not be confirmed. Refresh the existing test.');
      if(id===seq.current){setData(body);if(action==='feedback')setSaved(true);}
    }catch(e){if(id===seq.current)setError(e instanceof Error?e.message:'The test center could not be reached.');}
    finally{if(id===seq.current){lock.current='';setBusy('');}}
  },[token]);
  useEffect(()=>{void run();return()=>{seq.current++;lock.current='';};},[run]);
  useEffect(()=>{if(!token)return;const timer=window.setInterval(()=>{const operation=current.current?.slots.find(active);if(operation&&!lock.current)void run('sync',operation.key);},8000);return()=>window.clearInterval(timer);},[token,run]);
  const chosen=data?.slots.find(s=>s.key===selected);
  useEffect(()=>{setFeedback(chosen?.result.feedback??'');},[selected,chosen?.result.feedback]);
  useEffect(()=>{setSaved(false);},[selected]);
  function download(slot:PilotSlotView){
    const rows=slot.result.rows??[];const escape=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
    const csv=[['Business','City','State','Published business phone','Website','Source','Review status','Phone verification','Owner identity'],...rows.map(r=>[r.name,r.city,r.state,r.phone10,r.website,r.sourceUrl,r.rejection??r.chain??(r.duplicate?'duplicate':'candidate'),'Not run','Not confirmed'])].map(row=>row.map(escape).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`nbc-${slot.key}-candidates.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className={styles.page}>
    <header className={styles.header}><div><Link href="/caller"><ArrowLeft size={15}/> Back to Caller</Link><span className={styles.eyebrow}>NBC · PRIVATE PILOT</span><h1>Test Center</h1><p>Your first calls. Your first lists. One shared budget.</p></div><button onClick={()=>void run()} disabled={Boolean(busy)}><RefreshCw size={16}/>Refresh budget</button></header>
    {error&&<div className={styles.error} role="alert">{error}<button disabled={Boolean(busy)} onClick={()=>void run()}>Refresh</button></div>}
    {!data&&!error&&<p role="status">Loading your approved test round…</p>}
    {data&&<>
      <section className={styles.budget} aria-label="Shared test budget"><div><Wallet size={20}/><span>Round limit<strong>{money(data.capCents)}</strong></span></div><div><span>Reserved · includes prior tests<strong>{money(data.reservedCents)}</strong></span></div><div><span>Reported usage · partial<strong>{usage(data.reportedMicrousd)}</strong></span></div><div><span>Available to reserve<strong>{money(data.availableCents)}</strong></span></div></section>
      <p className={styles.hint}>Reservations are spending limits, not charges. They stay held while provider costs settle. The $25 limit includes earlier tests. Only pressing a Start button creates paid work.</p>
      {data.paused&&<div className={styles.error}>This round is paused. No additional paid work can start.</div>}
      <section className={styles.section}><div className={styles.sectionTitle}><Phone size={21}/><div><h2>Try the AI caller</h2><p>Nalify · Garage Door Business Owner · $2,500/month offer</p></div></div>
        <div className={styles.instructions}>Your phone ends in <strong>{data.destinationLast4}</strong>. Be ready to answer before starting. Each call ends after ten minutes at most. Challenge the price, interrupt naturally, and ask for a clear next step.</div>
        <div className={styles.callGrid}>{data.slots.filter(s=>s.kind==='phone').map(s=><article key={s.key} className={styles.card}>
          <span className={styles.status}>{labels[s.state]}</span><h3>{s.title}</h3><p>{s.result.message??'The agent calls your approved test phone. No lead or campaign is contacted.'}</p>
          <div className={styles.meta}><span>Reserve {money(s.reserveCents)}</span><span>Reported {usage(s.reportedMicrousd)}</span>{s.result.durationSeconds!==undefined&&<span>{s.result.durationSeconds}s</span>}</div>
          <div className={styles.actions}>{s.state==='ready'?<button className={styles.primary} disabled={Boolean(busy)||data.pending||data.paused||data.availableCents<s.reserveCents} onClick={()=>{setSelected(s.key);void run('start',s.key);}}><Phone size={16}/>Call my phone · {money(s.reserveCents)} limit</button>:<><button onClick={()=>setSelected(s.key)}>View result</button><button disabled={Boolean(busy)} onClick={()=>void run('sync',s.key)}><RefreshCw size={14}/>Update result</button>{active(s)&&<button className={styles.stop} disabled={busy==='stop'} onClick={()=>void run('stop',s.key)}><Square size={14}/>Stop call</button>}</>}</div>
        </article>)}</div>
      </section>
      <section className={styles.section}><div className={styles.sectionTitle}><Search size={21}/><div><h2>Try the listing search</h2><p>200 business candidates across two markets. Start with Miami, then compare Charlotte.</p></div></div>
        <div className={styles.instructions}><strong>Discovery pilot:</strong> published business listings, source links, duplicate checks and initial relevance filters. Phone validation and owner identification are pending verified pricing; these results are not confirmed owner mobiles. No outreach starts from these lists.</div>
        <div className={styles.listGrid}>{data.slots.filter(s=>s.kind==='scrape').map(s=><article className={styles.card} key={s.key}><span className={styles.status}>{labels[s.state]}</span><h3>{s.title}</h3><p>Up to {s.count} businesses · Reserve {money(s.reserveCents)}</p>
          {s.result.rawBusinesses!==undefined&&<p><strong>{s.result.acceptedForReview}</strong> candidates for review / {s.result.rawBusinesses} found</p>}<div className={styles.meta}><span>Reported {usage(s.reportedMicrousd)}</span></div>
          <div className={styles.actions}>{s.state==='ready'?<button className={styles.primary} disabled={Boolean(busy)||data.pending||data.paused||data.availableCents<s.reserveCents} onClick={()=>{setSelected(s.key);void run('start',s.key);}}><Search size={15}/>Start sample · {money(s.reserveCents)} limit</button>:<><button onClick={()=>setSelected(s.key)}>View results</button><button disabled={Boolean(busy)} onClick={()=>void run('sync',s.key)} aria-label={`Update ${s.title}`}><RefreshCw size={15}/></button>{active(s)&&<button className={styles.stop} disabled={busy==='stop'} onClick={()=>void run('stop',s.key)}>Stop</button>}</>}</div>
        </article>)}</div>
      </section>
      {chosen&&chosen.state!=='ready'&&<section className={styles.section} aria-label="Selected test results"><div className={styles.sectionTitle}><CheckCircle2 size={21}/><div><h2>{chosen.title} · Results</h2><p>{chosen.result.costNote??'Confirmed costs will appear as the providers report them.'}</p></div>{chosen.result.rows&&<button onClick={()=>download(chosen)}><Download size={16}/>Download CSV</button>}</div>
        {chosen.result.outcome&&<p>Ended: {chosen.result.outcome}</p>}{chosen.result.summary&&<p>{chosen.result.summary}</p>}
        {chosen.result.transcript&&<div className={styles.transcript}>{chosen.result.transcript.map((t,i)=><p key={i}><strong>{t.role==='agent'?'Nalify':'Prospect'}</strong>{t.message}</p>)}</div>}
        {chosen.result.rows&&<div className={styles.tableWrap}><table><thead><tr><th>Business</th><th>City</th><th>Published phone</th><th>Evidence</th><th>Review</th></tr></thead><tbody>{chosen.result.rows.map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.city}</td><td>{r.phone10??'—'}</td><td>{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">Listing</a>} {r.website&&<a href={r.website} target="_blank" rel="noreferrer">Website</a>}</td><td>{r.rejection??r.chain??(r.duplicate?'Duplicate':'Candidate · unverified')}</td></tr>)}</tbody></table></div>}
        <label className={styles.feedback}>Your notes for the review<textarea value={feedback} maxLength={3000} rows={3} placeholder="What worked? What failed? Include a business name or the moment in the call." onChange={e=>{setFeedback(e.target.value);setSaved(false);}}/></label><button disabled={Boolean(busy)} onClick={()=>void run('feedback',chosen.key,feedback)}>Save feedback</button>{saved&&<span role="status" className={styles.saved}>Saved</span>}
      </section>}
      <p className={styles.hint}>Private round for {user?.name??'your account'}. Additional enrichment, number purchases and subscriptions are outside this pilot.</p>
    </>}
  </div>;
}
