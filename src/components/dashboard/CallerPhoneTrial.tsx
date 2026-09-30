'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Phone,RefreshCw,Square} from 'lucide-react';
import {useWorkspaceAccess} from '@/components/workspace/WorkspaceAccess';
import type {PilotView} from '@/lib/live-pilot';
import {parsePhoneTrial} from '@/lib/caller-phone-trial';
import styles from './CallerPhoneTrial.module.css';
import {useCallArchive} from './CallerArchive';
const money=(n:number)=>'$'+(n/100).toFixed(2);
export function CallerPhoneTrial({initialPhone=''}:{initialPhone?:string}){
 const {token,user}=useWorkspaceAccess();const [data,setData]=useState<PilotView|null>(null),[phone,setPhone]=useState(initialPhone),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[requestId,setRequestId]=useState('');
 const archive=useCallArchive(token);
 const [bookingReady,setBookingReady]=useState(false),[booking,setBooking]=useState(false);
 useEffect(()=>{if(!token||user?.role!=='admin')return;let live=true;void fetch('/api/caller/booking/config',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(live)setBookingReady(d?.config?.enabled===true&&d?.toolsReady===true);}).catch(()=>{if(live)setBookingReady(false);});return()=>{live=false;};},[token,user?.role]);
 const [scenarios,setScenarios]=useState<Array<{id:string;title:string;createdAt?:string}>>([]),[scenarioId,setScenarioId]=useState(''),[scenarioError,setScenarioError]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{if(!token)return;let live=true;const refresh=()=>{void fetch('/api/caller/scenarios',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Saved scenarios could not load.');return r.json();}).then(b=>{if(live){setScenarios(b.scenarios??[]);setScenarioError('');}}).catch(e=>{if(live)setScenarioError(e.message);});};refresh();window.addEventListener('nbc:scenarios-updated',refresh);return()=>{live=false;window.removeEventListener('nbc:scenarios-updated',refresh);};},[token]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const lock=useRef(false),alive=useRef(true),latest=useRef(data);latest.current=data;
 const storageKey='nbc-phone-trial:'+user?.id;
 useEffect(()=>{alive.current=true;try{setRequestId(localStorage.getItem(storageKey)??'');}catch{}return()=>{alive.current=false;};},[storageKey]);
 const load=useCallback(async(action?:'start'|'sync'|'stop',key?:string)=>{
  if(!token||lock.current)return;lock.current=true;setBusy(action??'load');setError('');
  try{
   let payload:object|undefined,endpoint='/api/caller/phone-test';
   if(action==='start'){
    const id=requestId||crypto.randomUUID();parsePhoneTrial({requestId:id,phone,confirmed});setRequestId(id);try{localStorage.setItem(storageKey,id);}catch{}
    if(!window.confirm('Authorize up to $2.50 for voice usage? Maximum duration: 10 minutes. Actual usage may cost less.'+(booking?' You also authorize one real NBC meeting and its configured email/SMS confirmations at your GHL account rates. Those messaging charges are additional and are not included in the $2.50 voice cap.':'')+' Cancel starts nothing.'))return;
    payload={requestId:id,phone,confirmed,approvedMaxCents:250,...(booking?{booking:true}:{}),...(scenarioId?{scenarioId}:{})};
   }else if(action){endpoint='/api/pilot';payload={action,key};}
   const r=await fetch(endpoint,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),cache:'no-store',signal:AbortSignal.timeout(65000)});const b=await r.json();
   if(r.status===403){if(alive.current)setData(null);throw Error(b.error??'Your account does not currently have access to phone calls. Refresh to check access again.');}if(!r.ok)throw Error(b.error??'The call could not be confirmed. Refresh its status before trying again.');if(alive.current)setData(b);
  }catch(e){
   if(alive.current)setError(e instanceof Error?e.message:'Could not reach the caller.');
   // Recover the saved claim after a lost response; never repeat a dialing POST.
   if(action==='start')try{const r=await fetch('/api/caller/phone-test',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok&&alive.current)setData(await r.json());}catch{}
  }
  finally{lock.current=false;if(alive.current)setBusy('');}
 },[token,requestId,phone,confirmed,storageKey,scenarioId,booking]);
 // Typing never triggers network activity or dialing.
 const loadRef=useRef(load);loadRef.current=load;
 useEffect(()=>{if(token)void loadRef.current();},[token]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void loadRef.current();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(()=>{if(!latest.current)refresh();},15000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(timer);};},[]);
 useEffect(()=>{const timer=setInterval(()=>{const active=latest.current?.slots.find(s=>s.kind==='phone'&&s.canControl!==false&&['dispatching','running'].includes(s.state));if(active)void loadRef.current('sync',active.key);},5000);return()=>clearInterval(timer);},[]);
 const calls=data?.slots.filter(s=>s.kind==='phone'&&s.canControl!==false&&s.state!=='ready').sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''))??[];
 const chosen=data?.slots.find(s=>s.key==='dial-'+requestId&&s.canControl!==false)??calls[0];const requested=data?.slots.find(s=>s.key==='dial-'+requestId&&s.canControl!==false&&s.state!=='ready');
 useEffect(()=>{if(data?.slots.some(s=>s.key==='dial-'+requestId&&s.canControl===false)){setRequestId('');setConfirmed(false);try{localStorage.removeItem(storageKey);}catch{}}},[data,requestId,storageKey]);
 // A saved finished attempt is history, not a lock on the next recipient.
 // Keep unresolved attempts pinned to their original id to prevent duplicate calls.
 useEffect(()=>{
  if(!requested||!['completed','failed'].includes(requested.state)||busy||data?.pending)return;
  setRequestId('');setConfirmed(false);setError('');
  try{localStorage.removeItem(storageKey);}catch{}
 },[requested,busy,data?.pending,storageKey]);
 let valid=false;try{parsePhoneTrial({requestId:requestId||'00000000-0000-4000-8000-000000000000',phone,confirmed:true});valid=true;}catch{}
 const queued=chosen?.result.callStatus==='queued';
 const external=chosen?.canControl===false;
 const inCall=chosen&&['dispatching','running'].includes(chosen.state);
 const liveAsset=archive.assets.find(a=>a.resource_key===chosen?.key);
 const liveTranscript=liveAsset?.live_transcript.length?liveAsset.live_transcript:chosen?.result.transcript??[];
 const elapsed=chosen?.createdAt?Math.max(0,Math.floor((now-Date.parse(chosen.createdAt))/1000)):0;
 const today=new Date().toISOString().slice(0,10),usedToday=calls.filter(s=>s.createdAt?.startsWith(today)).length;
 const blocker=!data?'Loading the available allowance…':busy?'Updating the trial…':data.paused?'Spending is paused.':data.pending?(queued?'Your call is queued for the calling window. It has not connected yet.':external?'Another phone integration is handling this call. Waiting for its saved status.':'Finish or reconcile the current operation before another trial.'):!data.perOperationApproval&&usedToday>=3?'All three trials for today are reserved. The daily limit renews at midnight UTC.':!data.perOperationApproval&&data.availableCents<250?'Less than $2.50 remains available to reserve.':!valid?'Enter a valid US phone number (+1).':booking&&!scenarioId?'Choose a saved NBC scenario for booking.':!confirmed?'Confirm that the recipient expects this call and approve its reservation.':null;
 if(user?.role!=='admin')return <section className={styles.card} aria-label="AI phone trial"><h2>Start a conversation.</h2><p>Phone calls are currently available to administrators.</p></section>;
 function newTrial(){if(data?.pending||busy)return;setRequestId('');setConfirmed(false);setError('');try{localStorage.removeItem(storageKey);}catch{}}
 return <section className={styles.card} aria-label="AI phone trial"><header><div><span>OUTBOUND CALL</span><h2>Start a conversation.</h2><p>Enter the recipient’s number, review the scenario, and approve the call.</p></div><button disabled={Boolean(busy)} onClick={()=>void load()} aria-label="Refresh phone trial"><RefreshCw size={16}/></button></header>
 <p className={styles.hint}><a href="#booking">Booking & invitations ↗</a>{bookingReady?" · Available for this call":" · Connect NBC’s calendar to enable real booking."}</p>
 <div className={styles.budget}>{data?.perOperationApproval?<span>Pay per approved call · no cumulative trial limit</span>:<><span>Shared limit <b>{data?money(data.capCents):'…'}</b></span><span>Available to reserve <b>{data?money(data.availableCents):'…'}</b></span></>}<span>Voice usage <b>$2.50 maximum reserved</b></span></div>
 {data?.phoneEngine==='retell'&&<p className={styles.hint}>Updated phone caller · Anas’s voice · response timing and costs saved after each call.</p>}
 <div className={styles.callLayout}><div className={styles.callSetup}><div className={styles.stepTitle}><span>01</span><h3>Choose the recipient</h3></div><form onSubmit={e=>{e.preventDefault();void load('start');}}>
 <div className={styles.fields}><label>Recipient’s phone number<input type="tel" autoComplete="tel" placeholder="+1 (305) 555-0123" value={phone} maxLength={40} disabled={Boolean(requested)||Boolean(busy)||Boolean(data?.pending)} onChange={e=>{setPhone(e.target.value);setConfirmed(false);if(requestId&&data&&!data.pending&&!requested){setRequestId('');try{localStorage.removeItem(storageKey);}catch{}}}}/></label></div>
 <p className={styles.hint}>US destinations (+1) under the approved rate. Review the maximum cost before each call. Actual usage is reported after the call finishes.</p>
 <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={Boolean(requested)||Boolean(busy)} onChange={e=>setConfirmed(e.target.checked)}/>The recipient is expecting this AI test call.</label>
 <div className={styles.actions}>{requested?<button type="button" disabled={Boolean(busy)||Boolean(data?.pending)} onClick={newTrial}>Prepare another trial</button>:<button className={styles.primary} disabled={!data||!valid||!confirmed||Boolean(busy)||data.pending||data.paused||(!data.perOperationApproval&&(data.availableCents<250||usedToday>=3))}><Phone size={16}/>{busy==='start'?'Connecting…':'Start AI test call'}</button>}{chosen&&!external&&['dispatching','running'].includes(chosen.state)&&<button type="button" disabled={Boolean(busy)} onClick={()=>void load('stop',chosen.key)}><Square size={15}/>Stop call</button>}</div>
 {bookingReady&&<label className={styles.consent}><input type="checkbox" checked={booking} disabled={Boolean(busy)||Boolean(data?.pending)} onChange={e=>{setBooking(e.target.checked);setConfirmed(false);setRequestId('');try{localStorage.removeItem(storageKey);}catch{}}}/>Allow a real NBC booking and email/SMS confirmations for this call. GHL messaging charges are additional.</label>}
 </form></div><aside className={styles.callBrief}><div className={styles.stepTitle}><span>02</span><h3>Your call brief</h3></div><div className={styles.scenario}><label>Scenario<select aria-label="Call scenario" value={inCall?'__active__':scenarioId} disabled={Boolean(requested)||Boolean(busy)||Boolean(data?.pending)} onChange={e=>{setScenarioId(e.target.value);setConfirmed(false);setRequestId('');try{localStorage.removeItem(storageKey);}catch{}}}><option value="">Nalify · Garage Door Business Owner</option>{inCall&&<option value="__active__">{chosen.scenarioTitle??"Current call scenario"}</option>}{scenarios.map(s=><option key={s.id} value={s.id}>{s.title}{s.createdAt?` · ${new Date(s.createdAt).toLocaleString("en-US")}`:""}</option>)}</select></label><a href="#ai-caller">Create or edit scenarios in Conversation Lab ↗</a>{scenarioError&&<p role="alert">{scenarioError}</p>}</div><div className={styles.briefFacts}><p><span>Voice</span><strong>Anas’s voice</strong></p><p><span>Maximum duration</span><strong>10 minutes</strong></p><p><span>Maximum approved cost</span><strong>$2.50 per call</strong></p></div><p>Review the cost confirmation before dialing. Live text appears during the call. Recording, transcript and notes are saved in Archive. Usage appears in Analytics.</p></aside></div>
 {!requested&&blocker&&<p role="status" className={styles.hint}>{blocker}</p>}
 {!data?.perOperationApproval&&usedToday>=3&&<p className={styles.hint}>Today’s three trials are reserved. The daily allowance renews at midnight UTC; the total budget does not reset.</p>}
 {data?.paused&&<p className={styles.error}>Spending is paused.</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 {inCall&&external&&<p role="status" className={styles.hint}>This call was scheduled by another phone integration. This portal follows its saved status; cancellation is not connected here. The reservation remains held until its outcome is confirmed.</p>}
 {inCall&&<section className={styles.liveCall} aria-label="Active phone call"><header><div><span className={styles.liveDot}/><strong>{queued?'Queued · waiting for the calling window':liveAsset?.live_status==='ongoing'?'On the call':chosen.result.providerStatus==='ongoing'?'On the call':'Connecting / call in progress'}</strong><p>{chosen.scenarioTitle??'Nalify · Garage Door Business Owner'} · ending {chosen.destinationLast4}</p></div><time>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</time></header>{!queued&&<div className={styles.wave} aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} style={{animationDelay:`${i*.09}s`}}/>)}</div>}<p className={styles.hint}>{queued?'Elapsed waiting time · the provider has not started this call.':'Elapsed since request · Transcript updates arrive after each spoken turn, with a short delivery delay.'}</p><div className={styles.liveTranscript} aria-live="polite">{liveTranscript.length?liveTranscript.map((t,i)=><p key={i}><strong>{t.role==='agent'?'Agent':'Prospect'}:</strong> {t.message}</p>):<p>Waiting for the first transcript update…</p>}</div>{archive.error&&<p role="status">Live updates are temporarily unavailable. The call may still be active.</p>}</section>}
 {chosen&&!inCall&&<div className={styles.result}><strong>{chosen.scenarioTitle??chosen.title}</strong><p>{chosen.state==='uncertain'?'Needs reconciliation — no automatic retry':chosen.state==='completed'?'Call completed. Your recording, transcript and notes are in Archive.':chosen.result.message}</p><a href="#archive">Open call archive ↗</a>{chosen.state==='uncertain'&&<button disabled={Boolean(busy)} onClick={()=>void load('sync',chosen.key)}>Check call status</button>}</div>}
 <p className={styles.hint}>This trial does not yet book appointments or send invitations. Those require the authorized calendar connection.</p>
 </section>;
}
