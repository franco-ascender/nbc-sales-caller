import type {CallerLead} from './caller-crm.ts';
export const bucketColors=['slate','blue','green','amber','violet','rose'] as const;
export type BucketColor=typeof bucketColors[number];
export interface CallerBucket{id:string;name:string;color:BucketColor;outcome:'active'|'won'|'lost';position:number;default_key:string|null}
export interface CallerPipeline{version:string;defaultId:string;buckets:CallerBucket[]}
export const callOutcomes={no_answer:'No answer',connected:'Connected',voicemail:'Left voicemail',busy:'Busy',wrong_number:'Wrong number'} as const;
export interface LeadActivity{id:string;lead_id:string;author_id:string;author_name:string;kind:'note'|'manual_call'|'stage_change';outcome:keyof typeof callOutcomes|null;body:string;created_at:string}
export interface ActivityPage{activities:LeadActivity[];nextCursor:string|null}
export function bucketFor(lead:CallerLead,pipeline:CallerPipeline|null):CallerBucket|undefined{return pipeline?.buckets.find(b=>b.id===lead.bucket_id)||pipeline?.buckets.find(b=>b.default_key===lead.stage)||pipeline?.buckets.find(b=>b.id===pipeline.defaultId);}
export function isBlocked(lead:CallerLead):boolean{return lead.do_not_call===true||lead.stage==='do_not_call';}
export const bucketHex:Record<BucketColor,string>={slate:'#8b95a5',blue:'#5079ba',green:'#4d8a75',amber:'#b89245',violet:'#8b76ae',rose:'#b87682'};
