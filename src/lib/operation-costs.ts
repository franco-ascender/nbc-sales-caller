import type {PilotResult} from './live-pilot';
import {qualifiedRows} from './run-review';
import {usdMicros,type LatencySummary} from './caller-measurements';
export interface CostOperation {round_id:string;key:string;state:string;reserved_cents:number;reported_microusd:number|null;result:PilotResult;provider?:{engine?:string;callId?:string;callSid?:string};created_at:string;updated_at:string}
export interface CostSlot {round_id:string;key:string;kind:string;title:string;config:{industry?:string;approvedCeilingCents?:number}}
export interface CostCheck {round_id:string;slot_key:string;phone10:string;state:'completed'|'dispatching'|'uncertain';reserved_cents:number;rate_microusd:number|null;verification:import('./lead-engine-quality').LeadVerification|null}
export interface CostLine {provider:string;component:string;reportedMicrousd:number|null;estimatedMicrousd:number|null;missing:number;details?:Array<{product:string;costMicrousd:number|null}>}
export interface OperationCostRow {key:string;title:string;industry:string;kind:string;state:string;createdAt:string;updatedAt:string;approvedMicrousd:number|null;reservedMicrousd:number;reportedMicrousd:number;estimatedMicrousd:number;missing:number;seconds:number|null;qualified:number|null;costPerMinuteMicrousd:number|null;costPerQualifiedMicrousd:number|null;latency:LatencySummary|null;lines:CostLine[];receiptComplete:boolean;businesses:number|null;checked:number|null;note:string}
export interface CostSession {id:string;provider:string;provider_call_id:string|null;channel:string;status:string;scenario_title:string|null;duration_seconds:number|null;cost_microusd:number|null;cost_scope:string;created_at:string;synced_at:string|null}
export interface BillingStatement {id:string;provider:string;reference:string;issued_on:string;currency:string;total_microusd:number;applied_microusd:number;due_microusd:number;kind:'invoice'|'prepayment';evidence:string;note:string;created_at:string}
export interface CostCoverage {provider:string;components:string;status:string}
export interface OperationCostReport {rows:OperationCostRow[];providers:CostLine[];reportedMicrousd:number;estimatedMicrousd:number;missing:number;truncated:boolean;generatedAt:string;statements?:BillingStatement[];coverage?:CostCoverage[];unallocated?:Array<{source:string;records:number;amountMicrousd:number|null;note:string}>}
export function operationCosts(operations:CostOperation[],slots:CostSlot[],checks:CostCheck[]):OperationCostReport{
 const rows=operations.map(o=>{
  const s=slots.find(s=>s.round_id===o.round_id&&s.key===o.key),r=o.result??{},phone=s?.kind==='phone';
  const own=checks.filter(c=>c.round_id===o.round_id&&c.slot_key===o.key);
  const engine=o.provider?.engine??r.phoneEngine;
  const lines:CostLine[]=phone&&engine&&engine!=='retell'?[{provider:'Unmapped phone engine',component:'Provider mapping requires reconciliation',reportedMicrousd:null,estimatedMicrousd:null,missing:1}]:phone&&r.phoneEngine==='retell'?[{provider:'Retell',component:'Bundled phone agent usage',reportedMicrousd:r.retellCostMicrousd??null,estimatedMicrousd:null,missing:r.retellCostMicrousd==null?1:0,details:r.retellComponents}]:phone?[
   {provider:'Twilio',component:'Telephony',reportedMicrousd:usdMicros(r.voiceUsd),estimatedMicrousd:null,missing:usdMicros(r.voiceUsd)===null?1:0},
   {provider:'ElevenLabs',component:'Agent (voice + model)',reportedMicrousd:usdMicros(r.agentUsd),estimatedMicrousd:null,missing:usdMicros(r.agentUsd)===null?1:0},
  ]:[{provider:'Apify',component:'Discovery',reportedMicrousd:o.reported_microusd,estimatedMicrousd:null,missing:o.reported_microusd===null?1:0}];
  if(!phone&&own.length)lines.push({provider:'BatchData',component:'Phone checks · saved account rate',reportedMicrousd:null,estimatedMicrousd:own.some(c=>c.state==='completed'&&c.rate_microusd!==null)?own.reduce((n,c)=>n+(c.state==='completed'?(c.rate_microusd??0):0),0):null,missing:own.filter(c=>c.state!=='completed'||c.rate_microusd===null).length});
  // A check reused across lists qualifies again but is charged only to its original operation.
  const evidence=checks.filter(c=>c.round_id===o.round_id&&r.rows?.some(row=>row.phone10===c.phone10));
  const qualified=phone?null:qualifiedRows({...r,phoneChecks:evidence}).length;
  const reported=lines.reduce((n,l)=>n+(l.reportedMicrousd??0),0),estimated=lines.reduce((n,l)=>n+(l.estimatedMicrousd??0),0),missing=lines.reduce((n,l)=>n+l.missing,0),seconds=typeof r.durationSeconds==='number'&&Number.isFinite(r.durationSeconds)?r.durationSeconds:null;
  return{key:o.round_id+'/'+o.key,title:s?.title??o.key,industry:s?.config.industry??'Unspecified',kind:phone?'Caller':'Scraper',state:o.state,createdAt:o.created_at,updatedAt:o.updated_at,approvedMicrousd:s?.config.approvedCeilingCents!=null?s.config.approvedCeilingCents*10000:null,reservedMicrousd:(o.reserved_cents+own.reduce((n,c)=>n+c.reserved_cents,0))*10000,reportedMicrousd:reported,estimatedMicrousd:estimated,missing,seconds,qualified,costPerMinuteMicrousd:phone&&seconds&&missing===0&&r.costComplete===true?Math.round(reported*60/seconds):null,costPerQualifiedMicrousd:qualified&&missing===0&&r.costComplete===true?Math.round((reported+estimated)/qualified):null,latency:r.latency??null,lines,receiptComplete:r.costComplete===true&&missing===0,businesses:phone?null:r.rows?.length??0,checked:phone?null:evidence.filter(c=>c.state==='completed').length,note:r.costNote??'Receipt completeness has not been confirmed.'};
 });
 return summarizeCosts(rows);
}
export function summarizeCosts(rows:OperationCostRow[]):OperationCostReport{
 const providers:CostLine[]=[];
 for(const row of rows)for(const line of row.lines){let total=providers.find(p=>p.provider===line.provider);if(!total){total={provider:line.provider,component:'Operation usage',reportedMicrousd:null,estimatedMicrousd:null,missing:0};providers.push(total);}if(line.reportedMicrousd!==null)total.reportedMicrousd=(total.reportedMicrousd??0)+line.reportedMicrousd;if(line.estimatedMicrousd!==null)total.estimatedMicrousd=(total.estimatedMicrousd??0)+line.estimatedMicrousd;total.missing+=line.missing;}
 return{rows,providers,reportedMicrousd:rows.reduce((n,r)=>n+r.reportedMicrousd,0),estimatedMicrousd:rows.reduce((n,r)=>n+r.estimatedMicrousd,0),missing:rows.reduce((n,r)=>n+r.missing,0),truncated:false,generatedAt:new Date().toISOString()};
}

