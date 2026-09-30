import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {database,IntegrationError} from './integration.service';
import {PILOT_ROUND} from '@/lib/live-pilot';
import {priceSearch,type SearchRates,type SearchQuote} from '@/lib/lead-cycle-quote';
import type {CycleInput} from '@/lib/lead-cycle';
const actor='nwua9Gu5YrADL7ZDj';
async function read(path:string):Promise<any>{
 const key=process.env.APIFY_API_TOKEN;if(!key)throw new IntegrationError(503,'Search pricing is not connected.');
 const r=await fetch('https://api.apify.com/v2/'+path,{headers:{Authorization:'Bearer '+key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new IntegrationError(503,'Current search pricing could not be confirmed. No search has started.');return (await r.json()).data;
}
export async function currentSearchRates(owner:string):Promise<SearchRates>{
 const {data:round,error}=await database().from('nbc_pilot_rounds').select('settings').eq('id',PILOT_ROUND).eq('owner_id',owner).maybeSingle();
 if(error||!round)throw new IntegrationError(403,'This search workspace is not assigned to your account.');
 const v=round.settings?.verification;
 if(!process.env.BATCHDATA_API_KEY||v?.provider!=='batchdata'||!(Date.parse(v.confirmedAt)>Date.now()-30*86400000)||Date.parse(v.confirmedAt)>Date.now())throw new IntegrationError(409,'Confirm the verification account rate before estimating the full list.');
 const [a,u,l]=await Promise.all([read('acts/'+actor),read('users/me'),read('users/me/limits')]);
 const p=a.pricingInfos?.filter((p:any)=>Date.parse(p.startedAt)<=Date.now()).sort((a:any,b:any)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)).at(-1);
 if(p?.pricingModel!=='PAY_PER_EVENT')throw new IntegrationError(409,'Search pricing changed. Review the integration before authorizing a search.');
 const events=p.pricingPerEvent?.actorChargeEvents??{};
 const unit=(key:string)=>{const e=events[key];if(!e)return 0;const value=e.eventTieredPricingUsd?.[u.plan.id]?.tieredEventPriceUsd??e.eventPriceUsd;if(!Number.isFinite(value)||value<0)throw new IntegrationError(409,'The account price is unavailable.');return value;};
 const services=u.plan.planPricing?.chargeableServiceUnitPricesUsd;
 if(!services||!Number.isFinite(services.DATASET_READS)||!Number.isFinite(services.DATA_TRANSFER_EXTERNAL_GBYTES)||!Number.isFinite(services.DATASET_TIMED_STORAGE_GBYTE_HOURS)||!Number.isFinite(u.plan.dataRetentionDays))throw new IntegrationError(409,'Data delivery pricing could not be confirmed.');
 return {placeMicrousd:Math.ceil(unit('place-scraped')*1e6),startMicrousd:Math.ceil((unit('actor-start')+4*unit('apify-actor-start'))*1e6),minimumCapCents:Math.ceil((p.minimalMaxTotalChargeUsd??0)*100),readMicrousd:services.DATASET_READS*1e6,transferUsdPerGb:services.DATA_TRANSFER_EXTERNAL_GBYTES,storageUsdPerGbHour:services.DATASET_TIMED_STORAGE_GBYTE_HOURS,retentionHours:u.plan.dataRetentionDays*24,availableCents:Math.max(0,Math.floor((l.limits.maxMonthlyUsageUsd-l.current.monthlyUsageUsd)*100)),activeRuns:l.current.activeActorJobCount,verificationUnitCents:v.unitCents,checkedAt:new Date().toISOString()};
}
const details=(input:CycleInput)=>({name:input.name,industry:input.industry,city:input.city,state:input.state,count:input.count});
function signature(value:string):Buffer{const key=process.env.SUPABASE_SECRET_KEY;if(!key)throw new IntegrationError(503,'Cost approval signing is unavailable.');return createHmac('sha256',key).update('nbc-search-quote-v1:'+value).digest();}
export async function quoteSearch(owner:string,input:CycleInput):Promise<SearchQuote>{
 const quote={...priceSearch(input.count,await currentSearchRates(owner)),expiresAt:new Date(Date.now()+15*60000).toISOString()};
 const body=Buffer.from(JSON.stringify({owner,input:details(input),quote})).toString('base64url');return {...quote,token:body+'.'+signature(body).toString('base64url')};
}
export function verifySearchQuote(owner:string,input:CycleInput):SearchQuote{
 try{const [body,sig,...extra]=(input.quoteToken??'').split('.');const expected=signature(body),actual=Buffer.from(sig,'base64url');if(extra.length||expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error();const payload=JSON.parse(Buffer.from(body,'base64url').toString());if(payload.owner!==owner||JSON.stringify(payload.input)!==JSON.stringify(details(input))||Date.parse(payload.quote.expiresAt)<=Date.now()||payload.quote.maximumCents!==input.approvedMaxCents||payload.quote.blockers.length)throw Error();return {...payload.quote,token:input.quoteToken!};}catch{throw new IntegrationError(409,'Review a fresh estimate for these exact list details before approving.');}
}
