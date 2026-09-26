import {apiError,database,IntegrationError,readJson} from '@/services/integration.service';
import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {parseVerificationRate} from '@/lib/run-verification-rate';
import {pilotView} from '@/services/live-pilot.service';
export async function POST(request:Request):Promise<Response>{
 try{const user=await requireWorkspaceAdmin(request);let input;try{input=parseVerificationRate(await readJson(request));}catch(e){throw new IntegrationError(400,e instanceof Error?e.message:'Invalid verification rate.');}
 const saved=await database().rpc('nbc_pilot_set_verification_rate',{p_owner:user.id,p_unit_microusd:input.unitMicrousd,p_source:input.source});
 if(saved.error)throw new IntegrationError(saved.error.message.includes('pilot_not_found')?403:409,'The rate could not be saved. Check access and resolve any pending phone verification first.');
 return Response.json(await pilotView(user.id),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}
}
