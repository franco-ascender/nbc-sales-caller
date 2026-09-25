import type { SavedLeadPlan } from '@/lib/lead-engine-storage';
export interface LeadScrapeWorkspaceProps { token:string; plan:SavedLeadPlan|null; savedMatches:boolean; mode:'search'|'lists'; onAccessDenied(status:number):void; storageUnavailable:boolean; onStorageChange(unavailable:boolean):void }
