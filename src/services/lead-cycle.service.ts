import 'server-only';
import {randomUUID} from 'node:crypto';
import {database,IntegrationError} from './integration.service';
import {pilotView,startPilot,syncPilot} from './live-pilot.service';
import {researchRunEvidence} from './run-owner-evidence.service';
import {verifyRunPhone} from './run-verification.service';
import {PILOT_ROUND,type PilotView} from '@/lib/live-pilot';
import {cycleCounts,type CycleInput,type LeadCycle,type CyclePhase,type CycleStatus} from '@/lib/lead-cycle';
export interface LeadCycleView {runs:LeadCycle[];pilot:PilotView}
const columns='key,name,industry,city,state,count,status,phase,message,started_at,phase_started_at,finished_at,events';
function storageError(message:string):never {
 if(message.includes('pilot_not_found'))throw new IntegrationError(403,'This search round is not available to your account.');
 if(message.includes('request_conflict'))throw new IntegrationError(409,'This saved request has different list details. Refresh its progress before creating another.');
 if(message.includes('budget'))throw new IntegrationError(409,'The remaining shared allowance cannot cover this step.');
 if(message.includes('pending'))throw new IntegrationError(409,'Pause or finish the active list, and resolve pending operations, before starting another.');
 throw new IntegrationError(409,'This step could not be saved. Refresh your list before continuing.');
}
export async function leadCycleView(owner:string):Promise<LeadCycleView>{
 const pilot=await pilotView(owner);
 const {data,error}=await database().from('nbc_lead_cycles').select(columns).eq('round_id',PILOT_ROUND).order('started_at',{ascending:false}).limit(100);
 if(error)throw new IntegrationError(503,'Saved search progress could not be loaded.');
 return {runs:(data??[]) as LeadCycle[],pilot};
}
export async function createLeadCycle(owner:string,input:CycleInput):Promise<LeadCycleView>{
 const {requestId,...details}=input;
 const {error}=await database().rpc('nbc_lead_cycle_create',{p_owner:owner,p_request:requestId,p_input:details});
 if(error)storageError(error.message);
 return leadCycleView(owner);
}
export async function controlLeadCycle(owner:string,key:string,action:'pause'|'resume'):Promise<LeadCycleView>{
 const {error}=await database().rpc('nbc_lead_cycle_control',{p_owner:owner,p_key:key,p_action:action});
 if(error)storageError(error.message);
 return leadCycleView(owner);
}
// Every advance does at most one external step. A lease serializes tabs; provider dispatch and phone
// checks retain their own durable spending claims even if the lease expires or the response is lost.
export async function advanceLeadCycle(owner:string,key:string):Promise<LeadCycleView>{
 const before=await leadCycleView(owner),run=before.runs.find(r=>r.key===key);
 if(!run)throw new IntegrationError(404,'This list was not found.');
 if(run.status!=='running')return before;
 const lease=randomUUID(),db=database();
 const claim=await db.rpc('nbc_lead_cycle_claim',{p_owner:owner,p_key:key,p_lease:lease});
 if(claim.error)storageError(claim.error.message);
 if(!claim.data)return leadCycleView(owner);
 // Re-read after acquiring the lease: another tab may have advanced since our initial GET.
 const current=await leadCycleView(owner),saved=current.runs.find(r=>r.key===key)!;
 let phase:CyclePhase=saved.phase,status:CycleStatus='running',message:string|null=null;
 try{
  const slot=current.pilot.slots.find(s=>s.key===key);
  if(!slot)throw Error('Saved list configuration is unavailable.');
  if(saved.status!=='running'){status=saved.status;message=saved.message;}
  else if(phase==='discover'){
   if(slot.state==='ready'){await startPilot(owner,key);message='Search connected. Gathering published business listings.';}
   else if(['running','dispatching','uncertain'].includes(slot.state)){
    const next=await syncPilot(owner,key),result=next.slots.find(s=>s.key===key)!;
    if(result.state==='completed'){phase='filter';message=`Data received: ${result.result.rows?.length??0} businesses. Reviewing filters.`;}
    else if(!['running','dispatching'].includes(result.state)){status='needs_attention';message='The search needs review. No replacement search will start automatically.';}
    else message='The search is still gathering listings. Waiting for a confirmed result.';
   }else if(slot.state==='completed'){phase='filter';message=`Data received: ${slot.result.rows?.length??0} businesses.`;}
   else{status='needs_attention';message='The discovery step did not finish successfully. Review its saved result.';}
  }else if(phase==='filter'){
   const counts=cycleCounts(slot);phase='research';message=`Filtered ${counts.found} businesses: ${counts.excluded} excluded, ${counts.eligible} unique phones to review.`;
  }else if(phase==='research'){
   if(saved.industry==='chiropractor'&&(slot.result.rows?.length??0)>0){await researchRunEvidence(owner,key);message='Registry evidence saved. Associations still need ownership review.';}
   else message='Business sources retained. Owner evidence for this market needs further research.';
   phase='verify';
  }else if(phase==='verify'){
   const counts=cycleCounts(slot);
   if(slot.result.phoneChecks?.some(c=>c.state!=='completed')){status='needs_attention';message='A previous phone check is unconfirmed. Its reservation is retained; it will not be charged again.';}
   else if(counts.remaining===0){phase='deliver';message=`Phone checks saved: ${counts.checked}. Preparing ${counts.qualified} phone-qualified contacts.`;}
   else if(!current.pilot.verification?.configured){status='waiting_rate';message='Discovery and filtering are saved. Confirm the verification account rate to continue checking phones.';}
   else if(current.pilot.pending){status='needs_attention';message='Another operation is active or needs review. No additional phone check was started.';}
   else{await verifyRunPhone(owner,key);message='Phone verification saved. Continuing with the remaining eligible contacts.';}
  }else {phase='done';status='completed';message='List ready to review. Phone qualification and owner identity are separate; review the evidence before outreach.';}
 }catch(error){status='needs_attention';message=error instanceof Error?error.message:'This step could not be confirmed. Review before resuming.';}
 const finish=await db.rpc('nbc_lead_cycle_finish',{p_owner:owner,p_key:key,p_lease:lease,p_status:status,p_phase:phase,p_message:message});
 if(finish.error)storageError(finish.error.message);
 return leadCycleView(owner);
}
