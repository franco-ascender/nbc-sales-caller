import {onboardingAdmin,startOnboarding,reconcileOnboarding,loadOnboarding} from '@/services/client-onboarding';
import {readJson} from '@/services/integration.service';
import {OnboardingError} from '@/lib/client-onboarding';
import {onboardingResponse,onboardingFailure} from '@/services/onboarding-http';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{await onboardingAdmin(request);return onboardingResponse({record:await loadOnboarding((await context.params).id)});}catch(e){return onboardingFailure(e);}}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const actor=await onboardingAdmin(request),{id}=await context.params,body=await readJson(request) as any;if(body?.action==='start')return onboardingResponse({record:await startOnboarding(actor.id,id,body)});if(body?.action==='reconcile')return onboardingResponse({record:await reconcileOnboarding(actor.id,id)});throw new OnboardingError(400,'Choose a valid onboarding action.');}catch(e){return onboardingFailure(e);}}
