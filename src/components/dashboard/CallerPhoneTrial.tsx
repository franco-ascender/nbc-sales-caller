'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Phone,RefreshCw,Square} from 'lucide-react';
import {useWorkspaceAccess} from '@/components/workspace/WorkspaceAccess';
import type {PilotView} from '@/lib/live-pilot';
import {parsePhoneTrial} from '@/lib/caller-phone-trial';
import styles from './CallerPhoneTrial.module.css';
const money=(n:number)=>'$'+(n/100).toFixed(2);
export function CallerPhoneTrial(){
 const {token,user}=useWorkspaceAccess();const [data,setData]=useState<PilotView|null>(null),[phone,setPhone]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[requestId,setRequestId]=useState(''),[available,setAvailable]=useState(true);
 const lock=useRef(false),alive=useRef(true),latest=useRef(data);latest.current=data;
 const storageKey='nbc-phone-trial:'+user?.id;
 useEffect(()=>{alive.current=true;try{setRequestId(localStorage.getItem(storageKey)??'');}catch{}return()=>{alive.current=false;};},[storageKey]);
 const load=useCallback(async(action?:'start'|'sync'|'stop',key?:string)=>{
  if(!token||lock.current)return;lock.current=true;setBusy(action??'load');setError('');
  try{
   let payload:object|undefined,endpoint='/api/caller/phone-test';
   if(action==='start'){
    const id=requestId||crypto.randomUUID();parsePhoneTrial({requestId:id,phone,confirmed});setRequestId(id);try{localStorage.setItem(storageKey,id);}catch{}
    if(!window.confirm('Authorize up to $2.50 for this AI call? Maximum duration: 10 minutes. Actual usage may cost less. Cancel starts nothing.'))return;
    payload={requestId:id,phone,confirmed,approvedMaxCents:250};
   }else if(action){endpoint='/api/pilot';payload={action,key};}
   const r=await fetch(endpoint,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),cache:'no-store',signal:AbortSignal.timeout(65000)});const b=await r.json();
   if(r.status===403){setAvailable(false);return;}if(!r.ok)throw Error(b.error??'The call could not be confirmed. Refresh its status before trying again.');if(alive.current)setData(b);
  }catch(e){
   if(alive.current)setError(e instanceof Error?e.message:'Could not reach the caller.');
   // Recover the saved claim after a lost response; never repeat a dialing POST.
   if(action==='start')try{const r=await fetch('/api/caller/phone-test',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok&&alive.current)setData(await r.json());}catch{}
  }
  finally{lock.current=false;if(alive.current)setBusy('');}
 },[token,requestId,phone,confirmed,storageKey]);
 // Typing never triggers network activity or dialing.
 const loadRef=useRef(load);loadRef.current=load;
 useEffect(()=>{if(token)void loadRef.current();},[token]);
 useEffect(()=>{const timer=setInterval(()=>{const active=latest.current?.slots.find(s=>s.kind==='phone'&&['dispatching','running'].includes(s.state));if(active)void loadRef.current('sync',active.key);},5000);return()=>clearInterval(timer);},[]);
 const calls=data?.slots.filter(s=>s.kind==='phone'&&s.state!=='ready').sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''))??[];
 const chosen=data?.slots.find(s=>s.key==='dial-'+requestId)??calls[0];const requested=data?.slots.find(s=>s.key==='dial-'+requestId&&s.state!=='ready');
 // A saved finished attempt is history, not a lock on the next recipient.
 // Keep unresolved attempts pinned to their original id to prevent duplicate calls.
 useEffect(()=>{
  if(!requested||!['completed','failed'].includes(requested.state)||busy||data?.pending)return;
  setRequestId('');setConfirmed(false);setError('');
  try{localStorage.removeItem(storageKey);}catch{}
 },[requested,busy,data?.pending,storageKey]);
 let valid=false;try{parsePhoneTrial({requestId:requestId||'00000000-0000-4000-8000-000000000000',phone,confirmed:true});valid=true;}catch{}
 const today=new Date().toISOString().slice(0,10),usedToday=calls.filter(s=>s.createdAt?.startsWith(today)).length;
 const blocker=!data?'Loading the available allowance…':busy?'Updating the trial…':data.paused?'Spending is paused.':data.pending?'Finish or reconcile the current operation before another trial.':!data.perOperationApproval&&usedToday>=3?'All three trials for today are reserved. The daily limit renews at midnight UTC.':!data.perOperationApproval&&data.availableCents<250?'Less than $2.50 remains available to reserve.':!valid?'Enter a valid US phone number (+1).':!confirmed?'Confirm that the recipient expects this call and approve its reservation.':null;
 if(user?.role!=='admin'||!available)return null;
 function newTrial(){if(data?.pending||busy)return;setRequestId('');setConfirmed(false);setError('');try{localStorage.removeItem(storageKey);}catch{}}
 return <section className={styles.card} aria-label="AI phone trial"><header><div><span>OUTBOUND CALL</span><h2>Start a conversation.</h2><p>Enter the recipient’s number, review the scenario, and approve the call.</p></div><button disabled={Boolean(busy)} onClick={()=>void load()} aria-label="Refresh phone trial"><RefreshCw size={16}/></button></header>
 <div className={styles.budget}>{data?.perOperationApproval?<span>Pay per approved call · no cumulative trial limit</span>:<><span>Shared limit <b>{data?money(data.capCents):'…'}</b></span><span>Available to reserve <b>{data?money(data.availableCents):'…'}</b></span></>}<span>Per call <b>$2.50 maximum reserved</b></span></div>
 {data?.phoneEngine==='retell'&&<p className={styles.hint}>Updated phone caller · Anas’s voice · response timing and costs saved after each call.</p>}
 <div className={styles.callLayout}><div className={styles.callSetup}><div className={styles.stepTitle}><span>01</span><h3>Choose the recipient</h3></div><form onSubmit={e=>{e.preventDefault();void load('start');}}>
 <div className={styles.fields}><label>Recipient’s phone number<input type="tel" autoComplete="tel" placeholder="+1 (305) 555-0123" value={phone} maxLength={40} disabled={Boolean(requested)||Boolean(busy)||Boolean(data?.pending)} onChange={e=>{setPhone(e.target.value);setConfirmed(false);if(requestId&&data&&!data.pending&&!requested){setRequestId('');try{localStorage.removeItem(storageKey);}catch{}}}}/></label></div>
 <p className={styles.hint}>US destinations (+1) under the approved rate. Review the maximum cost before each call. Actual usage is reported after the call finishes.</p>
 <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={Boolean(requested)||Boolean(busy)} onChange={e=>setConfirmed(e.target.checked)}/>The recipient is expecting this AI test call.</label>
 <div className={styles.actions}>{requested?<button type="button" disabled={Boolean(busy)||Boolean(data?.pending)} onClick={newTrial}>Prepare another trial</button>:<button className={styles.primary} disabled={!data||!valid||!confirmed||Boolean(busy)||data.pending||data.paused||(!data.perOperationApproval&&(data.availableCents<250||usedToday>=3))}><Phone size={16}/>{busy==='start'?'Connecting…':'Start AI test call'}</button>}{chosen&&['dispatching','running'].includes(chosen.state)&&<button type="button" disabled={Boolean(busy)} onClick={()=>void load('stop',chosen.key)}><Square size={15}/>Stop call</button>}</div>
 </form></div><aside className={styles.callBrief}><div className={styles.stepTitle}><span>02</span><h3>Your call brief</h3></div><div className={styles.scenario}><span>Scenario</span><strong>Nalify · Garage Door Business Owner</strong><small>$2,500/month offer · up to 10 minutes</small></div><div className={styles.briefFacts}><p><span>Voice</span><strong>Anas’s voice</strong></p><p><span>Maximum duration</span><strong>10 minutes</strong></p><p><span>Maximum approved cost</span><strong>$2.50 per call</strong></p></div><p>Review the cost confirmation before dialing. Your transcript and reported usage appear below after the call.</p></aside></div>
 {!requested&&blocker&&<p role="status" className={styles.hint}>{blocker}</p>}
 {!data?.perOperationApproval&&usedToday>=3&&<p className={styles.hint}>Today’s three trials are reserved. The daily allowance renews at midnight UTC; the total budget does not reset.</p>}
 {data?.paused&&<p className={styles.error}>Spending is paused.</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 {chosen&&chosen.state!=='ready'&&<div className={styles.result}><div><strong>{chosen.title}</strong><span role="status">{chosen.state==='uncertain'?'Needs reconciliation — no automatic retry':chosen.state==='running'?'Calling / connected':chosen.state==='dispatching'?'Connecting':chosen.state}</span><button disabled={Boolean(busy)} onClick={()=>void load('sync',chosen.key)}>Update saved result</button></div>{chosen.result.message&&<p>{chosen.result.message}</p>}{chosen.result.phoneEngine==='retell'&&<p>Reported usage: {chosen.result.retellCostMicrousd==null?'Pending receipt':'$'+(chosen.result.retellCostMicrousd/1e6).toFixed(4)}{chosen.result.latency?` · Response median ${(chosen.result.latency.p50Ms/1000).toFixed(2)}s · p95 ${(chosen.result.latency.p95Ms/1000).toFixed(2)}s`:''}</p>}{Boolean(chosen.result.transcript?.length)&&<details><summary>Read saved transcript · {chosen.result.durationSeconds??'—'} seconds</summary>{chosen.result.transcript?.map((t,i)=><p key={i}><strong>{t.role==='agent'?'Nalify':'Prospect'}: </strong>{t.message}</p>)}</details>}</div>}
 <p className={styles.hint}>This trial does not yet book appointments or send invitations. Those require the authorized calendar connection.</p>
 </section>;
}
