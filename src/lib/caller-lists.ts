import type { CallerLead } from './caller-crm.ts';
export interface LeadList { id: string; name: string; is_demo: boolean; leadIds: string[]; updated_at: string }
export function eligibleLeads(leads: readonly CallerLead[]): CallerLead[] { return leads.filter(lead => !lead.do_not_call && !['do_not_call','won','lost'].includes(lead.stage)); }
export function uniqueLeadSelection(ids: unknown): ids is string[] { return Array.isArray(ids) && ids.length>0 && ids.length<=500 && ids.every(id=>typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) && new Set(ids).size===ids.length; }
