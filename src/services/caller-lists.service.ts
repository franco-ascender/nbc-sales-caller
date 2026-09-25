import 'server-only';
import { database, IntegrationError } from './integration.service';
import type { LeadList } from '@/lib/caller-lists';
export async function readLeadLists(owner:string,demo:boolean):Promise<LeadList[]> {
 const {data,error}=await database().from('caller_lead_lists').select('id,name,is_demo,updated_at,caller_lead_list_items(lead_id)').eq('operator_id',owner).eq('is_demo',demo).order('updated_at',{ascending:false}).limit(100);
 if(error)throw new IntegrationError(503,'Lead lists could not load. Please retry.');
 return data.map(list=>({id:list.id,name:list.name,is_demo:list.is_demo,updated_at:list.updated_at,leadIds:list.caller_lead_list_items.map(item=>item.lead_id)}));
}
export async function saveLeadList(owner:string,id:string,name:string,ids:string[],demo:boolean):Promise<void>{
 const {error}=await database().rpc('caller_save_list',{p_operator:owner,p_id:id,p_name:name,p_leads:ids,p_demo:demo});
 if(error)throw new IntegrationError(['invalid_selection','invalid_list'].some(code=>error.message.includes(code))?400:503,'This list could not be saved. Select up to 500 of your leads from the same workspace mode.');
}
