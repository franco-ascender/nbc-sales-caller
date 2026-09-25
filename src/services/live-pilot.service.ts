import 'server-only';
import { randomUUID } from 'node:crypto';
import { database, IntegrationError } from './integration.service';
import { PILOT_ROUND, type PilotView, type PilotResult, type PilotState } from '@/lib/live-pilot';
import { createApifyDiscoveryProvider } from './lead-engine-apify';
import type { DiscoveryJob } from '@/lib/lead-engine-discovery';
import { parseDiscoveryCandidate } from '@/lib/lead-engine-scrape';
import { isChain } from '@/lib/lead-engine-brands';

interface Settings { agentId:string; from:string; destination:string }
interface Round { id:string; owner_id:string; cap_cents:number; paused:boolean; settings:Settings }
interface Slot { key:string; kind:'phone'|'scrape'; title:string; allocation_cents:number; reserve_cents:number; config:{industry?:string; city?:string; state?:string; location?:string; count?:number} }
interface Provider { callSid?:string; agentId?:string; job?:DiscoveryJob; phase?:string }
interface Operation { key:string; state:PilotState; reserved_cents:number; reported_microusd:number|null; provider:Provider; result:PilotResult; version:number }
interface Agent { conversation_config:{agent:{first_message:string; prompt:{llm:string; max_tokens:number; prompt:string; tool_ids?:string[]; knowledge_base?:unknown[]; tools?:Array<{type:string;name:string}>}};conversation:{max_duration_seconds:number};tts:{agent_output_audio_format:string};asr:{user_input_audio_format:string}};platform_settings:{auth:{enable_auth:boolean};call_limits:{bursting_enabled:boolean;agent_concurrency_limit:number;daily_limit:number}} }
interface PhoneCall { sid:string; status:string; duration:string|null; price:string|null; price_unit:string; to:string; from:string }
interface Conversation { status:string; transcript:Array<{role:string;message:string|null}>; analysis?:{transcript_summary?:string}; metadata:{phone_call?:{call_sid:string};cost?:number;termination_reason?:string;charging?:{platform_price?:number|null;llm_price?:number|null}} }
const terminal = (state:string):boolean => ['completed','failed','stopped'].includes(state);
function fail(message:string,status=503):never { throw new IntegrationError(status,message); }
async function remote<T>(url:string,headers:Record<string,string>,init:RequestInit={},asText=false):Promise<T> {
  let r:Response;
  try { r=await fetch(url,{...init,headers:{...headers,...init.headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}); }
  catch { return fail('Provider response was not confirmed. Refresh this test; do not start a replacement.'); }
  if(!r.ok) return fail(`The provider rejected this step (HTTP ${r.status}). The reserved budget is retained.`);
  const text=await r.text(); if(text.length>4*1024*1024) return fail('Provider response exceeded the test limit.');
  if(asText) return text as T;
  try{return JSON.parse(text) as T;}catch{return fail('Provider response could not be verified.');}
}
function required(name:string):string { const value=process.env[name]; if(!value)return fail('This test connection is not configured.');return value; }
const apify=<T>(path:string,init?:RequestInit):Promise<T>=>remote<T>(`https://api.apify.com/v2/${path}`,{Authorization:`Bearer ${required('APIFY_API_TOKEN')}`},init);
const el=<T>(path:string,init?:RequestInit,text=false):Promise<T>=>remote<T>(`https://api.elevenlabs.io/v1/${path}`,{'xi-api-key':required('ELEVENLABS_API_KEY'),'Content-Type':'application/json'},init,text);
const twAuth=():Record<string,string>=>({Authorization:`Basic ${Buffer.from(`${required('TWILIO_ACCOUNT_SID')}:${required('TWILIO_AUTH_TOKEN')}`).toString('base64')}`});
const tw=<T>(path:string,init?:RequestInit):Promise<T>=>remote<T>(`https://api.twilio.com/2010-04-01/Accounts/${required('TWILIO_ACCOUNT_SID')}/${path}`,twAuth(),init);
async function load(owner:string):Promise<{round:Round;slots:Slot[];operations:Operation[]}> {
  const db=database(); const round=await db.from('nbc_pilot_rounds').select('*').eq('id',PILOT_ROUND).eq('owner_id',owner).maybeSingle();
  if(round.error) return fail('The test center could not load its budget.');
  if(!round.data) return fail('This private test round is not assigned to your account.',403);
  const [slots,operations]=await Promise.all([db.from('nbc_pilot_slots').select('*').eq('round_id',PILOT_ROUND).order('key'),db.from('nbc_pilot_operations').select('*').eq('round_id',PILOT_ROUND)]);
  if(slots.error||operations.error)return fail('The test center could not load its results.');
  return {round:round.data as Round,slots:(slots.data??[]) as Slot[],operations:(operations.data??[]) as Operation[]};
}
export async function pilotView(owner:string):Promise<PilotView> {
  const {round,slots,operations}=await load(owner);
  const reserved=operations.reduce((n,o)=>n+o.reserved_cents,0);
  return {capCents:round.cap_cents,reservedCents:reserved,reportedMicrousd:operations.reduce((n,o)=>n+Number(o.reported_microusd??0),0),availableCents:Math.max(0,round.cap_cents-reserved),paused:round.paused,
    pending:operations.some(o=>!terminal(o.state)),destinationLast4:round.settings.destination.slice(-4),
    slots:slots.map(s=>{const o=operations.find(o=>o.key===s.key);return {key:s.key,kind:s.kind,title:s.title,allocationCents:s.allocation_cents,reserveCents:s.reserve_cents,count:s.config.count??null,state:o?.state??'ready',reportedMicrousd:o?.reported_microusd??null,result:o?.result??{}};})};
}
function rpcError(message:string):never {
  if(message.includes('pilot_stale')||message.includes('pilot_terminal'))return fail('The result changed. Refresh to see the latest status.',409);
  if(message.includes('pilot_operation_pending'))return fail('Finish or reconcile the current test before starting another.',409);
  if(message.includes('pilot_budget_exceeded')||message.includes('pilot_paused'))return fail('The approved budget does not allow another test.',409);
  return fail('The test reservation could not be confirmed. No replacement will be started.');
}
async function observe(owner:string,o:Operation,state:PilotState,provider:Provider,result:PilotResult,reported:number|null=null):Promise<Operation> {
  const {data,error}=await database().rpc('nbc_pilot_observe',{p_owner:owner,p_key:o.key,p_version:o.version,p_state:state,p_provider:provider,p_result:result,p_reported:reported});
  if(error)return rpcError(error.message);return data as Operation;
}
async function preflightPhone(s:Settings):Promise<void> {
  if(!/^agent_[a-z0-9]+$/.test(s.agentId)||![s.from,s.destination].every(x=>/^\+1[2-9]\d{9}$/.test(x)))return fail('The approved phone configuration is incomplete.');
  const [a,sub,numbers,price,balance]=await Promise.all([
    el<Agent>(`convai/agents/${s.agentId}`),el<{status:string;character_limit:number;character_count:number;can_extend_character_limit:boolean}>('user/subscription'),
    tw<{incoming_phone_numbers:Array<{phone_number:string;capabilities:{voice:boolean}}>}>('IncomingPhoneNumbers.json?PageSize=50'),
    remote<{outbound_prefix_prices:Array<{destination_prefixes:string[];current_price:string}>}>('https://pricing.twilio.com/v2/Voice/Countries/US',twAuth()),tw<{balance:string;currency:string}>('Balance.json'),
  ]);
  const p=a.conversation_config.agent.prompt;
  const rates=price.outbound_prefix_prices.filter(r=>r.destination_prefixes.some(x=>s.destination.slice(1).startsWith(x)));
  if(a.conversation_config.conversation.max_duration_seconds!==600||!a.platform_settings.auth.enable_auth||a.platform_settings.call_limits.bursting_enabled||a.platform_settings.call_limits.agent_concurrency_limit!==1
    ||p.llm!=='gpt-4.1-mini'||!(p.max_tokens>0&&p.max_tokens<=140)||p.prompt.length>20000||!p.prompt.includes('Nalify')||p.tool_ids?.length||p.knowledge_base?.length||(p.tools??[]).some(t=>t.type!=='system'||t.name!=='end_call')
    ||a.conversation_config.asr.user_input_audio_format!=='ulaw_8000'||a.conversation_config.tts.agent_output_audio_format!=='ulaw_8000'
    ||sub.status!=='active'||sub.can_extend_character_limit!==false||sub.character_limit-sub.character_count<20000
    ||!numbers.incoming_phone_numbers.some(n=>n.phone_number===s.from&&n.capabilities.voice)||balance.currency!=='USD'||Number(balance.balance)<1
    ||!rates.length||rates.some(r=>!(Number(r.current_price)>0&&Number(r.current_price)<=.014))) return fail('The phone test no longer fits its approved configuration or budget.');
}
async function preflightScrape():Promise<void> {
  type Pricing={startedAt:string;pricingModel:string;minimalMaxTotalChargeUsd?:number;pricingPerEvent?:{actorChargeEvents?:Record<string,{eventPriceUsd?:number;eventTieredPricingUsd?:Record<string,{tieredEventPriceUsd:number}>}>}};
  const [a,me,limits]=await Promise.all([apify<{data:{pricingInfos:Pricing[]}}>('acts/nwua9Gu5YrADL7ZDj'),apify<{data:{plan:{id:string}}}>('users/me'),apify<{data:{limits:{maxMonthlyUsageUsd:number};current:{monthlyUsageUsd:number;activeActorJobCount:number}}}>('users/me/limits')]);
  const rate=a.data.pricingInfos.filter(p=>Date.parse(p.startedAt)<=Date.now()).sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)).at(-1);
  const event=rate?.pricingPerEvent?.actorChargeEvents?.['place-scraped'];const unit=event?.eventTieredPricingUsd?.[me.data.plan.id]?.tieredEventPriceUsd??event?.eventPriceUsd;
  if(rate?.pricingModel!=='PAY_PER_EVENT'||!unit||unit>.004||(rate.minimalMaxTotalChargeUsd??0)>.5||limits.data.limits.maxMonthlyUsageUsd-limits.data.current.monthlyUsageUsd<.75||limits.data.current.activeActorJobCount!==0)return fail('The listing search no longer fits the approved rate or available provider balance.');
}
export async function startPilot(owner:string,key:string):Promise<PilotView> {
  const {round,slots,operations}=await load(owner);const slot=slots.find(s=>s.key===key);if(!slot)return fail('Choose an approved test.',400);
  if(operations.some(o=>o.key===key))return pilotView(owner);
  if(slot.kind==='phone')await preflightPhone(round.settings);else await preflightScrape();
  const {data,error}=await database().rpc('nbc_pilot_reserve',{p_owner:owner,p_key:key});if(error)return rpcError(error.message);
  const claim=data as {acquired:boolean;operation:Operation};if(!claim.acquired)return pilotView(owner);
  let o=claim.operation;let provider:Provider={phase:'reserved'};
  try {
    if(slot.kind==='phone') {
      const s=round.settings;provider={agentId:s.agentId,phase:'registering'};o=await observe(owner,o,'dispatching',provider,{});
      const xml=await el<string>('convai/twilio/register-call',{method:'POST',body:JSON.stringify({agent_id:s.agentId,from_number:s.from,to_number:s.destination,direction:'outbound'})},true);
      if(xml.length>4000||!xml.includes('<Response>')||!xml.includes('<Stream ')||!xml.includes('wss://')||/<(Dial|Record|Redirect|Pay|Say)\b/i.test(xml))return fail('The phone connection response was not valid.');
      provider={...provider,phase:'dispatching'};o=await observe(owner,o,'dispatching',provider,{});
      const call=await tw<PhoneCall>('Calls.json',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:s.from,To:s.destination,Twiml:xml,TimeLimit:'600',Timeout:'25',Record:'false'})});
      if(!/^CA[0-9a-f]{32}$/i.test(call.sid))return fail('The call identity could not be confirmed.');
      provider={...provider,callSid:call.sid,phase:'dispatched'};await observe(owner,o,'running',provider,{providerStatus:call.status,message:'Your phone test is connecting.'});
    }else{
      const c=slot.config;if(!c.location||!c.industry||!c.count||c.count>50)return fail('Invalid approved search configuration.');
      const job:DiscoveryJob={operatorId:owner,batchId:randomUUID(),planId:randomUUID(),actorId:'nwua9Gu5YrADL7ZDj',build:'0.14.757',searchTerm:c.industry,location:c.location,maxResults:c.count,maxCostCents:50,status:'dispatching',runId:null,datasetId:null};
      provider={job,phase:'dispatching'};o=await observe(owner,o,'dispatching',provider,{});
      const observed=await createApifyDiscoveryProvider(required('APIFY_API_TOKEN')).start(job);
      provider={job:{...job,...observed},phase:'dispatched'};await observe(owner,o,'running',provider,{message:'Finding published business listings.'});
    }
  }catch(error){
    try{await observe(owner,o,'uncertain',provider,{message:'Dispatch needs reconciliation. Refresh this test; the budget stays reserved and this test cannot be started twice.'});}catch{/* Persisted claim still blocks all repeat dispatch. */}
    throw error;
  }
  return pilotView(owner);
}
export async function checkPilot(owner:string,key:string):Promise<PilotView>{
  const {round,slots}=await load(owner);const slot=slots.find(s=>s.key===key);if(!slot)return fail('Choose an approved test.',400);
  if(slot.kind==='phone')await preflightPhone(round.settings);else await preflightScrape();
  return pilotView(owner);
}
export async function syncPilot(owner:string,key:string,stop=false):Promise<PilotView> {
  const {round,slots,operations}=await load(owner);const slot=slots.find(s=>s.key===key),o=operations.find(o=>o.key===key);
  if(!slot||!o)return fail('That test has not started.',404);
  if(stop&&terminal(o.state))return pilotView(owner);
  let state:PilotState=o.state,result:PilotResult={...o.result},reported:number|null=null;
  if(slot.kind==='phone'){
    const sid=o.provider.callSid;if(!sid||!/^CA[0-9a-f]{32}$/i.test(sid))return fail('The call ID is not confirmed. Operator reconciliation is required; no new call will be created.',409);
    let call=await tw<PhoneCall>(`Calls/${sid}.json`);
    if(call.sid!==sid||call.to!==round.settings.destination||call.from!==round.settings.from)return fail('Call identity mismatch.');
    if(stop&&['queued','ringing','in-progress'].includes(call.status))call=await tw<PhoneCall>(`Calls/${sid}.json`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({Status:call.status==='in-progress'?'completed':'canceled'})});
    const ended=['completed','busy','failed','no-answer','canceled'].includes(call.status);
    state=ended?(terminal(o.state)?o.state:call.status==='completed'?'completed':call.status==='canceled'?'stopped':'failed'):'running';
    result={...result,providerStatus:call.status,durationSeconds:Number(call.duration??0),voiceUsd:call.price_unit==='USD'&&call.price!==null?Math.abs(Number(call.price)):null,message:ended?'Call ended. Results are read from the voice provider.':'Your call is active.',costComplete:false,costNote:'Reported usage only. Remaining phone charges may arrive later; the full reservation stays held.'};
    if(ended){
      const list=await el<{conversations:Array<{conversation_id:string}>}>(`convai/conversations?agent_id=${round.settings.agentId}&page_size=10`);
      for(const item of list.conversations){
        if(!/^conv_[a-z0-9]+$/.test(item.conversation_id))continue;
        const detail=await el<Conversation>(`convai/conversations/${item.conversation_id}`);
        if(detail.metadata?.phone_call?.call_sid!==sid)continue;
        const charge=detail.metadata.charging;
        result.transcript=(detail.transcript??[]).filter(t=>typeof t.message==='string').map(t=>({role:t.role,message:t.message!.slice(0,10000)}));
        result.summary=detail.analysis?.transcript_summary?.slice(0,5000);
        result.agentCredits=detail.metadata.cost??null;
        result.agentUsd=typeof charge?.platform_price==='number'&&typeof charge.llm_price==='number'?charge.platform_price+charge.llm_price:null;
        result.outcome=detail.metadata.termination_reason;break;
      }
    }
    if(result.agentUsd!=null||result.voiceUsd!=null)reported=Math.ceil(((result.agentUsd??0)+(result.voiceUsd??0))*1e6);
  }else{
    const job=o.provider.job;if(!job?.runId||!job.datasetId)return fail('The search ID is not confirmed. Operator reconciliation is required; no replacement search will be started.',409);
    if(stop&&!terminal(o.state))await apify(`actor-runs/${job.runId}/abort`,{method:'POST'});
    const observed=await createApifyDiscoveryProvider(required('APIFY_API_TOKEN')).poll(job);
    if(observed.status==='running')state='running';else{
      const [receipt,rows]=await Promise.all([apify<{data:{id:string;usageTotalUsd:number}}>(`actor-runs/${job.runId}`),apify<unknown[]>(`datasets/${job.datasetId}/items?format=json&limit=150&clean=true`)]);
      if(receipt.data.id!==job.runId||!Number.isFinite(receipt.data.usageTotalUsd)||receipt.data.usageTotalUsd<0||!Array.isArray(rows)||rows.length>125)return fail('Search receipt or dataset could not be verified.');
      const seen=new Set<string>();
      const reviewed=rows.map(row=>{const parsed=parseDiscoveryCandidate(row,{industry:slot.config.industry!,metro:`${slot.config.city}, ${slot.config.state}`,target:slot.config.count!,hardBudgetCents:slot.allocation_cents,exclusions:[]});const duplicate=seen.has(parsed.businessKey);seen.add(parsed.businessKey);return {...parsed,duplicate,chain:isChain(parsed.name,slot.config.industry!)};});
      state=terminal(o.state)?o.state:observed.status==='succeeded'?'completed':stop?'stopped':'failed';reported=Math.ceil(receipt.data.usageTotalUsd*1e6);
      result={...result,rawBusinesses:rows.length,acceptedForReview:reviewed.filter(r=>!r.rejection&&!r.duplicate&&!r.chain).length,rows:reviewed,message:'Published business listings. Phone verification and owner identity remain unconfirmed.',costComplete:false,costNote:'Search receipt; data-read fees may arrive later. Reservation retained.'};
    }
  }
  await observe(owner,o,state,o.provider,result,reported);return pilotView(owner);
}
export async function pilotFeedback(owner:string,key:string,feedback:string):Promise<PilotView>{
  const {operations}=await load(owner);const o=operations.find(o=>o.key===key);if(!o)return fail('Choose a completed or active test.',404);
  await observe(owner,o,o.state,o.provider,{...o.result,feedback});return pilotView(owner);
}
