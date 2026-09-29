import type {PilotResult} from './live-pilot';
import {qualifiedRows} from './run-review';
import {usdMicros,type LatencySummary} from './caller-measurements';
export interface CostOperation {round_id:string;key:string;state:string;reserved_cents:number;reported_microusd:number|null;result:PilotResult;created_at:string;updated_at:string}
export interface CostSlot {round_id:string;key:string;kind:string;title:string;config:{industry?:string;approvedCeilingCents?:number}}
export interface CostCheck {round_id:string;slot_key:string;phone10:string;state:'completed'|'dispatching'|'uncertain';reserved_cents:number;rate_microusd:number|null;verification:import('./lead-engine-quality').LeadVerification|null}
export interface CostLine {provider:string;component:string;reportedMicrousd:number|null;estimatedMicrousd:number|null;missing:number}
export interface OperationCostRow {key:string;title:string;industry:string;kind:string;state:string;createdAt:string;updatedAt:string;approvedMicrousd:number|null;reservedMicrousd:number;reportedMicrousd:number;estimatedMicrousd:number;missing:number;seconds:number|null;qualified:number|null;costPerMinuteMicrousd:number|null;costPerQualifiedMicrousd:number|null;latency:LatencySummary|null;lines:CostLine[]}
export interface OperationCostReport {rows:OperationCostRow[];providers:CostLine[];reportedMicrousd:number;estimatedMicrousd:number;missing:number;truncated:boolean;generatedAt:string}
export function operationCosts(operations:CostOperation[],slots:CostSlot[],checks:CostCheck[]):OperationCostReport{
 const rows=operations.map(o=>{
  const s=slots.find(s=>s.round_id===o.round_id&&s.key===o.key),r=o.result??{},phone=s?.kind==='phone';
  const own=checks.filter(c=>c.round_id===o.round_id&&c.slot_key===o.key);
  const lines:CostLine[]=phone&&r.phoneEngine==='retell'?[{provider:'Retell',component:'Bundled phone agent usage',reportedMicrousd:r.retellCostMicrousd??null,estimatedMicrousd:null,missing:r.retellCostMicrousd==null?1:0}]:phone?[
   {provider:'Twilio',component:'Telephony',reportedMicrousd:usdMicros(r.voiceUsd),estimatedMicrousd:null,missing:r.voiceUsd==null?1:0},
   {provider:'ElevenLabs',component:'Agent (voice + model)',reportedMicrousd:usdMicros(r.agentUsd),estimatedMicrousd:null,missing:r.agentUsd==null?1:0},
  ]:[{provider:'Apify',component:'Discovery',reportedMicrousd:o.reported_microusd,estimatedMicrousd:null,missing:o.reported_microusd===null?1:0}];
  if(!phone&&own.length)lines.push({provider:'BatchData',component:'Phone checks · saved account rate',reportedMicrousd:null,estimatedMicrousd:own.reduce((n,c)=>n+(c.state==='completed'?(c.rate_microusd??0):0),0),missing:own.filter(c=>c.state!=='completed'||c.rate_microusd===null).length});
  // A check reused across lists qualifies again but is charged only to its original operation.
  const evidence=checks.filter(c=>c.round_id===o.round_id&&r.rows?.some(row=>row.phone10===c.phone10));
  const qualified=phone?null:qualifiedRows({...r,phoneChecks:evidence}).length;
  const reported=lines.reduce((n,l)=>n+(l.reportedMicrousd??0),0),estimated=lines.reduce((n,l)=>n+(l.estimatedMicrousd??0),0),missing=lines.reduce((n,l)=>n+l.missing,0),seconds=typeof r.durationSeconds==='number'&&Number.isFinite(r.durationSeconds)?r.durationSeconds:null;
  return{key:o.round_id+'/'+o.key,title:s?.title??o.key,industry:s?.config.industry??'Unspecified',kind:phone?'Caller':'Scraper',state:o.state,createdAt:o.created_at,updatedAt:o.updated_at,approvedMicrousd:s?.config.approvedCeilingCents!=null?s.config.approvedCeilingCents*10000:null,reservedMicrousd:(o.reserved_cents+own.reduce((n,c)=>n+c.reserved_cents,0))*10000,reportedMicrousd:reported,estimatedMicrousd:estimated,missing,seconds,qualified,costPerMinuteMicrousd:phone&&seconds&&missing===0?Math.round(reported*60/seconds):null,costPerQualifiedMicrousd:qualified&&missing===0?Math.round((reported+estimated)/qualified):null,latency:r.latency??null,lines};
 });
 const providers:CostLine[]=[];
 for(const row of rows)for(const line of row.lines){let total=providers.find(p=>p.provider===line.provider);if(!total){total={provider:line.provider,component:'Operation usage',reportedMicrousd:null,estimatedMicrousd:null,missing:0};providers.push(total);}if(line.reportedMicrousd!==null)total.reportedMicrousd=(total.reportedMicrousd??0)+line.reportedMicrousd;if(line.estimatedMicrousd!==null)total.estimatedMicrousd=(total.estimatedMicrousd??0)+line.estimatedMicrousd;total.missing+=line.missing;}
 return{rows,providers,reportedMicrousd:rows.reduce((n,r)=>n+r.reportedMicrousd,0),estimatedMicrousd:rows.reduce((n,r)=>n+r.estimatedMicrousd,0),missing:rows.reduce((n,r)=>n+r.missing,0),truncated:false,generatedAt:new Date().toISOString()};
}
