import 'server-only';
import {retellReceipt} from '@/lib/caller-measurements';
import {IntegrationError} from './integration.service';

// Deliberately read-only: configuring credentials must never create a call, clone or number.
async function read(path:string):Promise<unknown>{
 const key=process.env.RETELL_API_KEY;if(!key)throw new IntegrationError(503,'Retell is not configured.');
 let response:Response;try{response=await fetch('https://api.retellai.com'+path,{method:'GET',headers:{Authorization:'Bearer '+key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new IntegrationError(503,'Retell could not be reached.');}
 if(!response.ok)throw new IntegrationError(503,`Retell read failed (HTTP ${response.status}).`);
 try{return await response.json();}catch{throw new IntegrationError(503,'Retell returned an invalid response.');}
}
export async function readRetellReceipt(callId:string,expectedAgentId:string){
 if(!/^call_[a-zA-Z0-9_-]{1,100}$/.test(callId)||!/^agent_[a-zA-Z0-9_-]{1,100}$/.test(expectedAgentId))throw new IntegrationError(400,'Invalid saved Retell call identity.');
 const payload=await read('/v2/get-call/'+encodeURIComponent(callId));
 if(!payload||typeof payload!=='object')throw new IntegrationError(503,'Retell call identity could not be verified.');
 const p=payload as Record<string,unknown>;
 if(p.call_id!==callId||p.agent_id!==expectedAgentId)throw new IntegrationError(409,'Retell call identity does not match this operation.');
 return{callId,agentId:expectedAgentId,status:typeof p.call_status==='string'?p.call_status:'unknown',...retellReceipt(payload),observedAt:new Date().toISOString()};
}
