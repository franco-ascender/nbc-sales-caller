import {apiError,IntegrationError,readJson} from '@/services/integration.service';
import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {leadCycleView,createLeadCycle,advanceLeadCycle,controlLeadCycle} from '@/services/lead-cycle.service';
import {parseCycleInput,cycleKey} from '@/lib/lead-cycle';
export const runtime='nodejs';export const maxDuration=60;
const response=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request):Promise<Response>{try{const user=await requireWorkspaceAdmin(request);return response(await leadCycleView(user.id,new URL(request.url).searchParams.get('key')??undefined));}catch(error){return apiError(error);}}
export async function POST(request:Request):Promise<Response>{try{
 const user=await requireWorkspaceAdmin(request),body=await readJson(request);
 if(!body||typeof body!=='object'||Array.isArray(body))throw new IntegrationError(400,'Choose a list action.');
 const b=body as Record<string,unknown>;
 if(b.action==='create'){let input;try{input=parseCycleInput(body);}catch(error){throw new IntegrationError(400,error instanceof Error?error.message:'Check the list details.');}return response(await createLeadCycle(user.id,input));}
 if(Object.keys(b).some(k=>!['action','key','confirmed'].includes(k))||typeof b.key!=='string'||!cycleKey.test(b.key)||!['advance','pause','resume'].includes(String(b.action))||(b.action==='resume'&&b.confirmed!==true))throw new IntegrationError(400,'Choose a saved list and confirm resuming it.');
 return response(b.action==='advance'?await advanceLeadCycle(user.id,b.key):await controlLeadCycle(user.id,b.key,b.action as 'pause'|'resume'));
}catch(error){return apiError(error);}}
