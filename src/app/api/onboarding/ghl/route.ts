import {onboardingAdmin} from '@/services/client-onboarding';
import {authenticateGhlOnboarding,captureGhlOnboarding,listGhlReceipts,readGhlWebhook} from '@/services/onboarding-ghl';
import {onboardingFailure,onboardingResponse} from '@/services/onboarding-http';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){
 try{authenticateGhlOnboarding(request);return onboardingResponse(await captureGhlOnboarding(await readGhlWebhook(request)));}
 catch(e){return onboardingFailure(e);}
}
export async function GET(request:Request){
 try{await onboardingAdmin(request);return onboardingResponse({mode:'capture',automation_started:false,receipts:await listGhlReceipts()});}
 catch(e){return onboardingFailure(e);}
}
