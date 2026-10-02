import 'server-only';
import {FIELDS,LIST_ID,SPACE_ID,OnboardingError,channelName,marker,taskPayload,type Intake} from '../lib/client-onboarding.ts';
export interface ClickUpTask {id:string;name:string;description?:string;text_content?:string;list?:{id:string};custom_fields?:{id:string;value?:unknown}[]}
export class ClickUpOnboarding {
 constructor(private token=process.env.CLICKUP_API_KEY??''){}
 private async get(path:string):Promise<any>{
  if(!this.token)throw new OnboardingError(503,'ClickUp is not connected. Your draft can still be saved.');
  let r:Response;try{r=await fetch(`https://api.clickup.com/api/v2/${path}`,{headers:{Authorization:this.token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});}catch{throw new OnboardingError(503,'ClickUp could not be reached. No new task has been requested.');}
  if(!r.ok)throw new OnboardingError(503,'ClickUp access could not be verified. Check the connection before starting.');
  try{return await r.json();}catch{throw new OnboardingError(503,'ClickUp returned an unreadable result.');}
 }
 async verify():Promise<void>{
  const [list,fields]=await Promise.all([this.get(`list/${LIST_ID}`),this.get(`list/${LIST_ID}/field`)]);
  if(String(list.id)!==LIST_ID||String(list.space?.id)!==SPACE_ID||!Array.isArray(list.statuses)||!list.statuses.some((s:any)=>s.status==='pending ')||!Array.isArray(fields.fields))throw new OnboardingError(503,'The onboarding destination has changed. Review the ClickUp mapping.');
  for(const f of Object.values(FIELDS)){const remote=fields.fields.find((v:any)=>v.id===f.id);if(!remote||remote.name!==f.name||remote.type!==f.type)throw new OnboardingError(503,'The onboarding fields have changed. Review the ClickUp mapping.');}
 }
 async tasks():Promise<ClickUpTask[]>{
  const found=new Map<string,ClickUpTask>();
  for(const archived of [false,true]){
   let complete=false;
   for(let page=0;page<5;page++){
    const data=await this.get(`list/${LIST_ID}/task?include_closed=true&subtasks=false&archived=${archived}&page=${page}`);
    if(!Array.isArray(data.tasks))throw new OnboardingError(503,'The existing onboarding queue could not be checked.');
    for(const t of data.tasks){if(!t||typeof t.id!=='string'||typeof t.name!=='string'||String(t.list?.id)!==LIST_ID)throw new OnboardingError(503,'The onboarding queue returned an unexpected task.');found.set(t.id,t);}
    if(data.last_page===true||data.tasks.length<100){complete=true;break;}
   }
   if(!complete)throw new OnboardingError(503,'The queue needs a larger duplicate check before new clients can be started.');
  }
  return [...found.values()];
 }
 async existing(intake:Intake):Promise<ClickUpTask|null>{
  const tasks=await this.tasks();const same=tasks.filter(t=>String(t.custom_fields?.find(f=>f.id===FIELDS.email.id)?.value??'').trim().toLowerCase()===intake.email);
  if(same.length>1)throw new OnboardingError(409,'More than one ClickUp entry already uses this email. Review the queue before starting.');
  if(same.length===1)return same[0];
  if(tasks.some(t=>channelName(t.name)===channelName(intake.company)))throw new OnboardingError(409,'A client with this channel name already exists. Review the existing entry before starting.');
  return null;
 }
 async create(intake:Intake,id:string):Promise<ClickUpTask>{
  if(!this.token)throw new Error('Missing connection');
  // Intentionally no transport retry. Any failure after dispatch is ambiguous.
  const r=await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task`,{method:'POST',headers:{Authorization:this.token,'Content-Type':'application/json'},body:JSON.stringify(taskPayload(intake,id)),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('ClickUp dispatch requires reconciliation');
  const t=await r.json();if(!t||typeof t.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(t.id)||String(t.list?.id)!==LIST_ID)throw new Error('Unconfirmed ClickUp receipt');return t;
 }
 async readTask(id:string):Promise<ClickUpTask>{if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new OnboardingError(409,'Invalid saved task.');const t=await this.get(`task/${id}`);if(t.id!==id||String(t.list?.id)!==LIST_ID)throw new OnboardingError(409,'The saved task is no longer in the onboarding queue.');return t;}
 async reconcile(id:string):Promise<ClickUpTask|null>{const matches=(await this.tasks()).filter(t=>(t.description??t.text_content??'').split(/\r?\n/).includes(marker(id)));if(matches.length>1)throw new OnboardingError(409,'Multiple tasks contain this onboarding reference. Manual review is needed.');return matches[0]??null;}
}
export function fieldsMatch(task:ClickUpTask,intake:Intake):boolean{return task.name===intake.company&&Object.entries(FIELDS).every(([key,f])=>!intake[key as keyof Intake]||task.custom_fields?.some(v=>v.id===f.id&&v.value===intake[key as keyof Intake]));}
