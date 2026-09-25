import { unscoredLeadConfidence } from '../lib/lead-engine-confidence.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError, leadStorageError } from '../lib/lead-engine-storage.ts';
import type { LeadFolder, LeadList, LeadListPage, ScrapeInput, ScrapeQuote, DiscoveryCandidate } from '../lib/lead-engine-scrape.ts';
const errors:Record<string,[number,string]>={
  pricing_pending:[503,'Verified scrape pricing is pending setup. No quote or charge was created.'],
  quote_expired:[409,'This quote expired. Review a fresh estimate before approving.'],
  quote_over_budget:[409,'This scrape exceeds the plan budget or the $10 pilot limit. Reduce the business count.'],
  folder_not_found:[404,'That folder was not found.'],list_not_found:[404,'That list was not found.'],quote_not_found:[404,'That quote was not found.'],
  folder_name_conflict:[409,'A folder with that name already exists.'],folder_limit:[409,'This workspace has reached its folder limit.'],
  execution_not_connected:[503,'Scraping is pending integration. No provider job was started.'],
  balance_check_required:[503,'A current provider balance must be verified before starting.'],
  provider_balance_exceeded:[409,'The verified provider balance is insufficient.'],
  hard_budget_exceeded:[409,'Existing reservations leave insufficient plan budget.'],pilot_cap_exceeded:[409,'This would exceed the cumulative pilot limit.'],
  forecast_over_budget:[409,'The planning forecast exceeds your hard budget. Revise the plan before starting.'],
  stop_loss_triggered:[409,'A previous cost or uncertain run needs reconciliation before another scrape.'],
  claim_unavailable:[409,'This search or business has already been claimed. No second scrape was started.'],
  plan_paused:[409,'This plan is paused. Resolve its outstanding run before continuing.'],
  invalid_dataset:[503,'Results could not be reconciled with the expected page or scrape limit. Existing results are preserved.'],
  cursor_conflict:[409,'Another refresh advanced this list. Refresh its saved results.'],
  invalid_state:[409,'This operation is not available for the current saved state.'],
};
function failure(error:{code?:string;message?:string}):never {
  const known=error.code==='P0001'?errors[error.message??'']:undefined;
  if(known)throw new LeadEngineError(known[0],error.message!,known[1]);throw leadStorageError(error);
}
interface ListRow {id:string;name:string;folder_id:string|null;plan_id:string;cursor:number;import_status:string;created_at:string}
export interface LeadResearchStore {
  folders(operator:string):Promise<LeadFolder[]>;
  createFolder(operator:string,id:string,name:string):Promise<LeadFolder>;
  quote(operator:string,input:ScrapeInput):Promise<ScrapeQuote>;
  approve(operator:string,id:string):Promise<string>;
  lists(operator:string,offset:number,folder:string|null):Promise<{lists:LeadList[];nextOffset:number|null}>;
  get(operator:string,id:string,offset:number):Promise<LeadListPage>;
  move(operator:string,id:string,folder:string|null):Promise<void>;
  ingest(operator:string,id:string,offset:number,total:number,rows:DiscoveryCandidate[]):Promise<void>;
}
export function createLeadResearchStore(db:SupabaseClient):LeadResearchStore {
  async function rpc(name:string,args:Record<string,unknown>):Promise<unknown>{const {data,error}=await db.rpc(name,args);if(error)failure(error);return data;}
  async function enrich(operator:string,rows:ListRow[]):Promise<LeadList[]> {
    if(!rows.length)return [];
    const ids=rows.map(r=>r.id);
    const [jobs,costs]=await Promise.all([
      db.from('lead_engine_discovery_jobs').select('batch_id,status,max_results').eq('operator_id',operator).in('batch_id',ids),
      db.from('lead_engine_batches').select('id,reserved_cents,consumed_cents').eq('operator_id',operator).in('id',ids),
    ]);
    if(jobs.error)failure(jobs.error);if(costs.error)failure(costs.error);
    return rows.map(row=>{const job=jobs.data?.find(j=>j.batch_id===row.id),cost=costs.data?.find(c=>c.id===row.id);
      if(!job||!cost)throw new LeadEngineError(503,'storage_pending','Saved research is pending complete storage integration.');
      return {id:row.id,name:row.name,folderId:row.folder_id,planId:row.plan_id,importStatus:row.import_status,processed:row.cursor,
        status:job.status,maxResults:job.max_results,reservedCents:cost.reserved_cents,consumedCents:cost.consumed_cents,createdAt:row.created_at};});
  }
  const columns='id,name,folder_id,plan_id,cursor,import_status,created_at';
  return {
    async folders(operator){const {data,error}=await db.from('lead_engine_folders').select('id,name').eq('operator_id',operator).order('name').limit(200);if(error)failure(error);return data??[];},
    async createFolder(operator,id,name){const row=await rpc('lead_engine_save_folder',{p_operator:operator,p_id:id,p_name:name}) as {id:string;name:string};return {id:row.id,name:row.name};},
    async quote(operator,input){
      const data=await rpc('lead_engine_quote',{p_operator:operator,p_id:input.quoteId,p_plan:input.planId,p_folder:input.folderId,p_name:input.name,p_count:input.count}) as {
        quote:{id:string;plan_id:string;folder_id:string|null;name:string;max_results:number;min_cost_cents:number;max_cost_cents:number;expires_at:string};blockers:string[]};
      const q=data.quote;
      return {id:q.id,planId:q.plan_id,folderId:q.folder_id,name:q.name,maxResults:q.max_results,minCostCents:q.min_cost_cents,maxCostCents:q.max_cost_cents,expiresAt:q.expires_at,blockers:data.blockers,scope:'discovery_only'};
    },
    async approve(operator,id){return await rpc('lead_engine_approve_quote',{p_operator:operator,p_quote:id}) as string;},
    async lists(operator,offset,folder){
      let query=db.from('lead_engine_lists').select(columns).eq('operator_id',operator);
      if(folder==='unfiled')query=query.is('folder_id',null);else if(folder)query=query.eq('folder_id',folder);
      const {data,error}=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+20);
      if(error)failure(error);const rows=(data??[]) as ListRow[];
      return {lists:await enrich(operator,rows.slice(0,20)),nextOffset:rows.length>20?offset+20:null};
    },
    async get(operator,id,offset){const {data,error}=await db.from('lead_engine_lists').select(columns).eq('operator_id',operator).eq('id',id).maybeSingle();
      if(error)failure(error);if(!data)throw new LeadEngineError(404,'not_found','That list was not found.');
      const [list]=await enrich(operator,[data as ListRow]);
      const records=await rpc('lead_engine_list_records',{p_operator:operator,p_list:id,p_offset:offset}) as LeadListPage['records'];
      // Discovery rows have no trusted owner/phone verification yet. Ignore any supplied score.
      return {list,records:records.map(row=>({...row,confidence:unscoredLeadConfidence()})),nextOffset:offset+records.length<list.processed?offset+records.length:null};
    },
    async move(operator,id,folder){await rpc('lead_engine_move_list',{p_operator:operator,p_list:id,p_folder:folder});},
    async ingest(operator,id,offset,total,rows){await rpc('lead_engine_ingest_page',{p_operator:operator,p_list:id,p_offset:offset,p_total:total,p_rows:rows});},
  };
}
