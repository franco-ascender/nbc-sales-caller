'use client';
import { useEffect, useRef, useState } from 'react';
import { Folder, FolderPlus, ListFilter, Play, RefreshCw, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { LeadEngineError } from '@/lib/lead-engine-storage';
import { estimateScrapeCost, belowProviderMinimum, PROVIDER_MIN_CHARGE_CENTS } from '@/lib/lead-engine-cost';
import { LEAD_LIMITS } from '@/lib/lead-engine-plan';
import type { LeadFolder, LeadList, LeadListPage, ScrapeQuote } from '@/lib/lead-engine-scrape';
import type { LeadScrapeWorkspaceProps } from './LeadScrapeWorkspace.types';
import styles from './LeadScrapeWorkspace.module.css';
import { LeadConfidence } from './LeadConfidence';
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
// The only discovery provider the applied schema supports today; it moves onto the quote contract
// when the provider column lands alongside Outscraper.
const DISCOVERY_TOOL='Apify';
const statusLabel:Record<string,string>={prepared:'Approved · awaiting start',dispatching:'Start pending reconciliation',running:'Scraping businesses',succeeded:'Scrape finished',failed:'Provider stopped · review required',uncertain:'Needs reconciliation'};
const blockers:Record<string,string>={execution_not_connected:'Scraper activation is pending integration.',provider_access_pending:'The scraper account is not configured.',balance_check_required:'A current provider balance needs verification.',provider_balance_exceeded:'The provider balance is insufficient.',forecast_over_budget:'The planning forecast exceeds your budget.',hard_budget_exceeded:'Existing reservations leave insufficient budget.',pilot_cap_exceeded:'The cumulative pilot limit would be exceeded.',stop_loss_triggered:'A previous run needs reconciliation.',quote_expired:'This quote has expired.',plan_paused:'The saved plan is paused.',lane_paused:'This workflow needs its own pilot.'};
export function LeadScrapeWorkspace({token,plan,savedMatches,mode,onAccessDenied,storageUnavailable,onStorageChange}:LeadScrapeWorkspaceProps){
  const [folders,setFolders]=useState<LeadFolder[]>([]),[folderName,setFolderName]=useState(''),[folderFilter,setFolderFilter]=useState('all');
  const [destination,setDestination]=useState(''),[name,setName]=useState(''),[count,setCount]=useState('50');
  const [lists,setLists]=useState<LeadList[]|null>(null),[next,setNext]=useState<number|null>(null),[offset,setOffset]=useState(0);
  const [detail,setDetail]=useState<LeadListPage|null>(null),[recordOffset,setRecordOffset]=useState(0),[quote,setQuote]=useState<ScrapeQuote|null>(null);
  const [notice,setNotice]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(''),[now,setNow]=useState(Date.now());
  const epoch=useRef(0),active=useRef(false),dialog=useRef<HTMLDialogElement>(null),reviewButton=useRef<HTMLButtonElement>(null);
  const quoteAttempt=useRef<{key:string;id:string}|null>(null),folderAttempt=useRef<{name:string;id:string}|null>(null);
  const effectiveName=name.trim()||`${plan?.input.industry??'Business'} · ${plan?.input.metro??'New search'}`.slice(0,80);
  // Measured yield: 187 callable contacts per 1,000 businesses scraped (build spec §2).
  const businessesForGoal=plan?Math.max(1,Math.ceil(plan.input.target*1000/187)):0;
  // The operator already stated the goal on the plan; deriving this stops the second, unexplained ask.
  useEffect(()=>{if(plan)setCount(String(Math.min(LEAD_LIMITS.pilotBusinesses,businessesForGoal)));},[plan?.id]);
  const fingerprint=JSON.stringify([plan?.id,savedMatches,count,destination,effectiveName]);const latest=useRef(fingerprint);latest.current=fingerprint;
  useEffect(()=>()=>{epoch.current++;dialog.current?.close();},[]);
  useEffect(()=>{setQuote(null);},[fingerprint,mode]);
  useEffect(()=>{if(quote){dialog.current?.showModal();setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{clearInterval(timer);dialog.current?.close();};}dialog.current?.close();},[quote]);
  async function api<T>(path:string,body?:object):Promise<T>{
    const response=await fetch(`/api/lead-engine${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(45000)});
    const data=await response.json();if(!response.ok)throw new LeadEngineError(response.status,data.code??'research_unavailable',data.error??'Research could not be updated.');return data as T;
  }
  async function run(label:string,fn:(current:()=>boolean)=>Promise<void>):Promise<void>{
    if(active.current)return;active.current=true;const version=epoch.current;const current=()=>version===epoch.current;
    setBusy(label);setNotice('');setCode('');
    try{await fn(current);}catch(e){if(current()){if(e instanceof LeadEngineError&&e.code==='storage_pending'){onStorageChange(true);setNotice('');setCode('');return;}setNotice(e instanceof LeadEngineError?e.message:'The request did not finish. Refresh the existing list before starting again.');setCode(e instanceof LeadEngineError?e.code:'research_unavailable');if(e instanceof LeadEngineError&&[401,403].includes(e.status))onAccessDenied(e.status);}}
    finally{active.current=false;if(current())setBusy('');}
  }
  async function load(at:number,filter:string,current:()=>boolean):Promise<void>{
    const [group,page]=await Promise.all([api<{folders:LeadFolder[]}>('/folders'),api<{lists:LeadList[];nextOffset:number|null}>(`/lists?offset=${at}${filter==='all'?'':`&folder=${encodeURIComponent(filter)}`}`)]);
    if(current()){onStorageChange(false);setFolders(group.folders);setLists(page.lists);setNext(page.nextOffset);setOffset(at);setFolderFilter(filter);}
  }
  useEffect(()=>{if(mode==='lists')void run('Loading lists…',current=>load(0,folderFilter,current));},[mode]);
  function review():void{
    if(!plan||!savedMatches||storageUnavailable)return;
    if(quoteAttempt.current?.key!==fingerprint)quoteAttempt.current={key:fingerprint,id:crypto.randomUUID()};const attempt=quoteAttempt.current;
    void run('Getting a verified estimate…',async current=>{
      const result=await api<{quote:ScrapeQuote}>('/quotes',{version:1,quoteId:attempt.id,planId:plan.id,folderId:destination||null,name:effectiveName,count:Number(count)});
      if(current()&&latest.current===attempt.key)setQuote(result.quote);
    });
  }
  function closeQuote():void{setQuote(null);reviewButton.current?.focus();}
  const expired=quote?now>=Date.parse(quote.expiresAt):false;
  function approve(id:string):void{void run('Starting your approved scrape…',async current=>{
    const result=await api<LeadListPage>(`/quotes/${id}/approve`,{});if(current()){setDetail(result);setRecordOffset(0);setQuote(null);setNotice('Your approved search is saved. Refresh results to follow this same run.');}
    await load(0,folderFilter,current);
  });}
  return <section className={styles.workspace} aria-busy={Boolean(busy)} aria-label="Scrapes and lead lists">
    <div hidden={mode!=='search'}>
      <div className={styles.heading}><span className={styles.mark}><Play size={19}/></span><div><span className={styles.eyebrow}>REVIEW BEFORE YOU RUN</span><h3 id="scrape-cost-title" tabIndex={-1}>Your next scrape</h3><p>See the current discovery price, then decide. Nothing starts while you review.</p></div></div>
      <div className={styles.preflight}>
        <label>List name<input maxLength={80} value={name} placeholder={effectiveName} onChange={e=>setName(e.target.value)}/></label>
        <label>Businesses to discover<input type="number" min="1" max={LEAD_LIMITS.pilotBusinesses} step="1" value={count} onChange={e=>setCount(e.target.value)}/>{plan&&<small>{businessesForGoal.toLocaleString('en-US')} needed for your {plan.input.target.toLocaleString('en-US')}-contact goal; one pilot batch is capped at {LEAD_LIMITS.pilotBusinesses}.</small>}</label>
        <label>Save in folder<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Unfiled</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      </div>
      <div className={styles.actionRow}><p>{!savedMatches?'Save the current search brief above before requesting its price.':'The estimate covers business discovery. Owner research and phone verification are separate stages.'}</p><button ref={reviewButton} type="button" className={styles.primary} onClick={review} disabled={storageUnavailable||!savedMatches||!plan||Boolean(busy)||!/^\d+$/.test(count)||Number(count)<1||Number(count)>300}>Review scrape cost<ArrowRight size={16}/></button></div>
      <button type="button" className={styles.textButton} disabled={Boolean(busy)} onClick={()=>void run('Loading folders…',current=>load(0,folderFilter,current))}>Load saved folders</button>
    </div>
    <div hidden={mode!=='lists'}>
      <div className={styles.heading}><span className={styles.mark}><Folder size={21}/></span><div><span className={styles.eyebrow}>YOUR RESEARCH LIBRARY</span><h3>Lead lists</h3><p>Keep each search in its own list. Organize by market, industry or project.</p></div><button type="button" disabled={Boolean(busy)} onClick={()=>void run('Loading lists…',current=>load(0,folderFilter,current))}><RefreshCw size={15}/>Refresh lists</button></div>
      <form className={styles.folderForm} onSubmit={event=>{event.preventDefault();if(storageUnavailable)return;const clean=folderName.trim();if(!clean)return;if(folderAttempt.current?.name!==clean)folderAttempt.current={name:clean,id:crypto.randomUUID()};const attempt=folderAttempt.current;
        void run('Creating folder…',async current=>{const result=await api<{folder:LeadFolder}>('/folders',{id:attempt.id,name:attempt.name});if(current()){setFolderName('');setDestination(result.folder.id);setNotice('Folder saved.');}await load(0,result.folder.id,current);});}}>
        <FolderPlus size={19}/><label>New folder<input disabled={storageUnavailable||Boolean(busy)} value={folderName} onChange={e=>setFolderName(e.target.value)} maxLength={80} placeholder="e.g. Charlotte · Home services" required/></label><button type="submit" disabled={storageUnavailable||Boolean(busy)||!folderName.trim()}>Create folder</button>
      </form>
      <div className={styles.chips} aria-label="Filter lists by folder">{[{id:'all',name:'All lists'},{id:'unfiled',name:'Unfiled'},...folders].map(folder=><button type="button" key={folder.id} aria-pressed={folderFilter===folder.id} disabled={Boolean(busy)} onClick={()=>void run('Opening folder…',current=>load(0,folder.id,current))}><Folder size={14}/>{folder.name}</button>)}</div>
      {lists===null?<div className={styles.empty}><ListFilter size={30}/><h4>{storageUnavailable?'Your lists will appear here':'Open your saved research'}</h4><p>{storageUnavailable?'You can organize your leads here once saving is available.':'Refresh lists to load your private folders and searches.'}</p></div>:lists.length===0?<div className={styles.empty}><Folder size={30}/><h4>No lists in this folder yet</h4><p>An approved scrape creates a list here. A folder alone never starts a job.</p></div>:<div className={styles.listGrid}>{lists.map(list=><button type="button" key={list.id} className={styles.listCard} disabled={Boolean(busy)} onClick={()=>void run('Opening list…',async current=>{const result=await api<LeadListPage>(`/lists/${list.id}`);if(current()){setDetail(result);setRecordOffset(0);}})}><Folder size={23}/><strong>{list.name}</strong><span>{list.importStatus==='complete'?'Results saved':statusLabel[list.status]??'Status needs review'}</span><small>{list.processed} business records processed · verification pending</small><ArrowRight size={17}/></button>)}</div>}
      {lists!==null&&<div className={styles.pagination}><button type="button" disabled={offset===0||Boolean(busy)} onClick={()=>void run('Loading lists…',current=>load(Math.max(0,offset-20),folderFilter,current))}>Previous lists</button><button type="button" disabled={next===null||Boolean(busy)} onClick={()=>void run('Loading lists…',current=>load(next!,folderFilter,current))}>Next lists</button></div>}
    </div>
    {busy&&<p role="status">{busy}</p>}
    {notice&&<div className={code?styles.error:styles.notice} role="status">{code==='pricing_pending'&&<strong>Pricing pending setup</strong>}<p>{notice}</p></div>}
    {detail&&<section className={styles.results} aria-label="Opened lead list"><div className={styles.heading}><div><span className={styles.eyebrow}>SAVED RESEARCH</span><h3>{detail.list.name}</h3><p>{detail.list.importStatus==='complete'?'Results saved':statusLabel[detail.list.status]??'Status needs review'} · {detail.list.processed} / up to {detail.list.maxResults} records processed</p></div><button type="button" disabled={Boolean(busy)} onClick={()=>void run('Refreshing saved results…',async current=>{const result=await api<LeadListPage>(`/lists/${detail.list.id}/sync`,{});if(current()){setDetail(result);setRecordOffset(0);}})}><RefreshCw size={15}/>Refresh results</button></div>
      <div className={styles.resultMeta}><span>{money(detail.list.reservedCents)} reserved · {money(detail.list.consumedCents)} settled</span><label>Move list to<select aria-label="Move list to folder" value={detail.list.folderId??''} disabled={Boolean(busy)} onChange={event=>{const target=event.target.value;void run('Moving list…',async current=>{await api(`/lists/${detail.list.id}/move`,{folderId:target||null});const result=await api<LeadListPage>(`/lists/${detail.list.id}`);if(current()){setDetail(result);setRecordOffset(0);setNotice('List moved. Global duplicate and suppression checks are unchanged.');}await load(offset,folderFilter,current);});}}><option value="">Unfiled</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label></div>
      <p className={styles.disclaimer}><ShieldCheck size={16}/>Business discovery only. Owner identity and mobile checks are pending. Phone numbers remain hidden; this is not a calling list. Reserved funds await cost reconciliation.</p>
      {detail.list.status==='prepared'&&<button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={()=>approve(detail.list.id)}>Retry approved start</button>}
      {detail.records.length===0?<p>No saved records on this page. Refresh results to follow the existing run.</p>:<div className={styles.tableScroll}><table><thead><tr><th>Business</th><th>Location</th><th>Sources</th><th>Confidence</th><th>Review status</th></tr></thead><tbody>{detail.records.map(row=><tr key={row.position}><td>{row.name||'Incomplete business record'}</td><td>{[row.city,row.state].filter(Boolean).join(', ')||'Unconfirmed'}</td><td>{row.sourceUrl&&<a href={row.sourceUrl} target="_blank" rel="noreferrer">Listing</a>}{row.website&&<a href={row.website} target="_blank" rel="noreferrer">Website</a>}</td><td><LeadConfidence confidence={row.confidence}/></td><td>{row.reviewStatus==='verification_pending'?'Owner & phone checks pending':row.reviewStatus.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>}
      <div className={styles.pagination}><button type="button" disabled={recordOffset===0||Boolean(busy)} onClick={()=>void run('Loading records…',async current=>{const at=Math.max(0,recordOffset-50),result=await api<LeadListPage>(`/lists/${detail.list.id}?offset=${at}`);if(current()){setDetail(result);setRecordOffset(at);}})}>Previous records</button><button type="button" disabled={detail.nextOffset===null||Boolean(busy)} onClick={()=>void run('Loading records…',async current=>{const at=detail.nextOffset!,result=await api<LeadListPage>(`/lists/${detail.list.id}?offset=${at}`);if(current()){setDetail(result);setRecordOffset(at);}})}>Next records</button></div>
    </section>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="scrape-approval-title" onCancel={event=>{event.preventDefault();if(!busy)closeQuote();}}>
      {quote&&<><div className={styles.dialogTop}><span className={styles.eyebrow}>COST REVIEW · NOTHING HAS STARTED</span><button type="button" aria-label="Close cost review" disabled={Boolean(busy)} onClick={closeQuote}><X size={19}/></button></div><h2 id="scrape-approval-title">Approve this scrape?</h2><p>{quote.name} · up to {quote.maxResults} businesses</p><div className={styles.cost}><span>Estimated discovery cost</span><strong>{money(quote.minCostCents)}–{money(quote.maxCostCents)}</strong><span>Maximum approved spend: {money(quote.maxCostCents)}</span></div>{(()=>{const cost=estimateScrapeCost({businesses:quote.maxResults,discoveryTool:DISCOVERY_TOOL,discoveryMinCents:quote.minCostCents,discoveryMaxCents:quote.maxCostCents});return <details className={styles.breakdown}><summary>Cost breakdown by tool</summary>
        <table><thead><tr><th>Tool</th><th>Stage</th><th>Units</th><th>Cost</th></tr></thead><tbody>{cost.lines.map(line=><tr key={`${line.tool}:${line.stage}`}><td>{line.tool}</td><td>{line.stage}{line.includedInApproval?'':' — not approved by this action'}</td><td>{line.units.toLocaleString('en-US')} {line.unitLabel}</td><td>{line.minCents===line.maxCents?money(line.maxCents):`${money(line.minCents)}–${money(line.maxCents)}`}{line.basis==='documented_rate'?' *':''}</td></tr>)}</tbody></table>
        <p>Projected cost of the full path to a delivered cell: {money(cost.projectedMinCents)}–{money(cost.projectedMaxCents)} for roughly {cost.expectedCells} cells{cost.costPerCellMaxCents===null?'':` · up to ${money(cost.costPerCellMaxCents)} per cell`}.</p>
        <p>* Rate documented in the brief, not read from the provider account. Expected yield uses Anas&apos;s measured benchmark, not this workspace&apos;s own run. Every figure here is NBC&apos;s own provider cost, not client pricing.</p></details>;})()}<p>Only business discovery is approved by this action. Owner research and phone verification are neither included nor started.</p><p>Quote valid until {new Date(quote.expiresAt).toLocaleTimeString('en-US')}. A lower actual cost does not increase your approved limit.</p>
      {(expired||quote.blockers.length>0||belowProviderMinimum(quote.maxCostCents))&&<div className={styles.error} role="status">{expired&&<p>This quote expired. Cancel and request a fresh estimate.</p>}{belowProviderMinimum(quote.maxCostCents)&&<p>This run is too small for the provider, which will not accept a spending cap under {money(PROVIDER_MIN_CHARGE_CENTS)}. Cancel and request a larger business count.</p>}{quote.blockers.map(b=><p key={b}>{blockers[b]??'A server readiness check must be completed before starting.'}</p>)}</div>}
      {notice&&code&&<p className={styles.error} role="alert">{notice}</p>}
      <div className={styles.dialogActions}><button type="button" autoFocus disabled={Boolean(busy)} onClick={()=>{if(expired)quoteAttempt.current=null;closeQuote();}}>Cancel</button><button type="button" className={styles.primary} disabled={storageUnavailable||Boolean(busy)||expired||quote.blockers.length>0||belowProviderMinimum(quote.maxCostCents)||!savedMatches} onClick={()=>approve(quote.id)}>{busy?'Starting…':`Approve & start · up to ${money(quote.maxCostCents)}`}</button></div></>}
    </dialog>
  </section>;
}
