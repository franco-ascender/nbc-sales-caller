import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {apiError,IntegrationError} from '@/services/integration.service';
import {readCallerJson,importCallerLeads} from '@/services/caller-crm.service';
import {pilotView} from '@/services/live-pilot.service';
import {qualifiedRows} from '@/lib/run-review';
import {validateLead} from '@/lib/caller-crm';
import {validSessionId} from '@/lib/caller-validation';
export async function POST(request:Request){try{const u=await requireWorkspaceAdmin(request),b=await readCallerJson(request,8192) as Record<string,unknown>;if(!b||typeof b!=='object'||typeof b.key!=='string'||!validSessionId(b.requestId))throw new IntegrationError(400,'Choose a saved list.');const v=await pilotView(u.id),s=v.slots.find(s=>s.key===b.key&&s.kind==='scrape');if(!s||s.state!=='completed')throw new IntegrationError(409,'Finish and verify this list before transferring.');const rows=qualifiedRows(s.result);if(!rows.length)throw new IntegrationError(409,'No phone-qualified leads are ready to transfer.');const leads=rows.map(r=>validateLead({name:r.name.slice(0,160),phone:'+1'+r.phone10,email:'',company:r.name.slice(0,160),source:('Lead Engine · '+s.title).slice(0,120)}));return Response.json(await importCallerLeads(u.id,b.requestId as string,leads));}catch(e){return apiError(e);}}
