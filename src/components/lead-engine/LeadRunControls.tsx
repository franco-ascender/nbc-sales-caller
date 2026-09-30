'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Clock3,Loader2,Pause,Play,Plus,Sparkles} from 'lucide-react';
import {cyclePresentation,parseCycleInput,type LeadCycle} from '@/lib/lead-cycle';
import type {SearchQuote} from '@/lib/lead-cycle-quote';
import type {PilotView} from '@/lib/live-pilot';
import styles from './LeadRunControls.module.css';
import {CYCLE_NICHES,cycleNiche} from '@/lib/lead-cycle-niches';
interface View {runs:LeadCycle[];pilot:PilotView}
const money=(cents:number)=>'$'+(cents/100).toFixed(2);
const phrases=['Working on your list…','Connecting the dots…','Good leads take a little digging.','Sipping a virtual piña colada…','Keeping an eye on every detail.'];
const labels=['Discover','Filter','Research','Verify','Deliver'];
export function LeadRunControls({token,pilot,selectedKey,onUpdate}:{token:string;pilot:PilotView;selectedKey?:string;onUpdate:(view:PilotView,key?:string)=>void}){
 const [runs,setRuns]=useState<LeadCycle[]>([]),[open,setOpen]=useState(true),[industry,setIndustry]=useState('chiropractor'),[scope,setScope]=useState('city'),[city,setCity]=useState('Miami'),[state,setState]=useState('FL'),[count,setCount]=useState(25),[name,setName]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[connectionPaused,setConnectionPaused]=useState(false);
 const [quote,setQuote]=useState<SearchQuote|null>(null);
 const mounted=useRef(true),stepLock=useRef(false),createLock=useRef(false),latest=useRef(runs),update=useRef(onUpdate),initial=useRef(true),requestId=useRef('');latest.current=runs;update.current=onUpdate;
 const keyName='nbc-lead-cycle-draft';
 async function request(body?:object):Promise<View|null>{
  try{const response=await fetch('/api/lead-engine/runs',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(65000)});const view=await response.json();if(!response.ok)throw Error(view.error??'Progress could not be read.');if(!mounted.current)return null;setRuns(view.runs);update.current(view.pilot);setConnectionPaused(false);return view;
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Connection interrupted.');setConnectionPaused(true);}return null;}
 }
 const requestRef=useRef(request);requestRef.current=request;
 useEffect(()=>{mounted.current=true;initial.current=true;void(async()=>{const view=await requestRef.current();if(view&&initial.current){initial.current=false;const chosen=view.runs.find(r=>r.status==='running')??view.runs[0];if(chosen)update.current(view.pilot,chosen.key);setOpen(!view.runs.some(r=>r.status==='running'));}})();return()=>{mounted.current=false;};},[token]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const timer=setInterval(()=>{if(stepLock.current||createLock.current||connectionPaused)return;const active=latest.current.find(r=>r.status==='running');if(!active)return;stepLock.current=true;setBusy('advance');void requestRef.current({action:'advance',key:active.key}).finally(()=>{stepLock.current=false;if(mounted.current)setBusy('');});},3000);return()=>clearInterval(timer);},[connectionPaused]);
 const selected=runs.find(r=>r.key===selectedKey),active=runs.find(r=>r.status==='running');
 const presentation=selected?cyclePresentation(selected,pilot.slots.find(s=>s.key===selected.key),now):null;
 const title=name.trim()||`${cycleNiche(industry)?.title??'Businesses'} · ${scope==='nationwide'?'Nationwide · US':scope==='state'?state.toUpperCase():`${city.trim()}, ${state.toUpperCase()}`}`;
 function change(){setQuote(null);requestId.current='';try{sessionStorage.removeItem(keyName);}catch{};setError('');}
 function payload(){return {action:'create',requestId:requestId.current||crypto.randomUUID(),name:title,industry,city:scope==='city'?city:'',state:scope==='nationwide'?'':state,count,confirmed:true};}
 async function reviewCost(){
  if(createLock.current)return;const input=payload();
  try{parseCycleInput(input);}catch(e){setError(e instanceof Error?e.message:'Check list details.');return;}
  createLock.current=true;setBusy('quote');setError('');
  try{const r=await fetch('/api/lead-engine/runs/quote',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});const data=await r.json();if(!r.ok)throw Error(data.error??'Pricing could not be confirmed.');if(mounted.current)setQuote(data);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Pricing unavailable.');}
  finally{createLock.current=false;if(mounted.current)setBusy('');}
 }
 async function start(){
  if(createLock.current||!quote||quote.blockers.length)return;
  if(Date.parse(quote.expiresAt)<=Date.now()){setQuote(null);setError('This estimate expired. Review the current price before starting.');return;}
  const input={...payload(),approvedMaxCents:quote.maximumCents,quoteToken:quote.token};
  createLock.current=true;setBusy('create');setError('');requestId.current=input.requestId;
  try{sessionStorage.setItem(keyName,JSON.stringify(input));}catch{}
  const view=await request(input);
  if(view){setOpen(false);update.current(view.pilot,'list-'+input.requestId);requestId.current='';try{sessionStorage.removeItem(keyName);}catch{}}
  else{const recovered=await request();if(recovered?.runs.some(r=>r.key==='list-'+input.requestId)){setOpen(false);update.current(recovered.pilot,'list-'+input.requestId);}}
  createLock.current=false;if(mounted.current)setBusy('');
 }
 async function control(action:'pause'|'resume'){
  if(!selected)return;setError('');const view=await request({action,key:selected.key,...(action==='resume'?{confirmed:true}:{})});if(view)update.current(view.pilot,selected.key);
 }
 const complete=selected?.status==='completed',running=selected?.status==='running'&&!connectionPaused;
 return <div className={styles.workspace}>
  <div className={styles.toolbar}><div><strong>Define your search.</strong><span>Choose a market, review the maximum cost, then start.</span></div><button disabled={Boolean(active)||pilot.pending} onClick={()=>{setOpen(!open);change();}}><Plus size={15}/>{open?'Hide search form':'New search'}</button></div>
  {open&&<form className={styles.composer} onSubmit={e=>{e.preventDefault();void (quote?start():reviewCost());}}>
   <div className={styles.formMain}><div className={styles.stepTitle}><span>01</span><div><h3>Choose your market</h3><p>Start with a business type and where you want to search.</p></div></div><div className={styles.fields}><label>Industry · {CYCLE_NICHES.length} niches<select value={industry} disabled={Boolean(busy)} onChange={e=>{setIndustry(e.target.value);change();}}>{CYCLE_NICHES.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label><label>Search area<select aria-label="Search area" value={scope} disabled={Boolean(busy)} onChange={e=>{setScope(e.target.value);change();}}><option value="nationwide">Nationwide · United States</option><option value="state">Statewide</option><option value="city">City</option></select></label>{scope==='city'&&<label>City<input value={city} disabled={Boolean(busy)} maxLength={60} onChange={e=>{setCity(e.target.value);change();}}/></label>}{scope!=='nationwide'&&<label>State<input value={state} disabled={Boolean(busy)} maxLength={2} onChange={e=>{setState(e.target.value.toUpperCase());change();}} placeholder="FL"/></label>}</div><div className={styles.stepTitle}><span>02</span><div><h3>Size your list</h3><p>This is the number of businesses to research, before phone checks.</p></div></div><div className={styles.fields}><label>Businesses<select value={count} disabled={Boolean(busy)} onChange={e=>{setCount(Number(e.target.value));change();}}>{[10,25,50,100,250,500,1000,2500,5000].map(n=><option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label></div>
   <label>List name <small>(optional)</small><input value={name} disabled={Boolean(busy)} maxLength={80} placeholder={title} onChange={e=>{setName(e.target.value);change();}}/></label>
   </div><aside className={styles.review}><div className={styles.stepTitle}><span>03</span><div><h3>Review & start</h3><p>You approve the maximum before we run.</p></div></div><strong className={styles.searchName}>{title}</strong><p className={styles.quote}>Up to {count.toLocaleString('en-US')} business listings; the number of verified mobile contacts may be lower. Nationwide searches are samples, not guaranteed coverage of every state.</p>
   {quote?<div className={styles.priceCard} aria-label="Search cost estimate">
    <span>Estimated for the full requested list</span><strong>{money(quote.estimatedTotalCents)}</strong>
    <dl><div><dt>Business discovery</dt><dd>{money(quote.discoveryEstimateCents)}</dd></div><div><dt>Phone verification · up to {count}</dt><dd>{money(quote.verificationMaxCents)}</dd></div><div><dt>Data delivery & storage allowance</dt><dd>{money(quote.dataAllowanceCents)}</dd></div><div><dt>Maximum approved processing budget</dt><dd>{money(quote.maximumCents)}</dd></div></dl>
    <p>Based on current account rates. Only eligible, unique numbers need new checks. Fewer results or reusable checks reduce the cost. A verified mobile count is not guaranteed.</p>
    <p>The search account requires a minimum spending cap; it is not a minimum charge. Data delivery and provider retention are estimated. Monthly plans, taxes and unrelated usage are excluded.</p>
    <small>Rates checked {new Date(quote.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · approval valid for 15 minutes.</small>
    {quote.blockers.map(b=><p key={b} role="alert" className={styles.notice}>{b}</p>)}
   </div>:<p className={styles.quote}>Get a current estimate for discovery, phone checks and data delivery. No search starts until you approve.</p>}
   <button className={styles.start} disabled={Boolean(busy)||Boolean(active)||pilot.pending||pilot.paused||!!quote?.blockers.length}><Play size={15}/>{busy==='quote'?'Checking current prices…':busy==='create'?'Saving your search…':quote?`Approve up to ${money(quote.maximumCents)} & start`:'Review cost'}</button>
   {quote&&<button type="button" onClick={()=>setQuote(null)}>Back to list details</button>}

  </aside></form>}
  {error&&<div role="alert" className={styles.notice}>{error} {connectionPaused&&<button onClick={()=>{setError('');void request();}}>Reconnect to saved progress</button>}</div>}
  {selected&&presentation&&<section className={styles.progressCard} aria-label="List progress" data-running={Boolean(running)} data-complete={complete}>
   <div className={styles.progressHead}><div className={styles.orb} aria-hidden="true">{complete?<Check size={23}/>:running?<Sparkles size={23}/>:<Pause size={23}/>}</div><div><span>{selected.name}</span><h3>{complete?'Done! Your list is ready':connectionPaused?'Connection paused':selected.status==='waiting_rate'?'Ready for phone verification':selected.status==='needs_attention'?'This step needs a review':selected.status==='paused'?'Your progress is saved':presentation.title}</h3><p aria-hidden="true">{running?phrases[Math.floor(now/8000)%phrases.length]:complete?'Every saved result, ready to review.':'No new processing step will start while paused.'}</p></div><div className={styles.timer}><Clock3 size={14}/><time>{Math.floor(presentation.elapsed/60)}:{String(presentation.elapsed%60).padStart(2,'0')}</time><small>elapsed since start</small></div></div>
   <div className={styles.track} role="progressbar" aria-label="Workflow progress based on completed stages and phone checks" aria-valuemin={0} aria-valuemax={100} aria-valuenow={presentation.percent}><span style={{width:presentation.percent+'%'}}/></div>
   <div className={styles.estimate}><span>{presentation.eta}</span><span>{presentation.percent}% · stage-based progress</span></div>
   <ol className={styles.stages}>{labels.map((label,i)=><li key={label} data-state={presentation.index>i?'done':presentation.index===i?'current':'next'}><span>{presentation.index>i?<Check size={13}/>:presentation.index===i&&running?<Loader2 size={13} className={styles.spin}/>:i+1}</span>{label}</li>)}</ol>
   <p className={styles.message} role="status">{selected.message??'Preparing your search.'}</p>
   <div className={styles.counts}><span><b>{presentation.counts.found}</b>businesses found</span><span><b>{presentation.counts.excluded}</b>excluded</span><span><b>{presentation.counts.checked}/{presentation.counts.eligible}</b>phones checked</span><span><b>{presentation.counts.qualified}</b>phone-qualified</span></div>
   <div className={styles.actions}>{complete&&<a href="#lists">Open Lead Lists ↗</a>}{!complete&&(selected.status==='running'?<button onClick={()=>void control('pause')}><Pause size={14}/>Pause after current step</button>:<button disabled={pilot.paused||(selected.status==='waiting_rate'&&!pilot.verification?.configured)} onClick={()=>void control('resume')}><Play size={14}/>Resume saved list</button>)}<small>{complete?'Phone qualification does not confirm owner identity.':'Keep this page open for the next steps. Refreshing recovers progress; closing pauses further processing. Estimates are approximate.'}</small></div>
   <details className={styles.history}><summary>Activity · {selected.events.length} saved updates</summary><ol>{selected.events.map((event,i)=><li key={i}><time>{new Date(event.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time><span>{event.message??event.phase}</span></li>)}</ol></details>
  </section>}
 </div>;
}
