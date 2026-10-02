import 'server-only';
import {createHash,timingSafeEqual} from 'node:crypto';
import {database} from './integration.service';
import {OnboardingError} from '../lib/client-onboarding.ts';
import {contactIntake,ghlId,object,opportunityFromWebhook,type GhlReceipt} from '../lib/onboarding-ghl.ts';

const TABLE='nbc_onboarding_ghl_receipts';
const SELECT='id,opportunity_id,contact_id,intake,issues,received_at,mode';
function config(){
 const token=process.env.ONBOARDING_GHL_API_TOKEN;
 const location=process.env.ONBOARDING_GHL_LOCATION_ID;
 const pipeline=process.env.ONBOARDING_GHL_PIPELINE_ID;
 const stage=process.env.ONBOARDING_GHL_STAGE_ID;
 if(!token||!location||!pipeline||!stage)throw new OnboardingError(503,'GHL onboarding capture is not configured.');
 return {token,location,pipeline,stage,recordingField:process.env.ONBOARDING_GHL_RECORDING_FIELD_ID??''};
}
export function authenticateGhlOnboarding(request:Request):void {
 const secret=process.env.ONBOARDING_GHL_WEBHOOK_SECRET;
 if(!secret||secret.length<32)throw new OnboardingError(503,'GHL onboarding capture is not configured.');
 const value=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]??'';
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 if(!value||!timingSafeEqual(hash(value),hash(secret)))throw new OnboardingError(401,'Invalid GHL onboarding credential.');
}
export async function readGhlWebhook(request:Request):Promise<unknown>{
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new OnboardingError(415,'Send application/json.');
 const reader=request.body?.getReader();if(!reader)throw new OnboardingError(400,'A JSON body is required.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new OnboardingError(413,'GHL payload exceeds 64 KB.');}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}
 catch(e){if(e instanceof OnboardingError)throw e;throw new OnboardingError(400,'Invalid JSON.');}finally{reader.releaseLock();}
}
async function readGhl(path:string,token:string):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetch('https://services.leadconnectorhq.com'+path,{headers:{Authorization:'Bearer '+token,Version:'2021-07-28',Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}
 catch{throw new OnboardingError(502,'GHL could not be reached. No automation was started.');}
 if(!response.ok)throw new OnboardingError(502,'GHL could not verify this event. No automation was started.');
 try{return object(await response.json());}catch{throw new OnboardingError(502,'GHL returned an invalid response.');}
}
export async function captureGhlOnboarding(input:unknown){
 const c=config(),opportunityId=opportunityFromWebhook(input);
 const opportunity=object((await readGhl('/opportunities/'+encodeURIComponent(opportunityId),c.token)).opportunity);
 if(opportunity.id!==opportunityId||opportunity.locationId!==c.location)throw new OnboardingError(403,'Opportunity does not belong to the configured NBC subaccount.');
 if(opportunity.pipelineId!==c.pipeline||opportunity.pipelineStageId!==c.stage)return {received:true,mode:'capture',automation_started:false,ignored:true,reason:'outside_target_stage'};
 const contactId=ghlId(opportunity.contactId);
 const contact=object((await readGhl('/contacts/'+encodeURIComponent(contactId),c.token)).contact);
 if(contact.id!==contactId||contact.locationId!==c.location)throw new OnboardingError(403,'Contact does not belong to the configured NBC subaccount.');
 const mapped=contactIntake(contact,c.recordingField);
 const row={location_id:c.location,pipeline_id:c.pipeline,stage_id:c.stage,opportunity_id:opportunityId,contact_id:contactId,...mapped,mode:'capture'};
 // ON CONFLICT DO NOTHING preserves the first receipt; retries cannot duplicate or overwrite it.
 const saved=await database().from(TABLE).upsert(row,{onConflict:'location_id,opportunity_id',ignoreDuplicates:true}).select('id');
 if(saved.error)throw new OnboardingError(503,'The capture receipt could not be saved. No automation was started.');
 return {received:true,mode:'capture',automation_started:false,duplicate:!saved.data?.length,needs_details:mapped.issues.length>0};
}
export async function listGhlReceipts():Promise<GhlReceipt[]>{
 const result=await database().from(TABLE).select(SELECT).order('received_at',{ascending:false}).limit(100);
 if(result.error)throw new OnboardingError(503,'GHL capture receipts could not be loaded.');
 return result.data as GhlReceipt[];
}
