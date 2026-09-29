// Provider payloads are untrusted. Amounts remain null until explicitly reported.
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export const usdMicros=(v:unknown):number|null=>{const n=finite(v);return n!==null&&n<=1e6?Math.round(n*1e6):null;};
export interface LatencySummary {samples:number;p50Ms:number;p90Ms:number;p95Ms:number;p99Ms:number;maxMs:number;maxTurnWaitMs:number|null;definition:string}
function summary(values:number[],definition:string,wait:number[]=[]):LatencySummary|null{
 if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),q=(p:number)=>Math.round(sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]);
 return{samples:values.length,p50Ms:q(.5),p90Ms:q(.9),p95Ms:q(.95),p99Ms:q(.99),maxMs:q(1),maxTurnWaitMs:wait.length?Math.round(Math.max(...wait)):null,definition};
}
export function elevenLatency(payload:unknown):LatencySummary|null{
 const turns=obj(payload).transcript;if(!Array.isArray(turns))return null;const times:number[]=[],waits:number[]=[];let heardUser=false;
 for(const raw of turns){const t=obj(raw);if(t.role==='user')heardUser=true;if(t.role!=='agent'||!heardUser)continue;const metrics=obj(obj(t.conversation_turn_metrics).metrics),elapsed=(k:string)=>finite(obj(metrics[k]).elapsed_time);const time=elapsed('convai_ttf_audio_since_silence'),wait=elapsed('convai_turn_silence_before_initiation');if(time!==null)times.push(time*1000);if(wait!==null)waits.push(wait*1000);}
 return summary(times,'ElevenLabs audio since silence; initial greeting excluded; excludes downstream phone playback delay',waits);
}
export function retellReceipt(payload:unknown){
 const p=obj(payload),cost=obj(p.call_cost),cents=finite(cost.combined_cost),products=Array.isArray(cost.product_costs)?cost.product_costs:[];
 const e2e=obj(obj(p.latency).e2e),values=Array.isArray(e2e.values)?e2e.values.map(finite).filter((v):v is number=>v!==null):[];
 return{costMicrousd:cents===null?null:usdMicros(cents/100),durationMs:finite(p.duration_ms),
  components:products.map(raw=>{const r=obj(raw),c=finite(r.cost);return{product:typeof r.product==='string'?r.product:'unknown',costMicrousd:c===null?null:usdMicros(c/100)};}),
  latency:summary(values,'Retell server end of user speech to agent speech; excludes downstream network delay')};
 // combined_cost is authoritative, potentially discounted; never sum it with components.
}
