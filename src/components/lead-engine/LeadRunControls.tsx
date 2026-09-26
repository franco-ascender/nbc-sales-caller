'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Clock3,Loader2,Pause,Play,Plus,Sparkles} from 'lucide-react';
import {cyclePresentation,parseCycleInput,type LeadCycle} from '@/lib/lead-cycle';
import type {PilotView} from '@/lib/live-pilot';
import styles from './LeadRunControls.module.css';
interface View {runs:LeadCycle[];pilot:PilotView}
const money=(cents:number)=>'$'+(cents/100).toFixed(2);
const phrases=['Working on your list…','Connecting the dots…','Good leads take a little digging.','Sipping a virtual piña colada…','Keeping an eye on every detail.'];
const labels=['Discover','Filter','Research','Verify','Deliver'];
export function LeadRunControls({token,pilot,selectedKey,onUpdate}:{token:string;pilot:PilotView;selectedKey?:string;onUpdate:(view:PilotView,key?:string)=>void}){
 const [runs,setRuns]=useState<LeadCycle[]>([]),[open,setOpen]=useState(false),[industry,setIndustry]=useState('chiropractor'),[city,setCity]=useState('Miami'),[state,setState]=useState('FL'),[count,setCount]=useState(25),[name,setName]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[connectionPaused,setConnectionPaused]=useState(false);
 const mounted=useRef(true),stepLock=useRef(false),createLock=useRef(false),latest=useRef(runs),update=useRef(onUpdate),initial=useRef(true),requestId=useRef('');latest.current=runs;update.current=onUpdate;
 const keyName='nbc-lead-cycle-draft';
 async function request(body?:object):Promise<View|null>{
  try{const response=await fetch('/api/lead-engine/runs',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(65000)});const view=await response.json();if(!response.ok)throw Error(view.error??'Progress could not be read.');if(!mounted.current)return null;setRuns(view.runs);update.current(view.pilot);setConnectionPaused(false);return view;
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Connection interrupted.');setConnectionPaused(true);}return null;}
 }
 const requestRef=useRef(request);requestRef.current=request;
 useEffect(()=>{mounted.current=true;initial.current=true;void(async()=>{const view=await requestRef.current();if(view&&initial.current){initial.current=false;const chosen=view.runs.find(r=>r.status==='running')??view.runs[0];if(chosen)update.current(view.pilot,chosen.key);else setOpen(true);}})();return()=>{mounted.current=false;};},[token]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const timer=setInterval(()=>{if(stepLock.current||createLock.current||connectionPaused)return;const active=latest.current.find(r=>r.status==='running');if(!active)return;stepLock.current=true;setBusy('advance');void requestRef.current({action:'advance',key:active.key}).finally(()=>{stepLock.current=false;if(mounted.current)setBusy('');});},3000);return()=>clearInterval(timer);},[connectionPaused]);
 const selected=runs.find(r=>r.key===selectedKey),active=runs.find(r=>r.status==='running');
 const presentation=selected?cyclePresentation(selected,pilot.slots.find(s=>s.key===selected.key),now):null;
 const title=name.trim()||`${industry==='medspa'?'Med spa':industry==='roofing'?'Roofing':'Chiropractors'} · ${city.trim()}, ${state.toUpperCase()}`;
 function change(){setConfirmed(false);requestId.current='';try{sessionStorage.removeItem(keyName);}catch{};setError('');}
 async function start(){
  if(createLock.current)return;const payload={action:'create',requestId:requestId.current||crypto.randomUUID(),name:title,industry,city,state,count,confirmed};
  try{parseCycleInput(payload);}catch(e){setError(e instanceof Error?e.message:'Check your list details.');return;}
  createLock.current=true;setBusy('create');setError('');requestId.current=payload.requestId;
  try{sessionStorage.setItem(keyName,JSON.stringify(payload));}catch{}
  const view=await request(payload);
  if(view){setOpen(false);setConfirmed(false);update.current(view.pilot,'list-'+payload.requestId);requestId.current='';try{sessionStorage.removeItem(keyName);}catch{}}
  else{const recovered=await request();if(recovered?.runs.some(r=>r.key==='list-'+payload.requestId)){setOpen(false);update.current(recovered.pilot,'list-'+payload.requestId);}}
  createLock.current=false;if(mounted.current)setBusy('');
 }
 async function control(action:'pause'|'resume'){
  if(!selected)return;setError('');const view=await request({action,key:selected.key,...(action==='resume'?{confirmed:true}:{})});if(view)update.current(view.pilot,selected.key);
 }
 const complete=selected?.status==='completed',running=selected?.status==='running'&&!connectionPaused;
 return <div className={styles.workspace}>
  <div className={styles.toolbar}><div><strong>Your next list starts here.</strong><span>One search. Every stage, in view.</span></div><button disabled={Boolean(active)||pilot.pending} onClick={()=>{setOpen(!open);change();}}><Plus size={15}/>{open?'Close new list':'New list'}</button></div>
  {open&&<form className={styles.composer} onSubmit={e=>{e.preventDefault();void start();}}>
   <div className={styles.fields}><label>Industry<select value={industry} disabled={Boolean(busy)} onChange={e=>{setIndustry(e.target.value);change();}}><option value="chiropractor">Chiropractors</option><option value="roofing">Roofing</option><option value="medspa">Med spa</option></select></label><label>City<input value={city} disabled={Boolean(busy)} maxLength={60} onChange={e=>{setCity(e.target.value);change();}}/></label><label>State<input value={state} disabled={Boolean(busy)} maxLength={2} onChange={e=>{setState(e.target.value.toUpperCase());change();}} placeholder="FL"/></label><label>Businesses<select value={count} disabled={Boolean(busy)} onChange={e=>{setCount(Number(e.target.value));change();}}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
   <label>List name<input value={name} disabled={Boolean(busy)} maxLength={80} placeholder={title} onChange={e=>{setName(e.target.value);change();}}/></label>
   <p className={styles.quote}>Discovery reservation <b>$0.75</b> · {pilot.verification?.configured?<>Full-cycle reservation up to <b>{money(75+count*pilot.verification.unitCents!)}</b></>:'Phone verification waits for the confirmed account rate.'} · Shared allowance remaining <b>{money(pilot.availableCents)}</b></p>
   {!pilot.verification?.configured&&<p className={styles.notice}>You can start discovery now. The list will pause before paid phone checks until the account rate is confirmed. That step will need Resume.</p>}
   <label className={styles.consent}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Run this search and available checks within the existing $25 shared allowance.</label>
   <button className={styles.start} disabled={!confirmed||Boolean(busy)||Boolean(active)||pilot.pending||pilot.paused||pilot.availableCents<75}><Play size={15}/>{busy==='create'?'Saving your search…':'Start search · reserve $0.75'}</button>
  </form>}
  {error&&<div role="alert" className={styles.notice}>{error} {connectionPaused&&<button onClick={()=>{setError('');void request();}}>Reconnect to saved progress</button>}</div>}
  {selected&&presentation&&<section className={styles.progressCard} aria-label="List progress" data-running={Boolean(running)}>
   <div className={styles.progressHead}><div className={styles.orb} aria-hidden="true">{complete?<Check size={23}/>:running?<Sparkles size={23}/>:<Pause size={23}/>}</div><div><span>{selected.name}</span><h3>{connectionPaused?'Connection paused':selected.status==='waiting_rate'?'Ready for phone verification':selected.status==='needs_attention'?'This step needs a review':selected.status==='paused'?'Your progress is saved':presentation.title}</h3><p aria-hidden="true">{running?phrases[Math.floor(now/8000)%phrases.length]:complete?'Every saved result, ready to review.':'No new processing step will start while paused.'}</p></div><div className={styles.timer}><Clock3 size={14}/><time>{Math.floor(presentation.elapsed/60)}:{String(presentation.elapsed%60).padStart(2,'0')}</time><small>elapsed since start</small></div></div>
   <div className={styles.track} role="progressbar" aria-label="Workflow progress based on completed stages and phone checks" aria-valuemin={0} aria-valuemax={100} aria-valuenow={presentation.percent}><span style={{width:presentation.percent+'%'}}/></div>
   <div className={styles.estimate}><span>{presentation.eta}</span><span>{presentation.percent}% · stage-based progress</span></div>
   <ol className={styles.stages}>{labels.map((label,i)=><li key={label} data-state={presentation.index>i?'done':presentation.index===i?'current':'next'}><span>{presentation.index>i?<Check size={13}/>:presentation.index===i&&running?<Loader2 size={13} className={styles.spin}/>:i+1}</span>{label}</li>)}</ol>
   <p className={styles.message} role="status">{selected.message??'Preparing your search.'}</p>
   <div className={styles.counts}><span><b>{presentation.counts.found}</b>businesses found</span><span><b>{presentation.counts.excluded}</b>excluded</span><span><b>{presentation.counts.checked}/{presentation.counts.eligible}</b>phones checked</span><span><b>{presentation.counts.qualified}</b>phone-qualified</span></div>
   <div className={styles.actions}>{!complete&&(selected.status==='running'?<button onClick={()=>void control('pause')}><Pause size={14}/>Pause after current step</button>:<button disabled={pilot.paused||(selected.status==='waiting_rate'&&!pilot.verification?.configured)} onClick={()=>void control('resume')}><Play size={14}/>Resume saved list</button>)}<small>{complete?'Phone qualification does not confirm owner identity.':'Keep this page open for the next steps. Refreshing recovers progress; closing pauses further processing. Estimates are approximate.'}</small></div>
   <details className={styles.history}><summary>Activity · {selected.events.length} saved updates</summary><ol>{selected.events.map((event,i)=><li key={i}><time>{new Date(event.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time><span>{event.message??event.phase}</span></li>)}</ol></details>
  </section>}
 </div>;
}