// Sessions also appear in nbc_usage_events. Read them once, never add both ledgers.
export function sessionCosts(sessions:CostSession[],operations:CostOperation[]):OperationCostRow[]{
 const phoneIds=new Set(operations.flatMap(o=>[o.provider?.callId,o.provider?.callSid]).filter(Boolean));
 return sessions.filter(s=>!s.provider_call_id||!phoneIds.has(s.provider_call_id)).map(s=>{
  const complete=s.cost_microusd!==null&&s.cost_scope==='total'&&['completed','failed'].includes(s.status);
  const provider=s.provider==='elevenlabs'?'ElevenLabs':s.provider==='retell'?'Retell':'Unmapped session provider';
  return {key:'session/'+s.id,title:s.scenario_title||'Voice practice',industry:'Not applicable',kind:s.channel==='web'?'Browser voice':'Caller',state:s.status,createdAt:s.created_at,updatedAt:s.synced_at??s.created_at,approvedMicrousd:null,reservedMicrousd:0,reportedMicrousd:s.cost_microusd??0,estimatedMicrousd:0,missing:complete?0:1,seconds:s.duration_seconds,qualified:null,costPerMinuteMicrousd:complete&&s.duration_seconds?Math.round(s.cost_microusd!*60/s.duration_seconds):null,costPerQualifiedMicrousd:null,latency:null,lines:[{provider,component:s.cost_scope==='llm_only'?'Model only · voice cost missing':'Voice session usage',reportedMicrousd:s.cost_microusd,estimatedMicrousd:null,missing:complete?0:1}],receiptComplete:complete,businesses:null,checked:null,note:complete?'Provider-reported session usage. Plan invoices are reconciled separately.':'Partial or missing provider receipt; not a zero-cost session.'};
 });
}
export const COST_COVERAGE:CostCoverage[]=[
 {provider:'Retell',components:'Voice, model, telephony and add-ons in the bundled call receipt',status:'Call receipts mapped. Monthly numbers and account invoices still need reconciliation.'},
 {provider:'ElevenLabs',components:'Browser voice, legacy phone agent, voice cloning and plan/overage',status:'Saved session usage mapped once. Subscription, cloning and account-wide usage require invoices.'},
 {provider:'Twilio',components:'Legacy phone minutes, numbers, recordings, storage and other account services',status:'Legacy call receipts mapped. Number rental and other account charges require invoices.'},
 {provider:'Apify',components:'Search runs, actor fees, compute, proxy, storage and data reads',status:'Saved run usage mapped. Storage, reads outside runs and plan coverage require account reconciliation.'},
 {provider:'BatchData',components:'Phone checks, enrichments and plan/minimum charges',status:'Saved rates are estimates. Historical checks without a saved rate remain unpriced.'},
 {provider:'Outscraper',components:'Discovery, enrichment, historical usage and credits',status:'Invoice records only. No new discovery or paid requests are made by this dashboard.'},
 {provider:'Vercel',components:'Plan, compute, requests and transfer',status:'Shared infrastructure. Invoice and allocation required; not zero.'},
 {provider:'Supabase',components:'Plan, database, auth, recording storage and egress',status:'Shared infrastructure. Invoice and allocation required; not zero.'},
];
