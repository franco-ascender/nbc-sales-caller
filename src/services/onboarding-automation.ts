import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {OnboardingError,channelName,validId,type IntakeRecord,type OnboardingTransport} from '../lib/client-onboarding.ts';
import {loadOnboarding,updateOnboarding} from './onboarding-store';
const ORIGIN='https://nbc-sales-nbc-sales.vercel.app';
export function configuredTransport():OnboardingTransport {
 const mode=process.env.ONBOARDING_TRANSPORT||'clickup';
 if(mode!=='clickup'&&mode!=='zapier')throw new OnboardingError(503,'The onboarding connection needs configuration. Drafts can still be saved.');
 return mode;
}
function callbackKey():string {
 const key=process.env.ONBOARDING_CALLBACK_SECRET??'';
 if(key.length<32)throw new OnboardingError(503,'The automation receipt connection is not configured.');
 return key;
}
export function automationToken(id:string):string{return createHmac('sha256',callbackKey()).update('nbc-onboarding:v1:'+validId(id)).digest('hex');}
export function zapierConfiguration():{url:string} {
 let url:URL;
 try{url=new URL(process.env.ONBOARDING_ZAPIER_WEBHOOK_URL??'');}catch{throw new OnboardingError(503,'The direct automation connection is not configured.');}
 if(url.protocol!=='https:'||url.hostname!=='hooks.zapier.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/hooks\/catch\/[0-9]+\/[A-Za-z0-9_-]+\/$/.test(url.pathname))throw new OnboardingError(503,'The automation URL must be a Zapier Catch Hook.');
 callbackKey();return {url:url.toString()};
}
export function automationPayload(row:IntakeRecord){return {
 schema_version:1,event:'nbc.onboarding.started',event_id:row.id,program:'ELITE',
 company:row.intake.company,primary_name:row.intake.name,primary_email:row.intake.email,
 partner_name:row.intake.partnerName,partner_email:row.intake.partnerEmail,
 fathom_url:row.intake.recording,transcript_url:row.intake.transcript,channel_name:channelName(row.intake.company),
 callback_url:`${ORIGIN}/api/onboarding/automation/${row.id}`,callback_token:automationToken(row.id),
 };}
// Every POST happens after a durable claim. Never retry a network/HTTP failure automatically.
export async function dispatchAutomation(row:IntakeRecord,actor:string):Promise<IntakeRecord>{
 let accepted=false;
 try{const {url}=zapierConfiguration();const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(automationPayload(row)),redirect:'error',signal:AbortSignal.timeout(15000)});accepted=response.ok;}catch{/* Receipt is ambiguous, never fall back to ClickUp. */}
 // The Zap may already have claimed/completed while its HTTP response was in flight.
 const latest=await loadOnboarding(row.id);
 if(latest.state!=='starting'||latest.revision!==row.revision)return latest;
 try{return await updateOnboarding(latest,actor,{state:accepted?'automation_pending':'uncertain',issue:accepted?'Request received. Waiting for the automation to report Slack setup.':'Delivery could not be confirmed. Check Zap history; this request will not be sent again automatically.'});}
 catch(e){if(e instanceof OnboardingError&&e.status===409)return loadOnboarding(row.id);throw e;}
}
export function authenticateAutomation(request:Request,id:string):void {
 const actual=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!/^[a-f0-9]{64}$/.test(actual))throw new OnboardingError(401,'Invalid automation receipt.');
 const expected=automationToken(id);
 if(!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw new OnboardingError(401,'Invalid automation receipt.');
}
function bodyObject(body:unknown):Record<string,unknown>{if(!body||typeof body!=='object'||Array.isArray(body))throw new OnboardingError(400,'Invalid automation receipt.');return body as Record<string,unknown>;}
export async function receiveAutomation(id:string,input:unknown):Promise<{run?:boolean;recorded?:boolean}> {
 const body=bodyObject(input);const row=await loadOnboarding(id);
 if(row.transport!=='zapier'||!['starting','automation_pending','uncertain','slack_ready'].includes(row.state))throw new OnboardingError(409,'This onboarding is not assigned to the direct automation.');
 if(body.action==='claim'){
  if(row.automation_claimed_at||row.state==='slack_ready')return {run:false};
  try{await updateOnboarding(row,null,{automation_claimed_at:new Date().toISOString(),state:'automation_pending',issue:'Automation claimed the request. Waiting for its Slack receipt.'});return {run:true};}
  catch(e){if(e instanceof OnboardingError&&e.status===409){const latest=await loadOnboarding(id);if(latest.automation_claimed_at)return {run:false};}throw e;}
 }
 if(body.action==='complete'){
  if(!row.automation_claimed_at)throw new OnboardingError(409,'Claim this event before running Slack actions.');
  const channel=body.channel_id,ts=body.message_ts;
  if(typeof channel!=='string'||! /^[CG][A-Z0-9]{8,30}$/.test(channel)||typeof ts!=='string'||! /^[0-9]{10,}\.[0-9]{6}$/.test(ts))throw new OnboardingError(400,'A Slack channel ID and welcome message timestamp are required.');
  if(row.state==='slack_ready'){
   if(row.slack_channel_id!==channel||row.welcome_message_ts!==ts)throw new OnboardingError(409,'This event already has a different Slack receipt.');return {recorded:true};
  }
  try{await updateOnboarding(row,null,{state:'slack_ready',slack_channel_id:channel,welcome_message_ts:ts,issue:null});return {recorded:true};}
  catch(e){if(e instanceof OnboardingError&&e.status===409){const latest=await loadOnboarding(id);if(latest.state==='slack_ready'&&latest.slack_channel_id===channel&&latest.welcome_message_ts===ts)return {recorded:true};}throw e;}
 }
 throw new OnboardingError(400,'Choose claim or complete.');
}
