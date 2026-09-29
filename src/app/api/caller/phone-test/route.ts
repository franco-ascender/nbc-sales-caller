import {apiError,IntegrationError,readJson} from '@/services/integration.service';
import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {pilotView,startDialerTrial,checkCurrentPhoneEngine} from '@/services/live-pilot.service';
import {parsePhoneTrial} from '@/lib/caller-phone-trial';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request):Promise<Response>{try{const user=await requireWorkspaceAdmin(request);if(new URL(request.url).searchParams.get('check')==='1')await checkCurrentPhoneEngine(user.id);return Response.json(await pilotView(user.id),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request):Promise<Response>{try{const user=await requireWorkspaceAdmin(request);let input;try{input=parsePhoneTrial(await readJson(request));}catch(e){throw new IntegrationError(400,e instanceof Error?e.message:'Invalid phone test.');}return Response.json(await startDialerTrial(user.id,input.requestId,input.phone,input.approvedMaxCents,input.scenarioId),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
