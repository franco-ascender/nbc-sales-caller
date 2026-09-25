import { apiError, IntegrationError, readJson } from '@/services/integration.service';
import { requireWorkspaceAdmin } from '@/services/workspace-auth';
import { pilotView, startPilot, syncPilot, pilotFeedback, checkPilot } from '@/services/live-pilot.service';
import { parsePilotAction } from '@/lib/live-pilot';
export const runtime='nodejs';
export const maxDuration=60;
const response=(value:unknown):Response=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request):Promise<Response>{try{const user=await requireWorkspaceAdmin(request);return response(await pilotView(user.id));}catch(error){return apiError(error);}}
export async function POST(request:Request):Promise<Response>{
  try{
    const user=await requireWorkspaceAdmin(request);let action:ReturnType<typeof parsePilotAction>;
    try{action=parsePilotAction(await readJson(request));}catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(400,error instanceof Error?error.message:'Invalid test action.');}
    return response(action.action==='check'?await checkPilot(user.id,action.key):action.action==='start'?await startPilot(user.id,action.key):action.action==='feedback'?await pilotFeedback(user.id,action.key,action.feedback??''):await syncPilot(user.id,action.key,action.action==='stop'));
  }catch(error){return apiError(error);}
}
