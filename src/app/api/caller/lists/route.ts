import {apiError,IntegrationError} from '@/services/integration.service';
import {requireWorkspaceUser} from '@/services/workspace-auth';
import {readLeadLists,saveLeadList} from '@/services/caller-lists.service';
import {isRecord} from '@/lib/integration-validation';import {validSessionId} from '@/lib/caller-validation';import {uniqueLeadSelection} from '@/lib/caller-lists';
import {readCallerJson} from '@/services/caller-crm.service';
const reply=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request):Promise<Response>{try{const user=await requireWorkspaceUser(request),demo=new URL(request.url).searchParams.get('demo')==='true';if(demo&&user.role!=='admin')throw new IntegrationError(403,'Demo tools are available to administrators only.');return reply({lists:await readLeadLists(user.id,demo)});}catch(error){return apiError(error);}}
export async function POST(request:Request):Promise<Response>{try{const user=await requireWorkspaceUser(request),body=await readCallerJson(request,32768);if(!isRecord(body)||!validSessionId(body.id)||typeof body.name!=='string'||!body.name.trim()||body.name.length>100||!uniqueLeadSelection(body.leadIds)||typeof body.demo!=='boolean')throw new IntegrationError(400,'Name a list and select between 1 and 500 leads.');if(body.demo&&user.role!=='admin')throw new IntegrationError(403,'Demo tools are available to administrators only.');await saveLeadList(user.id,body.id,body.name,body.leadIds,body.demo);return reply({saved:true});}catch(error){return apiError(error);}}
