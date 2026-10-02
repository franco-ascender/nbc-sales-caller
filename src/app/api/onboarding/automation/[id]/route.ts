import {authenticateAutomation,receiveAutomation} from '@/services/onboarding-automation';
import {readJson} from '@/services/integration.service';
import {onboardingResponse,onboardingFailure} from '@/services/onboarding-http';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{const {id}=await context.params;authenticateAutomation(request,id);return onboardingResponse(await receiveAutomation(id,await readJson(request)));}catch(e){return onboardingFailure(e);}
}
