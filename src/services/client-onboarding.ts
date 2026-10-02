import 'server-only';
import {database} from './integration.service';
import {requireWorkspaceUser} from './workspace-auth';
import {OnboardingError,parseIntake,validId,revision,type IntakeRecord} from '../lib/client-onboarding.ts';
import {ClickUpOnboarding,fieldsMatch} from './onboarding-clickup';
const TABLE='nbc_client_onboardings';
const SELECT='id,intake,state,revision,task_id,issue,created_at,updated_at';
export async function onboardingAdmin(request:Request){const user=await requireWorkspaceUser(request);if(user.role!=='admin')throw new OnboardingError(403,'Only NBC administrators can manage client onboarding.');return user;}
function checked<T>(r:{data:T;error:any}):T{if(r.error){if(r.error.code==='23505')throw new OnboardingError(409,'An onboarding entry already exists for this email. Open it from Recent onboarding.');throw new OnboardingError(503,'The onboarding record could not be saved or loaded. Refresh before continuing.');}return r.data;}
export async function listOnboardings(){return checked(await database().from(TABLE).select(SELECT).order('created_at',{ascending:false}).limit(100)) as IntakeRecord[];}
export async function loadOnboarding(id:string):Promise<IntakeRecord>{const row=checked(await database().from(TABLE).select(SELECT).eq('id',validId(id)).maybeSingle());if(!row)throw new OnboardingError(404,'Onboarding not found.');return row as IntakeRecord;}
export async function saveOnboarding(actor:string,body:any):Promise<IntakeRecord>{
 const id=validId(body?.id),intake=parseIntake(body?.intake);
 const existing=checked(await database().from(TABLE).select(SELECT).eq('id',id).maybeSingle()) as IntakeRecord|null;
 if(existing){
  if(existing.state!=='draft')throw new OnboardingError(409,'This onboarding has already started. Open its saved result.');
  if(JSON.stringify(existing.intake)===JSON.stringify(intake))return existing;
  const rev=revision(body.revision);
  const saved=checked(await database().from(TABLE).update({intake,revision:rev+1,updated_by:actor,updated_at:new Date().toISOString(),issue:null}).eq('id',id).eq('state','draft').eq('revision',rev).select(SELECT).maybeSingle());
  if(!saved)throw new OnboardingError(409,'Someone changed this draft. Reload it before saving.');return saved as IntakeRecord;
 }
 return checked(await database().from(TABLE).insert({id,intake,created_by:actor,updated_by:actor}).select(SELECT).single()) as IntakeRecord;
}
async function update(row:IntakeRecord,actor:string,patch:Record<string,unknown>):Promise<IntakeRecord>{const data=checked(await database().from(TABLE).update({...patch,revision:row.revision+1,updated_by:actor,updated_at:new Date().toISOString()}).eq('id',row.id).eq('revision',row.revision).eq('state',row.state).select(SELECT).maybeSingle());if(!data)throw new OnboardingError(409,'This onboarding changed. Reload the saved result.');return data as IntakeRecord;}
export async function startOnboarding(actor:string,id:string,body:any,client=new ClickUpOnboarding()):Promise<IntakeRecord>{
 if(body?.confirmed!==true)throw new OnboardingError(400,'Confirm that starting will trigger the existing Slack setup.');
 const row=await loadOnboarding(id);if(row.state!=='draft')return row;
 if(revision(body.revision)!==row.revision)throw new OnboardingError(409,'Review the latest saved draft before starting.');
 await client.verify();
 const previous=await client.existing(row.intake);
 if(previous)return update(row,actor,{state:'existing',task_id:previous.id,issue:'An existing ClickUp entry was found. No new task or automation was requested.'});
 const claimed=await update(row,actor,{state:'starting',issue:null});
 let receipt;
 try{receipt=await client.create(row.intake,row.id);}catch{return update(claimed,actor,{state:'uncertain',issue:'ClickUp did not confirm the request. Check the saved result before taking any other action; no automatic retry will be sent.'});}
 // Save the external ID first. If persistence fails, the marker can recover it without POSTing again.
 const stored=await update(claimed,actor,{state:'needs_review',task_id:receipt.id,issue:'Task created. Confirming the saved fields.'});
 try{const task=await client.readTask(receipt.id);return update(stored,actor,{state:fieldsMatch(task,row.intake)?'queued':'needs_review',issue:fieldsMatch(task,row.intake)?null:'The task exists, but some saved fields differ. Review ClickUp; do not create a replacement.'});}catch{return stored;}
}
export async function reconcileOnboarding(actor:string,id:string,client=new ClickUpOnboarding()):Promise<IntakeRecord>{
 const row=await loadOnboarding(id);if(['draft','queued','existing'].includes(row.state))return row;
 if(row.state==='starting'&&Date.now()-Date.parse(row.updated_at)<90000)throw new OnboardingError(409,'The request is still being processed. Check again shortly.');
 const task=row.task_id?await client.readTask(row.task_id):await client.reconcile(row.id);
 if(!task)return update(row,actor,{state:'uncertain',issue:'No matching task was found yet. The entry stays locked to prevent a duplicate. Review ClickUp and Zap history before resolving it.'});
 const good=fieldsMatch(task,row.intake);
 return update(row,actor,{task_id:task.id,state:good?'queued':'needs_review',issue:good?null:'Task found, but saved fields differ. Review the existing task in ClickUp.'});
}
