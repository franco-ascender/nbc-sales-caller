import 'server-only';
import {database,IntegrationError} from './integration.service';
import {ensureAdmin} from './account-usage';
import type {Member} from '@/lib/member-types';
import {operationCosts,sessionCosts,summarizeCosts,COST_COVERAGE,type CostOperation,type CostSlot,type CostCheck,type CostSession,type BillingStatement} from '@/lib/operation-costs';
import {parseBillingStatement} from '@/lib/billing-statement';
export async function saveBillingStatement(actor:Member,raw:unknown){
 ensureAdmin(actor);const row=parseBillingStatement(raw);
 const r=await database().from('nbc_billing_statements').insert({...row,created_by:actor.id}).select('id').single();
 if(r.error)throw new IntegrationError(r.error.code==='23505'?409:503,r.error.code==='23505'?'This provider document is already recorded.':'The billing document could not be saved.');
 return r.data;
}
export async function readOperationCosts(actor:Member){
 ensureAdmin(actor);const db=database();let truncated=false;
 async function all<T>(table:string,columns:string,orders:string[]):Promise<T[]>{const rows:T[]=[];for(let offset=0;offset<10000;offset+=500){let query=db.from(table).select(columns);for(const order of orders)query=query.order(order);const r=await query.range(offset,offset+499);if(r.error)throw new IntegrationError(503,'Saved costs could not be read. No incomplete total was returned.');rows.push(...(r.data??[]) as unknown as T[]);if((r.data?.length??0)<500)return rows;}truncated=true;return rows;}
 const [operations,slots,checks,sessions,statements,batches,jobs,usage]=await Promise.all([
  all<CostOperation>('nbc_pilot_operations','round_id,key,state,reserved_cents,reported_microusd,result,provider,created_at,updated_at',['round_id','key']),
  all<CostSlot>('nbc_pilot_slots','round_id,key,kind,title,config',['round_id','key']),
  all<CostCheck>('nbc_pilot_phone_checks','round_id,slot_key,phone10,state,reserved_cents,rate_microusd,verification',['round_id','phone10']),
  all<CostSession&{is_demo:boolean}>('call_sessions','id,provider,provider_call_id,channel,status,scenario_title,duration_seconds,cost_microusd,cost_scope,created_at,synced_at,is_demo',['id']),
  all<BillingStatement>('nbc_billing_statements','id,provider,reference,issued_on,currency,total_microusd,applied_microusd,due_microusd,kind,evidence,note,created_at',['id']),
  all<{consumed_cents:number}>('lead_engine_costs','batch_id,consumed_cents',['batch_id']),
  all<{spent_cents:number}>('lead_engine_jobs','id,spent_cents',['id']),
  all<{source:string;event_key:string;cost_microusd:number|null}>('nbc_usage_events','id,source,event_key,cost_microusd',['id']),
 ]);
 const sessionIds=new Set(sessions.map(s=>s.id));
 const unmatched=usage.filter(u=>u.source!=='caller'||!sessionIds.has(u.event_key));
 const unallocated=[
  {source:'Legacy batch ledger',records:batches.length,amountMicrousd:batches.length?batches.reduce((n,r)=>n+r.consumed_cents*10000,0):null,note:'Internal settlements, not provider invoices. Kept separate until matched to receipts.'},
  {source:'Owner research jobs',records:jobs.length,amountMicrousd:jobs.length?jobs.reduce((n,r)=>n+r.spent_cents*10000,0):null,note:'Internal job spend may overlap batch settlements. Do not add these amounts together.'},
  {source:'Unmatched usage events',records:unmatched.length,amountMicrousd:unmatched.some(u=>u.cost_microusd!==null)?unmatched.reduce((n,r)=>n+(r.cost_microusd??0),0):null,note:'Events without a matched session. Excluded from operation totals until reconciled.'},
 ];
 return{...summarizeCosts([...operationCosts(operations,slots,checks).rows,...sessionCosts(sessions.filter(s=>!s.is_demo),operations)]),truncated,statements,coverage:COST_COVERAGE,unallocated};
}

// Billing reads only. Never reads a paid dataset or dispatches provider work.
export async function reconcileCostReceipts(actor:Member){
 ensureAdmin(actor);const db=database();
 const selected=await db.from('nbc_pilot_operations').select('round_id,key,state,provider,result,version').in('state',['completed','failed','stopped']).or('provider->>engine.eq.retell,provider->job->>runId.not.is.null').order('updated_at',{ascending:true}).limit(10);
 if(selected.error)throw new IntegrationError(503,'Saved receipt identities could not be loaded.');
 let updated=0,unavailable=0,skipped=0;
 const {retellReceipt}=await import('@/lib/caller-measurements');
 await Promise.all((selected.data??[]).map(async o=>{
  const p=o.provider??{};let url='',key='';
  if(p.engine==='retell'&&/^call_[\w-]+$/.test(p.callId??'')){url='https://api.retellai.com/v2/get-call/'+p.callId;key=process.env.RETELL_API_KEY??'';}
  else if(!p.engine&&/^[a-zA-Z0-9]+$/.test(p.job?.runId??'')){url='https://api.apify.com/v2/actor-runs/'+p.job.runId;key=process.env.APIFY_API_TOKEN??'';}
  else{skipped++;return;}
  if(!key){unavailable++;return;}
  try{
   const response=await fetch(url,{headers:{Authorization:'Bearer '+key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error();const body=await response.json();let cost:number|null=null,result={...o.result};
   if(p.engine==='retell'){
    if(body.call_id!==p.callId||!['ended','error','not_connected'].includes(body.call_status))throw Error();
    const receipt=retellReceipt(body);cost=receipt.costMicrousd;result={...result,retellCostMicrousd:cost,retellComponents:receipt.components,costComplete:cost!==null};
   }else{
    if(body.data?.id!==p.job.runId||!['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(body.data.status))throw Error();
    const amount=body.data.usageTotalUsd;if(typeof amount==='number'&&Number.isFinite(amount)&&amount>=0)cost=Math.round(amount*1e6);
    result={...result,costComplete:false,costNote:'Latest provider run receipt. Account-level storage, data reads outside the run and phone verification require separate reconciliation.'};
   }
   if(cost===null)throw Error();
   const write=await db.from('nbc_pilot_operations').update({reported_microusd:cost,result,version:o.version+1,updated_at:new Date().toISOString()}).eq('round_id',o.round_id).eq('key',o.key).eq('version',o.version).select('key');
   if(write.error||!write.data?.length)throw Error();updated++;
  }catch{unavailable++;}
 }));
 return {updated,unavailable,skipped,limited:(selected.data?.length??0)===10};
}
