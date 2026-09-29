import {createHash} from 'node:crypto';
export interface RetellConfig {agentId:string;version:number;llmId:string;llmVersion:number;voiceId:string;from:string;agentHash:string;llmHash:string;quoteExpiresAt:string;maximumCents:number;rateUsdPerMinute:number}
export function retellConfigHash(value:unknown):string{
 function canonical(v:unknown):unknown{if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['last_modification_timestamp','assigned_tags','is_published'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)]));return v;}
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
