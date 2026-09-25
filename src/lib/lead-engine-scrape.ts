import type { LeadConfidence } from './lead-engine-confidence.ts';
import { LeadEngineError, leadRecord, leadUuid } from './lead-engine-storage.ts';
import { matchesPhrase, normalizeWords } from './lead-engine-plan.ts';
import { normalizeBusinessPhone } from './lead-engine-quality.ts';
import { classifyRelevance, franchiseBrand } from './lead-engine-industries.ts';
import type { FitTier } from './lead-engine-industries.ts';
import { resolveTimeZone } from './lead-engine-timezone.ts';
import type { LeadPlanInput } from './lead-engine-plan.ts';
export interface LeadFolder { id: string; name: string }
export interface ScrapeQuote { id: string; planId: string; name: string; folderId: string | null; maxResults: number; minCostCents: number; maxCostCents: number; expiresAt: string; blockers: string[]; scope: 'discovery_only' }
export interface LeadList { id: string; name: string; folderId: string | null; planId: string; status: string; importStatus: string; processed: number; maxResults: number; reservedCents: number; consumedCents: number; createdAt: string }
export interface LeadListRecord { position: number; name: string; city: string; state: string; website: string | null; sourceUrl: string | null; reviewStatus: string; confidence?: LeadConfidence }
export interface LeadListPage { list: LeadList; records: LeadListRecord[]; nextOffset: number | null }
export interface ScrapeInput { quoteId: string; planId: string; folderId: string | null; name: string; count: number }
export interface DiscoveryCandidate { name: string; city: string; state: string; website: string | null; sourceUrl: string | null; phone10: string | null; placeId: string | null; businessKey: string; rejection: string | null; fitTier: FitTier | null; franchise: string | null; timeZone: string | null }
export function scrapeInvalid(): never { throw new LeadEngineError(400,'invalid_input','Check the request fields, name and business count (1–300).'); }
export function exactScrapeBody(body: unknown, keys: string[]): Record<string,unknown> {
  if (!leadRecord(body) || Object.keys(body).some(key=>!keys.includes(key))) scrapeInvalid(); return body;
}
export function scrapeName(value: unknown): string { if(typeof value!=='string'||!value.trim()||value.trim().length>80||/[\u0000-\u001f\u007f]/.test(value)) scrapeInvalid(); return value.trim(); }
export function scrapeId(value: unknown): string { if(!leadUuid(value)) scrapeInvalid(); return value.toLowerCase(); }
export function folderId(value: unknown): string | null { return value===null ? null : scrapeId(value); }
export function parseScrapeInput(body: unknown): ScrapeInput {
  const b=exactScrapeBody(body,['version','quoteId','planId','folderId','name','count']);
  if(b.version!==1||typeof b.count!=='number'||!Number.isSafeInteger(b.count)||b.count<1||b.count>300) scrapeInvalid();
  return {quoteId:scrapeId(b.quoteId),planId:scrapeId(b.planId),folderId:folderId(b.folderId),name:scrapeName(b.name),count:b.count};
}
export function parseResearchQuery(url: string, allowFolder=false): {offset:number; folder:string|null} {
  const params=new URL(url).searchParams;
  if([...params.keys()].some(k=>!['offset',...(allowFolder?['folder']:[])].includes(k))||params.getAll('offset').length>1||params.getAll('folder').length>1) scrapeInvalid();
  const offset=params.get('offset')??'0'; if(!/^(0|[1-9][0-9]{0,5})$/.test(offset)) scrapeInvalid();
  const folder=params.get('folder'); if(folder!==null&&folder!=='unfiled'&&!leadUuid(folder)) scrapeInvalid();
  return {offset:Number(offset),folder:folder?.toLowerCase()??null};
}
export function safeBusinessUrl(value: unknown, source=false): string | null {
  if(typeof value!=='string'||value.length>2000) return null;
  try {const url=new URL(value); if(!['https:',...(!source?['http:']:[])].includes(url.protocol)||url.username||url.password) return null;
    if(source && !['www.google.com','google.com','maps.google.com'].includes(url.hostname)) return null;
    if(!source && (!url.hostname.includes('.')||url.hostname==='localhost'||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':'))) return null;
    return url.href;
  } catch {return null;}
}
const states='AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|DC:District of Columbia';
const stateNames=new Map(states.split('|').map(pair=>{const [code,name]=pair.split(':');return [normalizeWords(name),code];}));
const codes=new Set(states.split('|').map(pair=>pair.split(':')[0]));
export function parseDiscoveryCandidate(value: unknown, plan: LeadPlanInput): DiscoveryCandidate {
  const row=leadRecord(value)?value:{};
  const str=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
  const name=str(row.title,200),city=str(row.city,150),rawState=str(row.state,100),state=codes.has(rawState)?rawState:stateNames.get(normalizeWords(rawState))??'';
  const phone10=normalizeBusinessPhone(row.phoneUnformatted??row.phone),sourceUrl=safeBusinessUrl(row.url,true);
  const text=[name,str(row.categoryName,150),...(Array.isArray(row.categories)?row.categories.filter(v=>typeof v==='string').slice(0,30):[])].join(' ');
  const fitTier=classifyRelevance(text,plan.industry);
  let rejection:string|null=null;
  if(!name||!city||!state||row.countryCode!=='US'||!sourceUrl) rejection='incomplete_source';
  else if(state!==plan.metro.split(',').at(-1)?.trim()) rejection='outside_requested_state';
  else if(row.permanentlyClosed!==false||row.temporarilyClosed!==false) rejection='operating_status_unconfirmed';
  else if(!phone10) rejection='published_phone_missing';
  else if(/^(800|888|877|866|855|844|833)/.test(phone10)) rejection='toll_free';
  else if(fitTier===null) rejection='no_positive_relevance';
  else if(plan.exclusions.some(term=>matchesPhrase(`${text} ${city} ${state}`,term))) rejection='operator_exclusion';
  return {name,city,state,website:safeBusinessUrl(row.website),sourceUrl,phone10,placeId:str(row.placeId,200)||null,
    businessKey:[name,city,state].map(normalizeWords).join('|'),rejection,fitTier,
    franchise:franchiseBrand(name),timeZone:resolveTimeZone({state,city,phone10})};
}
