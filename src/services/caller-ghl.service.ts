import 'server-only';
import { IntegrationError } from './integration.service';
import { safeMeetingUrl, type BookingConfig, type BookingRequest } from '@/lib/caller-booking';
import { isRecord } from '@/lib/integration-validation';
type Data=Record<string,unknown>;
export class GhlWriteUncertain extends IntegrationError {constructor(){super(409,'The CRM response is not confirmed. Reconcile this action before retrying.');}}
export class CallerGhl {
 constructor(private readonly token:string, readonly locationId:string) {}
 async request(path:string,method='GET',body?:unknown):Promise<Data> {
  let response:Response;
  try {response=await fetch('https://services.leadconnectorhq.com'+path,{method,headers:{Authorization:`Bearer ${this.token}`,Version:'v3','Content-Type':'application/json',Accept:'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});}
  catch {if(method!=='GET')throw new GhlWriteUncertain();throw new IntegrationError(502,'GHL could not be reached.');}
  if(!response.ok){if(method!=='GET'&&(response.status>=500||response.status===408))throw new GhlWriteUncertain();throw new IntegrationError(response.status===409?409:502,`GHL rejected the request (HTTP ${response.status}). Check the connection and scopes.`);}
  if(response.status===204)return{};
  try {const v:unknown=await response.json();if(!isRecord(v))throw new Error();return v;}catch{if(method!=='GET')throw new GhlWriteUncertain();throw new IntegrationError(502,'GHL returned an invalid response.');}
 }
 async options(){
  const [location,calendars,pipelines]=await Promise.all([this.request(`/locations/${encodeURIComponent(this.locationId)}`),this.request(`/calendars/?${new URLSearchParams({locationId:this.locationId})}`),this.request(`/opportunities/pipelines?${new URLSearchParams({locationId:this.locationId})}`)]);
  if(!isRecord(location.location)||location.location.id!==this.locationId)throw new IntegrationError(403,'GHL location does not match the connection.');
  const list=(v:unknown)=>Array.isArray(v)?v.filter(isRecord):[];
  return {locationName:String(location.location.name??''),calendars:list(calendars.calendars).filter(c=>c.locationId===this.locationId&&c.isActive!==false).map(c=>({id:String(c.id),name:String(c.name)})),pipelines:list(pipelines.pipelines).map(p=>({id:String(p.id),name:String(p.name),stages:list(p.stages).map(s=>({id:String(s.id),name:String(s.name)}))}))};
 }
 async validate(c:BookingConfig){const o=await this.options();if(!o.calendars.some(x=>x.id===c.calendarId)||!o.pipelines.some(p=>p.id===c.pipelineId&&p.stages.some(s=>s.id===c.stageId)))throw new IntegrationError(400,'Choose a calendar and pipeline stage from this GHL account.');return o;}
 async slots(c:BookingConfig,start:number,end:number):Promise<string[]> {
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<Date.now()-60000||end<=start||end-start>7*86400000||end>Date.now()+91*86400000)throw new IntegrationError(400,'Search a future window of up to seven days.');
  const r=await this.request(`/calendars/${encodeURIComponent(c.calendarId)}/free-slots?${new URLSearchParams({startDate:String(start),endDate:String(end),timezone:c.timezone})}`);
  return [...new Set(Object.values(r).flatMap(v=>isRecord(v)&&Array.isArray(v.slots)?v.slots.filter((s):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&Date.parse(s)>=start&&Date.parse(s)<=end):[]).map(s=>new Date(s).toISOString()))].sort();
 }
 async contact(phone:string):Promise<Data>{
  // Phone only avoids GHL's email-first upsert merging into another person's contact.
  const r=await this.request('/contacts/upsert','POST',{locationId:this.locationId,phone});
  if(!isRecord(r.contact)||typeof r.contact.id!=='string')throw new GhlWriteUncertain();
  const c=await this.getContact(r.contact.id);
  if(typeof c.phone!=='string'||c.phone.replace(/[^+\d]/g,'')!==phone)throw new IntegrationError(409,'The CRM contact does not match this call recipient.');
  return c;
 }
 async getContact(id:string):Promise<Data>{const r=await this.request(`/contacts/${encodeURIComponent(id)}`);if(!isRecord(r.contact)||r.contact.id!==id||r.contact.locationId!==this.locationId)throw new IntegrationError(403,'The contact is outside this GHL account.');return r.contact;}
 async updateContact(id:string,b:BookingRequest){await this.request(`/contacts/${encodeURIComponent(id)}`,'PUT',{name:b.name,email:b.email});}
 async book(c:BookingConfig,contactId:string,b:BookingRequest,marker:string):Promise<Data>{
  const r=await this.request('/calendars/events/appointments','POST',{calendarId:c.calendarId,locationId:c.locationId,contactId,startTime:b.startTime,title:`${c.businessName} meeting`,description:marker,appointmentStatus:'confirmed',toNotify:false,ignoreDateRange:false,ignoreFreeSlotValidation:false});
  if(typeof r.id!=='string')throw new GhlWriteUncertain();
  return this.appointment(r.id,c,contactId,b.startTime);
 }
 async appointment(id:string,c:BookingConfig,contactId:string,start:string):Promise<Data>{
  const r=await this.request(`/calendars/events/appointments/${encodeURIComponent(id)}`),e=isRecord(r.event)?r.event:r;
  if(e.id!==id||e.locationId!==c.locationId||e.calendarId!==c.calendarId||e.contactId!==contactId||Date.parse(String(e.startTime))!==Date.parse(start)||!['confirmed','new'].includes(String(e.appointmentStatus))||(!Number.isFinite(Date.parse(String(e.endTime)))||Date.parse(String(e.endTime))<=Date.parse(start)))throw new GhlWriteUncertain();return e;
 }
 async findAppointment(c:BookingConfig,contactId:string,start:string,marker:string):Promise<Data|null>{
  const t=Date.parse(start),r=await this.request(`/calendars/events?${new URLSearchParams({locationId:c.locationId,calendarId:c.calendarId,startTime:String(t-60000),endTime:String(t+86400000)})}`);
  const matches=Array.isArray(r.events)?r.events.filter(isRecord).filter(e=>e.contactId===contactId&&Date.parse(String(e.startTime))===t&&typeof e.id==='string'):[];
  // Appointment list may omit description; fetch candidate and require our unique marker.
  for(const e of matches){const a=await this.request(`/calendars/events/appointments/${encodeURIComponent(String(e.id))}`),v=isRecord(a.event)?a.event:a;if(v.description===marker)return this.appointment(String(e.id),c,contactId,start);}
  return null;
 }
 async tags(id:string,tags:string[]){await this.request(`/contacts/${encodeURIComponent(id)}/tags`,'POST',{tags});}
 async opportunity(c:BookingConfig,contactId:string):Promise<string>{
  const r=await this.request(`/opportunities/search?${new URLSearchParams({locationId:c.locationId,pipelineId:c.pipelineId,contactId,status:'all',limit:'100'})}`);
  if(!Array.isArray(r.opportunities)||r.opportunities.some(o=>!isRecord(o)))throw new IntegrationError(502,'Opportunity search is incomplete.');
  const all=r.opportunities.filter(isRecord);
  if(all.length>=100||all.some(o=>o.pipelineId!==c.pipelineId||o.contactId!==contactId))throw new IntegrationError(409,'Opportunity search needs review before changing the pipeline.');
  // Independently scope responses; never move won/lost deals or choose among multiple opportunities.
  const matches=all.filter(o=>o.pipelineId===c.pipelineId&&o.contactId===contactId);
  if(matches.length>1||matches.some(o=>o.status!=='open'))throw new IntegrationError(409,'Review existing opportunities before moving this contact.');
  const existing=matches[0];let result:Data;
  if(existing&&typeof existing.id==='string')result=await this.request(`/opportunities/${encodeURIComponent(existing.id)}`,'PUT',{pipelineStageId:c.stageId});
  else result=await this.request('/opportunities/','POST',{locationId:c.locationId,pipelineId:c.pipelineId,pipelineStageId:c.stageId,contactId,name:`${c.businessName} meeting`,status:'open'});
  const o=isRecord(result.opportunity)?result.opportunity:result;if(typeof o.id!=='string')throw new GhlWriteUncertain();return o.id;
 }
 async send(c:BookingConfig,contactId:string,appointmentId:string,channel:'Email'|'SMS',text:string,inviteUrl?:string):Promise<string>{
  const r=await this.request('/conversations/messages','POST',{type:channel,contactId,appointmentId,message:text,status:'pending',...(channel==='Email'?{emailFrom:c.emailFrom,subject:`Your meeting with ${c.businessName}`,attachments:inviteUrl?[inviteUrl]:[]}:{fromNumber:c.smsFrom})});
  if(typeof r.messageId!=='string')throw new GhlWriteUncertain();return r.messageId;
 }
 async messageStatus(id:string):Promise<'accepted'|'delivered'|'failed'>{const r=await this.request(`/conversations/messages/${encodeURIComponent(id)}`);const m=isRecord(r.message)?r.message:r;if(m.id!==id&&m.messageId!==id)throw new IntegrationError(502,'Message identity is not confirmed.');return ['delivered','read'].includes(String(m.status))?'delivered':m.status==='failed'?'failed':'accepted';}
}
export function appointmentSummary(e:Data){return {appointmentId:String(e.id),startTime:new Date(String(e.startTime)).toISOString(),endTime:new Date(String(e.endTime)).toISOString(),meetingUrl:safeMeetingUrl(e.address)};}
