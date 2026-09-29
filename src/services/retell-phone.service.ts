import 'server-only';
import {IntegrationError} from './integration.service';
import {retellConfigHash,type RetellConfig} from '@/lib/retell-config';
import {retellReceipt} from '@/lib/caller-measurements';
import type {PilotResult,PilotState} from '@/lib/live-pilot';
type Data=Record<string,unknown>;
export async function retellApi(path:string,method:'GET'|'POST'='GET',body?:unknown):Promise<Data>{
 const key=process.env.RETELL_API_KEY;if(!key)throw new IntegrationError(503,'The phone engine is not configured.');
 let r:Response;try{r=await fetch('https://api.retellai.com'+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new IntegrationError(503,'Phone response not confirmed. Refresh saved status; do not start a replacement.');}
 if(!r.ok)throw new IntegrationError(503,`Phone provider rejected the request (HTTP ${r.status}). Refresh saved status before retrying.`);
 if(r.status===204)return{};const text=await r.text();if(text.length>4*1024*1024)throw new IntegrationError(503,'Phone response exceeded the size limit.');try{return JSON.parse(text) as Data;}catch{throw new IntegrationError(503,'Phone response is invalid.');}
}
export async function preflightRetell(c:RetellConfig):Promise<void>{
 if(!c||!/^agent_[\w-]+$/.test(c.agentId)||!/^llm_[\w-]+$/.test(c.llmId)||!Number.isSafeInteger(c.version)||c.version<0||!Number.isSafeInteger(c.llmVersion)||c.llmVersion<0||!/^\+1[2-9]\d{9}$/.test(c.from)||c.maximumCents!==250||!(c.rateUsdPerMinute>0&&c.rateUsdPerMinute<=.2)||!(Date.parse(c.quoteExpiresAt)>Date.now()))throw new IntegrationError(409,'Review the phone configuration and current cost approval.');
 const[a,l,n]=await Promise.all([retellApi(`/get-agent/${c.agentId}?version=${c.version}`),retellApi(`/get-retell-llm/${c.llmId}?version=${c.llmVersion}`),retellApi('/get-phone-number/'+encodeURIComponent(c.from))]);
 if(a.agent_id!==c.agentId||a.version!==c.version||a.is_published!==true||a.voice_id!==c.voiceId||a.max_call_duration_ms!==600000||l.model!=='gpt-4.1-mini'||l.model_high_priority===true||retellConfigHash(a)!==c.agentHash||retellConfigHash(l)!==c.llmHash||n.phone_number!==c.from||n.phone_number_type!=='retell-twilio')throw new IntegrationError(409,'The phone configuration changed. Review its quote before calling.');
}
export async function dispatchRetell(c:RetellConfig,to:string,key:string):Promise<string>{
 const r=await retellApi('/v2/create-phone-call','POST',{from_number:c.from,to_number:to,override_agent_id:c.agentId,override_agent_version:c.version,metadata:{nbc_operation:key}});
 if(typeof r.call_id!=='string'||!/^call_[\w-]+$/.test(r.call_id)||r.agent_id!==c.agentId||r.from_number!==c.from||r.to_number!==to)throw new IntegrationError(503,'Call identity not confirmed; reconciliation is required.');
 return r.call_id;
}
export async function reconcileRetell(c:RetellConfig,to:string,id:string,stop=false):Promise<{state:PilotState;result:PilotResult;reported:number|null}>{
 if(!/^call_[\w-]+$/.test(id))throw new IntegrationError(409,'Call identity is missing. No replacement call will be started.');
 const read=async()=>{const r=await retellApi('/v2/get-call/'+id);if(r.call_id!==id||r.agent_id!==c.agentId||r.agent_version!==c.version||r.from_number!==c.from||r.to_number!==to)throw new IntegrationError(409,'Saved phone identity does not match the provider.');return r;};
 let r=await read();if(stop&&['registered','ongoing'].includes(String(r.call_status))){await retellApi('/v2/stop-call/'+id,'POST');r=await read();}
 const ended=['ended','error','not_connected'].includes(String(r.call_status)),state:PilotState=ended?r.call_status==='ended'?'completed':'failed':'running',receipt=retellReceipt(r);
 const transcript=Array.isArray(r.transcript_object)?r.transcript_object.filter(t=>t&&typeof t.content==='string'&&['agent','user'].includes(t.role)).map(t=>({role:t.role as string,message:(t.content as string).slice(0,10000)})):[];
 const analysis=r.call_analysis&&typeof r.call_analysis==='object'?r.call_analysis as Data:{};
 return{state,reported:receipt.costMicrousd,result:{phoneEngine:'retell',retellCostMicrousd:receipt.costMicrousd,retellComponents:receipt.components,providerStatus:String(r.call_status),durationSeconds:receipt.durationMs===null?undefined:receipt.durationMs/1000,transcript,summary:typeof analysis.call_summary==='string'?analysis.call_summary:undefined,outcome:typeof r.disconnection_reason==='string'?r.disconnection_reason:undefined,latency:receipt.latency,measuredAt:new Date().toISOString(),costComplete:ended&&receipt.costMicrousd!==null,costNote:'Provider-reported bundled usage, including its voice, model and telephony line items. Not a second ElevenLabs or Twilio charge.',message:ended?'Call ended. Refresh the saved result if analysis or cost is still pending.':'Your call is connecting or active.'}};
}
